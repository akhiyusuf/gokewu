import { applyAudioMap, loadAudioMap, type AudioMap } from "./api";
import { RATES, STORAGE_KEYS } from "./constants";
import { phrasesOf } from "./focus";
import { buildRelayTurns } from "./relay";
import { segForWord, segsFor, wordAt } from "./segments";
import { readStorage, writeStorage } from "./storage";
import type {
  LoopState,
  MaskState,
  Mode,
  RelayState,
  Style,
  Verse,
  WordDrillRange,
} from "./types";

export interface PassageRef {
  chapter: number;
  from: number;
  to: number;
  name: string;
}

export interface WordStepState {
  active: boolean;
  w: number;
  playedTimes: number;
  range: WordDrillRange | null;
}

export interface EngineState {
  verses: Verse[];
  passage: PassageRef | null;
  reciterId: number | null;
  /** Read back from the API rather than hardcoded, so the label stays honest. */
  translationName: string;
  loading: boolean;
  error: string | null;

  mode: Mode;
  style: Style;
  rate: number;

  vIdx: number;
  curWord: number;
  playing: boolean;

  loop: LoopState | null;
  verseLoop: boolean;
  wordStep: WordStepState;
  oneshot: { vIdx: number; endW: number } | null;

  wordRepeat: number;
  loopCount: number;
  taj: boolean;
  /** Static annotation layers (recurring phrases, confusable words). */
  layers: { phrases: boolean; confusables: boolean };

  focusPhrase: number;
  masked: Record<string, MaskState>;
  relay: RelayState | null;
  pendingLoopStart: { vIdx: number; w: number } | null;
}

type Listener = () => void;
type TimeListener = (currentTime: number, duration: number) => void;
type ToastListener = (msg: string) => void;

const GAP_MS = 380;
const LOOP_EDGE_GUARD_MS = 80;
const PEEKS_PER_VERSE = 3;

/**
 * Framework-agnostic playback engine.
 *
 * This is the most fragile part of the app and is hardened against a specific
 * set of race conditions — see feature-spec.md §6. When changing anything in
 * here, preserve these properties:
 *
 *  - Single armed seek: only one pending seek/play intent exists at a time,
 *    so a mode or verse switch can never resurrect a stale seek-and-play.
 *  - Source freshness: when `src` changes, metadata is stale; a pending seek
 *    waits for the NEW metadata before firing.
 *  - Play-token guard: `play()` rejections are only honoured for the latest
 *    play attempt AND when audio is genuinely paused, so stale AbortErrors
 *    can't flip the play button or kill the highlight loop.
 *  - Loop-edge re-entrancy guard: the rAF tick and `ended` can both catch the
 *    same loop boundary; an 80ms guard stops a pass being double-counted.
 *  - Word-gap timer guard: `wordStepEnded` is idempotent via a single gap
 *    timer; in Word mode the final word's segment ends exactly at file end so
 *    `ended` may beat the tick.
 *  - Per-verse state isolation: drill range, word position and focus phrase
 *    reset when the verse changes.
 *
 * High-frequency time updates go to `subscribeTime` (direct DOM writes in the
 * seek bar) rather than the React store, so playback doesn't re-render the
 * tree every animation frame.
 */
export class PlaybackEngine {
  readonly audio: HTMLAudioElement;

  private st: EngineState;
  private snap: EngineState;
  private listeners = new Set<Listener>();
  private timeListeners = new Set<TimeListener>();
  private toastListeners = new Set<ToastListener>();

  private rafId: number | null = null;
  private wordGapTimer: ReturnType<typeof setTimeout> | null = null;
  private armed: { t: number; play: boolean } | null = null;
  private srcFresh = false;
  private playToken = 0;
  private pendingWordInit = false;
  private loopEdgeAt = 0;
  private passageToken = 0;
  private audioByReciter: Record<string, AudioMap> = {};
  private doneVerses = new Set<number>();

  constructor() {
    this.audio = typeof Audio !== "undefined" ? new Audio() : ({} as HTMLAudioElement);
    this.st = {
      verses: [],
      passage: null,
      reciterId: null,
      translationName: "Translation",
      loading: false,
      error: null,
      mode: "verse",
      style: (readStorage<Style>(STORAGE_KEYS.style) as Style) || "mushaf",
      rate: 1,
      vIdx: 0,
      curWord: 0,
      playing: false,
      loop: null,
      verseLoop: false,
      wordStep: { active: false, w: 1, playedTimes: 0, range: null },
      oneshot: null,
      wordRepeat: readStorage<number>(STORAGE_KEYS.wordRepeat) ?? 2,
      loopCount: readStorage<number>(STORAGE_KEYS.loopCount) ?? 5,
      taj: !!readStorage<boolean>(STORAGE_KEYS.taj),
      layers: {
        phrases: readStorage<boolean>(STORAGE_KEYS.layerPhrases) ?? true,
        confusables: readStorage<boolean>(STORAGE_KEYS.layerConfusables) ?? true,
      },
      focusPhrase: 0,
      masked: {},
      relay: null,
      pendingLoopStart: null,
    };
    this.snap = { ...this.st };
    if (typeof Audio !== "undefined") {
      this.audio.preload = "auto";
      this.bindAudioEvents();
    }
  }

  /* ---------------- store plumbing ---------------- */

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): EngineState => this.snap;

  subscribeTime = (fn: TimeListener): (() => void) => {
    this.timeListeners.add(fn);
    return () => this.timeListeners.delete(fn);
  };
  subscribeToast = (fn: ToastListener): (() => void) => {
    this.toastListeners.add(fn);
    return () => this.toastListeners.delete(fn);
  };

  private notify() {
    this.snap = { ...this.st };
    this.listeners.forEach((l) => l());
  }
  private emitTime() {
    const d = this.audio.duration;
    this.timeListeners.forEach((l) => l(this.audio.currentTime || 0, isFinite(d) ? d : 0));
  }
  private toast(msg: string) {
    this.toastListeners.forEach((l) => l(msg));
  }

  isVerseDone(vIdx: number): boolean {
    return this.doneVerses.has(vIdx);
  }

  /* ---------------- audio element wiring ---------------- */

  private bindAudioEvents() {
    this.audio.addEventListener("loadedmetadata", () => {
      this.srcFresh = false;
      this.fireArm();
      this.emitTime();
      if (this.pendingWordInit) {
        this.pendingWordInit = false;
        if (this.st.mode === "word") this.wordModePlayCurrent();
      }
    });

    this.audio.addEventListener("error", () => {
      this.srcFresh = false;
      this.armed = null;
      this.pendingWordInit = false;
      this.clearGap();
      if (this.st.playing) {
        this.st.playing = false;
        this.notify();
      }
      if (this.audio.src) this.toast("Audio failed to load — check your connection.");
    });

    this.audio.addEventListener("ended", () => this.onEnded());

    this.audio.addEventListener("pause", () => {
      if (!this.audio.ended && !this.wordGapTimer && this.st.playing) {
        this.st.playing = false;
        this.notify();
      }
    });

    this.audio.addEventListener("play", () => {
      if (!this.st.playing) {
        this.st.playing = true;
        this.notify();
      }
      this.tick();
    });

    this.audio.addEventListener("seeked", () => {
      this.emitTime();
      // Masked reveals must only come from playing audio, never from a seek
      // event — a late 'seeked' from a prior mode's reset would leak a reveal.
      const { mode, wordStep } = this.st;
      if (mode === "relay" || mode === "masked" || (mode === "word" && wordStep.active)) return;
      const v = this.currentVerse();
      if (!v) return;
      const w = wordAt(this.segsForVerse(v), this.audio.currentTime);
      if (w !== this.st.curWord) {
        this.st.curWord = w;
        this.onWordChange(v, w);
      }
    });
  }

  private segsForVerse(v: Verse) {
    return segsFor(v, v === this.currentVerse(), this.audio.duration);
  }

  currentVerse(): Verse | null {
    return this.st.verses[this.st.vIdx] || null;
  }

  /* ---------------- seek / play primitives ---------------- */

  /** Central src setter: marks metadata stale until the new file loads. */
  private setSrc(url: string) {
    if (this.audio.src !== url) {
      this.srcFresh = true;
      this.audio.src = url;
      this.audio.load();
      this.emitTime();
    }
  }

  /**
   * One pending seek at a time. Arming replaces any previous intent, so a
   * mode/verse switch can never resurrect an old seek-and-play. If the src
   * just changed, the seek waits for the NEW metadata.
   */
  private armSeek(t: number, thenPlay: boolean) {
    this.armed = { t: Math.max(0, t), play: !!thenPlay };
    if (!this.srcFresh && this.audio.readyState >= 1) this.fireArm();
  }
  private fireArm() {
    if (!this.armed) return;
    const a = this.armed;
    this.armed = null;
    try {
      this.audio.currentTime = a.t;
    } catch {
      /* ignore */
    }
    if (a.play) this.playAudio();
  }

  private playAudio() {
    this.audio.playbackRate = this.st.rate;
    const tok = ++this.playToken;
    const p = this.audio.play();
    if (p && p.catch) {
      p.catch(() => {
        // Only honour the rejection if it's the latest play() AND playback is
        // genuinely stopped — stale AbortErrors from an interrupting pause or
        // src change used to flip the button and halt the highlight loop.
        if (tok === this.playToken && this.audio.paused) {
          this.st.playing = false;
          this.notify();
        }
      });
    }
    this.st.playing = true;
    this.notify();
    this.tick();
  }

  private pauseAudio() {
    if (this.armed) this.armed.play = false;
    this.audio.pause();
    this.clearGap();
    this.st.playing = false;
    this.notify();
  }

  private clearGap() {
    if (this.wordGapTimer) clearTimeout(this.wordGapTimer);
    this.wordGapTimer = null;
  }

  stopAudio() {
    this.audio.pause();
    this.audio.muted = false;
    this.armed = null;
    this.pendingWordInit = false;
    this.clearGap();
    this.st.playing = false;
    this.notify();
  }

  /* ---------------- rAF highlight loop ---------------- */

  private tick() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    const step = () => {
      const v = this.currentVerse();
      if (v && !this.audio.paused) {
        const t = this.audio.currentTime;
        const segs = this.segsForVerse(v);
        const w = wordAt(segs, t);
        if (w !== this.st.curWord) {
          this.st.curWord = w;
          this.onWordChange(v, w);
        }
        const { oneshot, loop, mode, wordStep } = this.st;
        if (oneshot && oneshot.vIdx === this.st.vIdx) {
          const os = segForWord(segs, oneshot.endW);
          if (os && t >= os.end - 0.02) {
            this.st.oneshot = null;
            this.pauseAudio();
          }
        }
        if (loop && loop.vIdx === this.st.vIdx) {
          const endSeg = segForWord(segs, loop.endW);
          if (endSeg && t >= endSeg.end - 0.03) this.handleLoopEdge(v);
        }
        if (mode === "word" && wordStep.active) {
          const seg = segForWord(segs, wordStep.w);
          if (seg && t >= seg.end - 0.02) this.wordStepEnded();
        }
        this.emitTime();
      }
      if (this.st.playing) this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private onWordChange(v: Verse, w: number) {
    if (this.st.mode === "masked") this.revealTo(v, w);
    if (this.st.style === "focus" && this.st.mode !== "masked" && this.st.mode !== "relay" && w > 0) {
      this.syncFocusPhrase(v, w);
    }
    this.notify();
  }

  private handleLoopEdge(v: Verse) {
    const now = performance.now();
    // tick + 'ended' can both catch the same edge
    if (now - this.loopEdgeAt < LOOP_EDGE_GUARD_MS) return;
    this.loopEdgeAt = now;
    const L = this.st.loop;
    if (!L) return;
    const pass = L.pass + 1;
    if (L.passes !== 0 && pass >= L.passes) {
      this.st.loop = null;
      this.toast("Loop done — continuing");
      this.notify();
      return;
    }
    this.st.loop = { ...L, pass };
    const s = segForWord(this.segsForVerse(v), L.startW);
    if (s) {
      try {
        this.audio.currentTime = Math.max(0, s.start - 0.02);
      } catch {
        /* ignore */
      }
    }
    this.notify();
  }

  private onEnded() {
    const v = this.currentVerse();
    if (this.st.mode === "relay") {
      this.relayTurnEnded();
      return;
    }
    // In word mode the last word's segment ends exactly at the file's end, so
    // 'ended' can beat the tick check — treat file-end as word-end and keep
    // the sequence alive (wordStepEnded is idempotent via the gap timer).
    if (this.st.mode === "word") {
      if (this.st.wordStep.active) {
        this.wordStepEnded();
      } else {
        this.clearGap();
        this.st.playing = false;
        this.notify();
      }
      return;
    }
    this.clearGap();
    if (this.st.oneshot && this.st.oneshot.vIdx === this.st.vIdx) {
      this.st.oneshot = null;
      this.st.playing = false;
      this.notify();
      return;
    }
    if (this.st.loop && this.st.loop.vIdx === this.st.vIdx && v) {
      this.handleLoopEdge(v);
      if (this.st.loop) {
        this.playAudio();
        return;
      }
    }
    if (this.st.verseLoop) {
      this.armSeek(0, true);
      return;
    }
    this.markVerseDone(this.st.vIdx);
    if (this.st.vIdx < this.st.verses.length - 1) {
      this.loadVerseAudio(this.st.vIdx + 1, true);
    } else {
      this.st.playing = false;
      this.notify();
      this.toast("End of passage");
    }
  }

  private markVerseDone(vIdx: number) {
    this.doneVerses.add(vIdx);
  }

  /* ---------------- passage loading ---------------- */

  async openPassage(
    passage: PassageRef,
    reciterId: number,
    verses: Verse[],
    translationName = "Translation",
  ) {
    const tok = ++this.passageToken;
    this.stopAudio();
    this.doneVerses.clear();
    this.audioByReciter = {};
    this.st = {
      ...this.st,
      passage,
      reciterId,
      verses,
      translationName,
      loading: false,
      error: null,
      vIdx: 0,
      curWord: 0,
      loop: null,
      verseLoop: false,
      relay: null,
      mode: "verse",
      focusPhrase: 0,
      masked: {},
      oneshot: null,
      pendingLoopStart: null,
      wordStep: { active: false, w: 1, playedTimes: 0, range: null },
    };
    this.notify();
    try {
      const map = await this.ensureAudio(reciterId);
      if (tok !== this.passageToken) return;
      this.st.verses = applyAudioMap(this.st.verses, map);
      this.notify();
      this.loadVerseAudio(0, false);
    } catch {
      if (tok !== this.passageToken) return;
      this.toast("Couldn’t load audio for this passage.");
    }
  }

  private audioKey(reciterId: number) {
    const p = this.st.passage!;
    return `${reciterId}:${p.chapter}:${p.from}-${p.to}`;
  }

  private async ensureAudio(reciterId: number): Promise<AudioMap> {
    const key = this.audioKey(reciterId);
    const hit = this.audioByReciter[key];
    if (hit) return hit;
    const p = this.st.passage!;
    const map = await loadAudioMap(reciterId, p.chapter, p.from, p.to);
    this.audioByReciter[key] = map;
    return map;
  }

  /** Restore the main reciter's audio onto every verse (after relay). */
  private restoreMainAudio() {
    if (!this.st.passage || this.st.reciterId == null) return;
    const map = this.audioByReciter[this.audioKey(this.st.reciterId)];
    if (!map) return;
    this.st.verses = applyAudioMap(this.st.verses, map);
  }

  loadVerseAudio(vIdx: number, autoplay: boolean, opts?: { muted?: boolean; seekTo?: number }) {
    const v = this.st.verses[vIdx];
    if (!v) return;
    if (vIdx !== this.st.vIdx) {
      // per-verse state must not leak into the next verse
      this.st.wordStep = { ...this.st.wordStep, range: null, w: 1, playedTimes: 0 };
      this.st.focusPhrase = 0;
    }
    this.st.vIdx = vIdx;
    this.st.curWord = 0;
    this.st.oneshot = null;
    this.armed = null;
    this.pendingWordInit = false;
    this.clearGap();
    if (this.st.mode === "masked") this.ensureMaskState(v);

    const src = v.audio?.url;
    if (!src) {
      this.toast(`No audio for verse ${v.key} from this qari.`);
      this.notify();
      // Only keep auto-skipping if we're still in a playing chain — a pause
      // during the gap must not resurrect playback.
      if (autoplay && vIdx < this.st.verses.length - 1) {
        setTimeout(() => {
          if (this.st.vIdx === vIdx && this.st.playing) this.loadVerseAudio(vIdx + 1, true);
        }, 600);
      } else {
        this.st.playing = false;
        this.notify();
      }
      return;
    }
    this.setSrc(src);
    this.audio.playbackRate = this.st.rate;
    this.audio.muted = !!opts?.muted;
    this.armSeek(typeof opts?.seekTo === "number" ? opts.seekTo : 0, false);
    this.notify();
    if (autoplay) {
      // never continuous in Word mode
      if (this.st.mode === "word") this.wordModePlayCurrent();
      else this.playAudio();
    }
  }

  /* ---------------- transport ---------------- */

  togglePlay() {
    if (this.st.mode === "relay") {
      this.relayTogglePlay();
      return;
    }
    if (this.st.playing) {
      this.pauseAudio();
      return;
    }
    if (this.st.mode === "word") {
      this.wordModePlayCurrent();
      return;
    }
    if (!this.audio.src) this.loadVerseAudio(this.st.vIdx, true);
    else this.playAudio();
  }

  prev() {
    if (this.st.mode === "word") {
      this.stepWordManual(-1);
      return;
    }
    if (this.st.vIdx > 0) {
      this.st.loop = null;
      this.loadVerseAudio(this.st.vIdx - 1, this.st.playing);
    } else {
      this.armSeek(0, this.st.playing);
    }
  }

  next() {
    if (this.st.mode === "word") {
      this.stepWordManual(1);
      return;
    }
    if (this.st.vIdx < this.st.verses.length - 1) {
      this.st.loop = null;
      this.loadVerseAudio(this.st.vIdx + 1, this.st.playing);
    }
  }

  cycleRate() {
    const i = RATES.indexOf(this.st.rate as (typeof RATES)[number]);
    this.st.rate = RATES[(i + 1) % RATES.length]!;
    this.audio.playbackRate = this.st.rate;
    this.notify();
  }

  toggleVerseLoop() {
    this.st.verseLoop = !this.st.verseLoop;
    this.toast(this.st.verseLoop ? "Repeating this verse until you turn it off" : "Verse repeat off");
    this.notify();
  }

  /** Seek bar drags update UI only; the element is seeked once on release. */
  commitSeek(fraction: number) {
    if (isFinite(this.audio.duration)) {
      try {
        this.audio.currentTime = fraction * this.audio.duration;
      } catch {
        /* ignore */
      }
    }
    this.emitTime();
  }

  jumpToVerse(vIdx: number) {
    this.st.loop = null;
    this.loadVerseAudio(vIdx, true);
  }

  /* ---------------- mode / style ---------------- */

  setMode(mode: Mode) {
    if (mode === this.st.mode && mode !== "relay") return;
    this.stopAudio();
    this.st.loop = null;
    this.st.pendingLoopStart = null;
    this.st.oneshot = null;
    this.st.wordStep = { active: false, w: 1, playedTimes: 0, range: null };
    this.st.mode = mode;
    if (mode === "masked") this.st.masked = {};
    if (mode !== "relay") this.st.relay = null;
    this.notify();
    if (mode === "relay") return; // caller opens the setup sheet
    this.loadVerseAudio(this.st.vIdx, false);
  }

  setStyle(style: Style) {
    this.st.style = style;
    writeStorage(STORAGE_KEYS.style, style);
    this.st.focusPhrase = 0;
    this.notify();
  }

  setTajweed(on: boolean) {
    this.st.taj = on;
    writeStorage(STORAGE_KEYS.taj, on);
    this.notify();
  }

  setLayer(layer: "phrases" | "confusables", on: boolean) {
    this.st.layers = { ...this.st.layers, [layer]: on };
    writeStorage(layer === "phrases" ? STORAGE_KEYS.layerPhrases : STORAGE_KEYS.layerConfusables, on);
    this.notify();
  }

  setWordRepeat(n: number) {
    this.st.wordRepeat = n;
    writeStorage(STORAGE_KEYS.wordRepeat, n);
    this.notify();
  }

  setLoopCount(n: number) {
    this.st.loopCount = n;
    writeStorage(STORAGE_KEYS.loopCount, n);
    this.notify();
  }

  /* ---------------- word mode ---------------- */

  private wordModePlayCurrent() {
    const v = this.currentVerse();
    if (!v) return;
    if (!this.segsForVerse(v)) {
      if (v.audio?.url) {
        this.setSrc(v.audio.url);
        this.pendingWordInit = true; // consumed once by the loadedmetadata handler
        return;
      }
      this.toast("No audio for this verse.");
      return;
    }
    const ws = this.st.wordStep;
    const w = ws.w < 1 || ws.w > v.words.length ? 1 : ws.w;
    this.st.wordStep = { ...ws, active: true, w };
    this.playWordOnce(v, w);
  }

  private playWordOnce(v: Verse, w: number) {
    const seg = segForWord(this.segsForVerse(v), w);
    if (!seg) {
      this.wordStepEnded();
      return;
    }
    this.st.curWord = w;
    this.notify();
    if (v.audio) this.setSrc(v.audio.url);
    this.audio.muted = false;
    this.audio.playbackRate = this.st.rate;
    this.armSeek(seg.start - 0.02, true);
  }

  private wordStepEnded() {
    // already in a between-words gap (tick and 'ended' can both fire)
    if (this.wordGapTimer) return;
    this.audio.pause();
    this.st.playing = true;
    this.st.wordStep = { ...this.st.wordStep, playedTimes: this.st.wordStep.playedTimes + 1 };
    this.notify();
    const v = this.currentVerse();
    if (!v) return;
    const gap = GAP_MS / this.st.rate;
    this.wordGapTimer = setTimeout(() => {
      this.wordGapTimer = null;
      if (this.st.mode !== "word" || !this.st.wordStep.active) return;
      if (this.st.wordStep.playedTimes < this.st.wordRepeat) {
        this.playWordOnce(v, this.st.wordStep.w);
        return;
      }
      this.st.wordStep = { ...this.st.wordStep, playedTimes: 0 };
      const R = this.st.wordStep.range;
      if (R) {
        if (this.st.wordStep.w >= R.endW) {
          const pass = R.pass + 1;
          if (R.passes !== 0 && pass >= R.passes) {
            this.st.wordStep = { ...this.st.wordStep, range: null };
            this.st.playing = false;
            this.notify();
            this.toast("Drill done — nice work");
            return;
          }
          this.st.wordStep = { ...this.st.wordStep, range: { ...R, pass }, w: R.startW };
          this.notify();
          this.playWordOnce(v, R.startW);
          return;
        }
        this.st.wordStep = { ...this.st.wordStep, w: this.st.wordStep.w + 1 };
        this.notify();
        this.playWordOnce(v, this.st.wordStep.w);
        return;
      }
      if (this.st.wordStep.w < v.words.length) {
        this.st.wordStep = { ...this.st.wordStep, w: this.st.wordStep.w + 1 };
        this.playWordOnce(v, this.st.wordStep.w);
      } else if (this.st.vIdx < this.st.verses.length - 1) {
        this.st.wordStep = { ...this.st.wordStep, w: 1 };
        this.markVerseDone(this.st.vIdx);
        this.loadVerseAudio(this.st.vIdx + 1, false);
        setTimeout(() => {
          if (this.st.mode === "word") this.wordModePlayCurrent();
        }, 300);
      } else {
        this.st.wordStep = { ...this.st.wordStep, active: false };
        this.st.playing = false;
        this.notify();
        this.toast("End of passage");
      }
    }, gap);
  }

  /** prev/next are remapped to word stepping in Word mode. */
  private stepWordManual(d: number) {
    const v = this.currentVerse();
    if (!v) return;
    const wasPlaying = this.st.playing;
    this.clearGap();
    if (this.st.wordStep.range) {
      this.st.wordStep = { ...this.st.wordStep, range: null };
    }
    const base = this.st.wordStep.active || this.st.wordStep.w > 1 ? this.st.wordStep.w : this.st.curWord || 1;
    const w = base + d;
    if (w < 1) {
      if (this.st.vIdx > 0) {
        this.loadVerseAudio(this.st.vIdx - 1, false);
        this.st.wordStep = { ...this.st.wordStep, w: this.currentVerse()!.words.length };
      } else {
        this.st.wordStep = { ...this.st.wordStep, w: 1 };
      }
    } else if (w > v.words.length) {
      if (this.st.vIdx < this.st.verses.length - 1) {
        this.loadVerseAudio(this.st.vIdx + 1, false);
        this.st.wordStep = { ...this.st.wordStep, w: 1 };
      } else {
        this.st.wordStep = { ...this.st.wordStep, w: v.words.length };
      }
    } else {
      this.st.wordStep = { ...this.st.wordStep, w };
    }
    this.st.wordStep = { ...this.st.wordStep, playedTimes: 0 };
    const nv = this.currentVerse()!;
    if (wasPlaying) {
      this.st.wordStep = { ...this.st.wordStep, active: true };
      if (this.segsForVerse(nv)) this.playWordOnce(nv, this.st.wordStep.w);
      else this.wordModePlayCurrent();
    } else {
      this.st.curWord = this.st.wordStep.w;
      this.notify();
    }
  }

  /* ---------------- masked mode ---------------- */

  private ensureMaskState(v: Verse) {
    if (!this.st.masked[v.key]) {
      this.st.masked = { ...this.st.masked, [v.key]: { maxRev: 0, peeks: PEEKS_PER_VERSE } };
    }
  }

  private revealTo(v: Verse, w: number) {
    const m = this.st.masked[v.key];
    if (!m) return;
    if (w > m.maxRev) {
      this.st.masked = { ...this.st.masked, [v.key]: { ...m, maxRev: w } };
    }
  }

  peek() {
    const v = this.currentVerse();
    if (!v) return;
    this.ensureMaskState(v);
    const m = this.st.masked[v.key]!;
    if (m.peeks <= 0) {
      this.toast("No peeks left for this verse");
      return;
    }
    if (m.maxRev >= v.words.length) {
      this.toast("Everything is revealed");
      return;
    }
    this.st.masked = {
      ...this.st.masked,
      [v.key]: { maxRev: m.maxRev + 1, peeks: m.peeks - 1 },
    };
    this.notify();
  }

  maskStateFor(v: Verse): MaskState {
    return this.st.masked[v.key] || { maxRev: 0, peeks: PEEKS_PER_VERSE };
  }

  /* ---------------- focus style ---------------- */

  private syncFocusPhrase(v: Verse, w: number) {
    const phrases = phrasesOf(v);
    const idx = phrases.findIndex((ph) => w >= ph[0]!.pos && w <= ph[ph.length - 1]!.pos);
    if (idx >= 0 && idx !== this.st.focusPhrase) this.st.focusPhrase = idx;
  }

  stepPhrase(d: number) {
    const v = this.currentVerse();
    if (!v) return;
    const phrases = phrasesOf(v);
    const p = this.st.focusPhrase + d;
    if (p < 0) {
      if (this.st.vIdx > 0) {
        const wasPlaying = this.st.playing;
        this.loadVerseAudio(this.st.vIdx - 1, false);
        this.st.focusPhrase = Math.max(0, phrasesOf(this.currentVerse()!).length - 1);
        this.notify();
        if (wasPlaying) {
          const ph = phrasesOf(this.currentVerse()!)[this.st.focusPhrase];
          if (ph) this.playFromWord(ph[0]!.pos);
        }
      }
      return;
    }
    if (p >= phrases.length) {
      if (this.st.vIdx < this.st.verses.length - 1) {
        this.st.focusPhrase = 0;
        this.loadVerseAudio(this.st.vIdx + 1, this.st.playing);
      }
      return;
    }
    this.st.focusPhrase = p;
    this.notify();
    const ph = phrasesOf(this.currentVerse()!)[this.st.focusPhrase];
    if (this.st.playing && ph) this.playFromWord(ph[0]!.pos);
  }

  loopPhrase(passes = 5) {
    const v = this.currentVerse();
    if (!v) return;
    const ph = phrasesOf(v)[this.st.focusPhrase];
    if (!ph) return;
    this.setLoop(this.st.vIdx, ph[0]!.pos, ph[ph.length - 1]!.pos, passes, `phrase ${this.st.focusPhrase + 1}`);
    this.playFromWord(ph[0]!.pos);
  }

  private playFromWord(w: number) {
    const v = this.currentVerse();
    if (!v?.audio?.url) {
      this.toast("No audio for this verse.");
      return;
    }
    this.setSrc(v.audio.url);
    this.audio.muted = false;
    this.audio.playbackRate = this.st.rate;
    const seg = segForWord(this.segsForVerse(v), w);
    this.armSeek(seg ? seg.start - 0.02 : 0, true);
  }

  /* ---------------- loops & drills ---------------- */

  setLoop(vIdx: number, startW: number, endW: number, passes: number, label?: string) {
    this.st.oneshot = null;
    this.st.loop = {
      vIdx,
      startW,
      endW,
      passes,
      pass: 0,
      label: label || `words ${startW}–${endW}`,
    };
    this.notify();
  }

  clearLoop() {
    this.st.loop = null;
    this.notify();
  }

  clearDrill() {
    this.st.wordStep = { ...this.st.wordStep, range: null };
    this.notify();
  }

  startWordDrill(startW: number, endW: number) {
    this.st.wordStep = {
      ...this.st.wordStep,
      range: { startW, endW, passes: this.st.loopCount, pass: 0 },
      w: startW,
      playedTimes: 0,
    };
    this.notify();
    this.wordModePlayCurrent();
  }

  /** Play a single word once and stop. */
  playWordOneshot(vIdx: number, wPos: number) {
    this.st.loop = null;
    if (vIdx !== this.st.vIdx) this.loadVerseAudio(vIdx, false);
    if (this.st.mode === "word") {
      this.st.wordStep = { ...this.st.wordStep, w: wPos, playedTimes: 0 };
      this.wordModePlayCurrent();
      return;
    }
    this.st.oneshot = { vIdx, endW: wPos };
    this.playFromWord(wPos);
  }

  loopSingleWord(vIdx: number, wPos: number, label: string) {
    if (vIdx !== this.st.vIdx) this.loadVerseAudio(vIdx, false);
    if (this.st.mode === "word") {
      this.startWordDrill(wPos, wPos);
      return;
    }
    this.setLoop(vIdx, wPos, wPos, this.st.loopCount, label);
    this.playFromWord(wPos);
  }

  loopWordRange(vIdx: number, a: number, b: number) {
    this.st.pendingLoopStart = null;
    if (vIdx !== this.st.vIdx) this.loadVerseAudio(vIdx, false);
    if (this.st.mode === "word") {
      this.startWordDrill(a, b);
      return;
    }
    this.setLoop(vIdx, a, b, this.st.loopCount, `words ${a}–${b}`);
    this.playFromWord(a);
  }

  setPendingLoopStart(vIdx: number, w: number) {
    this.st.pendingLoopStart = { vIdx, w };
    this.notify();
    this.toast("Range start set — now tap the last word");
  }

  clearPendingLoopStart() {
    this.st.pendingLoopStart = null;
    this.notify();
  }

  /* ---------------- reciter switching ---------------- */

  async switchReciter(newId: number, name: string) {
    if (newId === this.st.reciterId) return;
    const wasPlaying = this.st.playing;
    const word = this.st.curWord;
    this.pauseAudio();
    this.st.reciterId = newId;
    writeStorage(STORAGE_KEYS.reciter, newId);
    this.notify();
    this.toast(`Switching to ${name}…`);
    try {
      const map = await this.ensureAudio(newId);
      if (this.st.reciterId !== newId) return; // switched again while loading
      this.st.verses = applyAudioMap(this.st.verses, map);
      const v = this.currentVerse();
      if (v?.audio?.url) {
        this.setSrc(v.audio.url);
        this.audio.playbackRate = this.st.rate;
        const seg = word ? segForWord(this.segsForVerse(v), word) : null;
        this.armSeek(seg ? seg.start : 0, wasPlaying);
        if (word) this.st.curWord = word;
      } else if (v) {
        this.toast(`No audio for verse ${v.key} from ${name}`);
      }
      this.notify();
    } catch {
      this.toast("Could not switch qari — check connection");
    }
  }

  /* ---------------- relay ---------------- */

  async beginRelay(
    order: RelayState["order"],
    vFrom: number,
    vTo: number,
    rounds: number,
  ): Promise<boolean> {
    const recIds = Array.from(
      new Set(
        order
          .filter((p): p is { kind: "qari"; reciterId: number } => p.kind === "qari")
          .map((p) => p.reciterId)
          .concat(this.st.reciterId != null ? [this.st.reciterId] : []),
      ),
    );
    try {
      await Promise.all(recIds.map((id) => this.ensureAudio(id)));
    } catch {
      this.toast("Could not load a qari — using main qari");
    }
    const turns = buildRelayTurns(this.st.verses, vFrom, vTo, order, 1, this.st.reciterId || 0);
    if (!turns.length) {
      this.toast("No verses in that range");
      return false;
    }
    this.st.mode = "relay";
    this.st.relay = { order, vFrom, vTo, rounds, round: 1, idx: 0, active: true, waitingTap: true, turns };
    const vi = this.vIdxByKey(turns[0]!.verseKey);
    if (vi >= 0) this.st.vIdx = vi;
    this.notify();
    return true;
  }

  private vIdxByKey(k: string) {
    return this.st.verses.findIndex((v) => v.key === k);
  }

  private relayAudioFor(turn: { reciterId: number; verseKey: string }) {
    const map =
      this.audioByReciter[this.audioKey(turn.reciterId)] ||
      (this.st.reciterId != null ? this.audioByReciter[this.audioKey(this.st.reciterId)] : undefined) ||
      {};
    return map[turn.verseKey] || null;
  }

  private relayTogglePlay() {
    const R = this.st.relay;
    if (!R || !R.active) return;
    if (this.st.playing) {
      this.pauseAudio();
      return;
    }
    if (!R.waitingTap && this.audio.src && this.audio.currentTime > 0 && !this.audio.ended) {
      this.playAudio();
      return;
    }
    this.st.relay = { ...R, waitingTap: false };
    this.notify();
    this.startRelayTurn(false);
  }

  startRelayTurn(forceAudible: boolean) {
    const R = this.st.relay;
    if (!R || !R.active) return;
    const turn = R.turns[R.idx];
    if (!turn) return;
    const a = this.relayAudioFor(turn);
    const vi = this.vIdxByKey(turn.verseKey);
    if (!a?.url || vi < 0) {
      this.toast(`No audio for ${turn.verseKey} — skipping`);
      this.advanceRelay();
      return;
    }
    const v = this.st.verses[vi]!;
    // Point the verse at this turn's reciter audio.
    const segments =
      (a.rawSegments ? applyAudioMap([v], { [v.key]: a })[0]!.audio!.segments : null) ||
      v.audio?.segments ||
      null;
    this.st.verses = this.st.verses.map((x, i) =>
      i === vi ? { ...x, audio: { url: a.url, segments }, _est: null, _estDur: undefined } : x,
    );
    this.st.vIdx = vi;
    this.st.curWord = 0;
    const youSilent = turn.kind === "you" && !forceAudible;
    this.setSrc(a.url);
    this.audio.muted = youSilent;
    this.audio.playbackRate = this.st.rate;
    this.armSeek(0, true);
    this.st.relay = { ...R, replaying: forceAudible && turn.kind === "you" };
    this.notify();
  }

  private relayTurnEnded() {
    const R = this.st.relay;
    if (!R || !R.active) return;
    if (R.replaying) {
      this.st.relay = { ...R, replaying: false };
      this.startRelayTurn(false);
      return;
    }
    this.advanceRelay();
  }

  advanceRelay() {
    const R = this.st.relay;
    if (!R) return;
    this.audio.muted = false;
    let idx = R.idx + 1;
    let round = R.round;
    let turns = R.turns;
    if (idx >= R.turns.length) {
      idx = 0;
      round = R.round + 1;
      if (R.rounds !== 0 && round > R.rounds) {
        this.st.relay = { ...R, active: false };
        this.stopAudio();
        this.restoreMainAudio();
        this.toast("Relay complete — well done");
        this.setMode("verse");
        return;
      }
      turns = buildRelayTurns(this.st.verses, R.vFrom, R.vTo, R.order, round, this.st.reciterId || 0);
      this.toast(`Round ${round} — the order rotates`);
    }
    this.st.relay = { ...R, idx, round, turns };
    const vi = this.vIdxByKey(turns[idx]!.verseKey);
    if (vi >= 0) this.st.vIdx = vi;
    this.notify();
    if (!this.st.relay.waitingTap) this.startRelayTurn(false);
  }

  exitRelay() {
    this.stopAudio();
    this.st.relay = null;
    this.restoreMainAudio();
    this.setMode("verse");
  }

  pauseRelayForEdit() {
    this.stopAudio();
    if (this.st.relay) this.st.relay = { ...this.st.relay, active: false };
    this.notify();
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.clearGap();
    try {
      this.audio.pause();
      this.audio.src = "";
    } catch {
      /* ignore */
    }
    this.listeners.clear();
    this.timeListeners.clear();
    this.toastListeners.clear();
  }
}
