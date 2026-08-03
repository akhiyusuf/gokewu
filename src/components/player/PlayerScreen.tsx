"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppData } from "@/components/providers/AppDataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Icon } from "@/components/shared/Icon";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { loadPassageText } from "@/lib/api";
import {
  annotationsForVerse,
  loadAnnotations,
  phraseGroupsAt,
  type ConfusableMark,
  type SurahAnnotations,
  type WordAnnotation,
} from "@/lib/annotations";
import { PlaybackEngine } from "@/lib/engine";
import { useDismissOnBack } from "@/lib/useDismissOnBack";
import { useEngineState } from "@/lib/usePlaybackEngine";
import { recordDay, saveSession } from "@/lib/sessions";
import type { Mode, RelayParticipant } from "@/lib/types";
import { PlayerFooter } from "./PlayerFooter";
import { PlayerHeader } from "./PlayerHeader";
import { WordPopover, type PopoverTarget } from "./WordPopover";
import { LayerBar } from "./LayerBar";
import { ConfusableSheet } from "./sheets/ConfusableSheet";
import { PhraseSheet } from "./sheets/PhraseSheet";
import { PractiseSheet } from "./sheets/PractiseSheet";
import { QariSheet } from "./sheets/QariSheet";
import { RelaySetupSheet } from "./sheets/RelaySetupSheet";
import { FocusView } from "./views/FocusView";
import { MaskedView } from "./views/MaskedView";
import { MushafView } from "./views/MushafView";
import { RelayView } from "./views/RelayView";
import { WordRangeView } from "./views/WordRangeView";
import type { ViewProps } from "./views/types";

type LoadState = "loading" | "ready" | "error";

export interface Selection {
  vIdx: number;
  start: number;
  end: number;
}

export interface FocusTarget {
  verse: number;
  from: number;
  to: number;
}

export function PlayerScreen({
  chapter,
  from,
  to,
  reciterParam,
  focus = null,
  cameFrom = null,
  heldAt = null,
  matchOf = null,
}: {
  chapter: number;
  from: number;
  to: number;
  reciterParam: number | null;
  /** Word span to land on, set when following an annotation link. */
  focus?: FocusTarget | null;
  /** Label of the passage the reader left, e.g. "Ya-Sin 6–9". */
  cameFrom?: string | null;
  /** Verse the origin passage is paused at, so the bar can promise nothing is lost. */
  heldAt?: number | null;
  /** Position within the occurrence list, as "3-6". */
  matchOf?: string | null;
}) {
  const router = useRouter();
  /*
   * Read the arrival params on the client. Server-component searchParams do not
   * reliably propagate on a same-route client navigation, so following an
   * annotation link changed the URL but left the screen showing the old state.
   */
  const search = useSearchParams();
  const focusParam = search.get("focus");
  const focusLive = (() => {
    if (!focusParam) return focus;
    const [verse, wf, wt] = focusParam.split("-").map(Number);
    if (!verse) return focus;
    const f = wf && wf > 0 ? wf : 1;
    return { verse, from: f, to: wt && wt >= f ? wt : f };
  })();
  const cameFromLive = search.get("back") ?? cameFrom;
  const heldAtLive = search.get("held") ? Number(search.get("held")) : heldAt;
  const matchOfLive = search.get("match") ?? matchOf;
  const gParam = search.get("g");
  const modeParam = search.get("mode");
  const atParam = search.get("at");

  const { chapters, status: appStatus, reciterId, setReciterId, reciterName, pushRecent } = useAppData();
  const { showToast } = useToast();

  // Constructed once per mount. The engine is SSR-safe (it no-ops without an
  // Audio constructor), so it must NOT be gated on `window` — doing that left
  // it null during server rendering and threw on the first subscribe.
  const [engine] = useState(() => new PlaybackEngine());

  const [load, setLoad] = useState<LoadState>("loading");
  const [slow, setSlow] = useState(false);
  const [modeSheet, setModeSheet] = useState(false);
  const [qariSheet, setQariSheet] = useState(false);
  const [relaySheet, setRelaySheet] = useState(false);
  const [popover, setPopover] = useState<PopoverTarget | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [ann, setAnn] = useState<SurahAnnotations | null>(null);
  const [arrived, setArrived] = useState<FocusTarget | null>(focusLive);
  const focusKey = focusParam ?? "";
  const [phraseSheet, setPhraseSheet] = useState<{ vIdx: number; pos: number } | null>(null);
  const [confusableSheet, setConfusableSheet] = useState<{ mark: ConfusableMark; vIdx: number } | null>(
    null,
  );

  const state = useEngineState(engine);
  const activeReciter = reciterParam ?? reciterId;

  // One history entry covers every overlay, so back closes what's open and
  // leaves the reader on the passage rather than at the index.
  const overlayOpen = !!(popover || modeSheet || qariSheet || relaySheet || phraseSheet || confusableSheet);
  const closeOverlays = useCallback(() => {
    setPopover(null);
    setModeSheet(false);
    setQariSheet(false);
    setRelaySheet(false);
    setPhraseSheet(null);
    setConfusableSheet(null);
  }, []);
  const navigatingAway = useRef(false);
  useDismissOnBack(overlayOpen, closeOverlays, navigatingAway);

  const chapterMeta = chapters.find((c) => c.id === chapter);
  const passageName = chapterMeta?.name_simple ?? `Surah ${chapter}`;
  const title = `${passageName} ${from}${to > from ? `–${to}` : ""}`;

  useEffect(() => () => engine.destroy(), [engine]);

  useEffect(() => engine.subscribeToast(showToast), [engine, showToast]);

  // Annotation layers are static and shipped with the app. Failure is
  // non-fatal — they enhance reading, they never gate it.
  useEffect(() => {
    let cancelled = false;
    loadAnnotations(chapter).then((data) => {
      if (!cancelled) setAnn(data);
    });
    return () => {
      cancelled = true;
    };
  }, [chapter]);

  // Sync the reciter chosen on the picker into app state.
  useEffect(() => {
    if (reciterParam != null && reciterParam !== reciterId) setReciterId(reciterParam);
  }, [reciterParam, reciterId, setReciterId]);

  // Load the passage.
  useEffect(() => {
    if (appStatus !== "ready" || activeReciter == null) return;
    let cancelled = false;
    setLoad("loading");
    setSlow(false);
    const slowTimer = setTimeout(() => !cancelled && setSlow(true), 5000);

    loadPassageText(chapter, from, to)
      .then(async ({ verses, translationName }) => {
        if (cancelled) return;
        if (!verses.length) throw new Error("empty passage");
        await engine.openPassage(
          { chapter, from, to, name: passageName },
          activeReciter,
          verses,
          translationName,
        );
        if (cancelled) return;
        setLoad("ready");
        pushRecent({
          chapter,
          from,
          to,
          name: passageName,
          reciter: reciterName(activeReciter),
        });
      })
      .catch(() => {
        if (!cancelled) setLoad("error");
      })
      .finally(() => clearTimeout(slowTimer));

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      engine.stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, from, to, activeReciter, appStatus, engine]);

  /* ---- word interaction ---- */

  const onWordTap = useCallback(
    (vIdx: number, pos: number, el: HTMLElement) => {
      const snap = engine.getSnapshot();
      const pending = snap.pendingLoopStart;
      if (pending) {
        // Second tap of the two-step range flow.
        if (pending.vIdx === vIdx && pending.w !== pos) {
          setSelection({ vIdx, start: Math.min(pending.w, pos), end: Math.max(pending.w, pos) });
          setPopover(null);
          return;
        }
        // A range can't span verses. Say so rather than silently restarting.
        if (pending.vIdx !== vIdx) {
          showToast(`A range stays inside one verse — pick a second word in ${snap.verses[pending.vIdx]?.key}.`);
        }
      }
      setSelection(null);
      setPopover({ vIdx, pos, rect: el.getBoundingClientRect() });
    },
    [engine, showToast],
  );

  const popWord = useMemo(() => {
    if (!popover) return null;
    return state.verses[popover.vIdx]?.words.find((w) => w.pos === popover.pos) ?? null;
  }, [popover, state.verses]);

  /*
   * Next reuses this component across navigations within /read/[chapter], so
   * the initial useState value is stale after following an annotation link.
   * Sync from the prop instead of relying on a remount.
   */
  useEffect(() => {
    setArrived(focusLive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Position on the focused verse once the passage is ready.
  useEffect(() => {
    if (load !== "ready" || !arrived) return;
    const idx = state.verses.findIndex((v) => v.number === arrived.verse);
    if (idx >= 0 && idx !== state.vIdx) engine.loadVerseAudio(idx, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, arrived, state.verses.length]);

  // Apply a mode carried in the URL (from the Practise sheet).
  useEffect(() => {
    if (load !== "ready") return;
    const m = modeParam as Mode | null;
    const valid: Mode[] = ["word", "verse", "masked", "relay"];
    const target = m && valid.includes(m) ? m : "verse";
    if (target === engine.getSnapshot().mode) return;
    engine.setMode(target);
    if (target === "relay") setRelaySheet(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, modeParam]);

  // Resume position carried in the URL (Continue hero / recents).
  useEffect(() => {
    if (load !== "ready" || !atParam) return;
    const idx = engine.getSnapshot().verses.findIndex((v) => v.number === Number(atParam));
    if (idx > 0) engine.loadVerseAudio(idx, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, atParam]);

  // Remember where the reader is, so the Read screen can offer to continue.
  useEffect(() => {
    if (load !== "ready" || !state.passage) return;
    const v = state.verses[state.vIdx];
    const rid = state.reciterId ?? activeReciter;
    if (!v || rid == null) return;
    saveSession({
      chapter,
      from,
      to,
      name: passageName,
      reciterId: rid,
      reciterName: reciterName(rid),
      verse: v.number,
      updatedAt: Date.now(),
    });
    recordDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, state.vIdx, state.reciterId]);

  // Space toggles playback; arrows step verses (matching the transport layout).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.isContentEditable)) return;
      if (document.querySelector(".sheet, .popover")) return;
      if (e.key === " ") {
        e.preventDefault();
        engine.togglePlay();
      } else if (e.key === "ArrowRight") {
        engine.next();
      } else if (e.key === "ArrowLeft") {
        engine.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  // Lock-screen / notification controls for a listening app.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const v = state.verses[state.vIdx];
    if (!state.passage || !v) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${state.passage.name} ${v.key}`,
        artist: reciterName(state.reciterId),
        album: "Hifz",
        artwork: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
      });
      navigator.mediaSession.playbackState = state.playing ? "playing" : "paused";
      navigator.mediaSession.setActionHandler("play", () => engine.togglePlay());
      navigator.mediaSession.setActionHandler("pause", () => engine.togglePlay());
      navigator.mediaSession.setActionHandler("previoustrack", () => engine.prev());
      navigator.mediaSession.setActionHandler("nexttrack", () => engine.next());
    } catch {
      /* older browsers — controls just don't appear */
    }
  }, [engine, state.passage, state.vIdx, state.playing, state.reciterId, state.verses, reciterName]);

  /* ---- annotation layers ---- */

  const annByVerse = useMemo(() => {
    const map = new Map<number, Map<number, WordAnnotation>>();
    if (!ann) return map;
    for (const v of state.verses) {
      map.set(v.number, annotationsForVerse(ann, v.number, state.layers));
    }
    return map;
  }, [ann, state.verses, state.layers]);

  const annFor = useCallback((verseNumber: number) => annByVerse.get(verseNumber), [annByVerse]);

  /** How many marks fall inside the loaded passage, for the layer chips. */
  const layerCounts = useMemo(() => {
    let phrases = 0;
    let confusables = 0;
    if (ann) {
      for (const v of state.verses) {
        phrases += (ann.phrases[String(v.number)] || []).length;
        confusables += (ann.confusables[String(v.number)] || []).length;
      }
    }
    return { phrases, confusables };
  }, [ann, state.verses]);

  const openPhraseSheet = (vIdx: number, pos: number) => {
    setPopover(null);
    setPhraseSheet({ vIdx, pos });
  };

  /**
   * Follow an annotation link to another location. The target word span is
   * carried in the URL so arrival highlights the actual word — landing in the
   * right surah but on no particular word made the link feel broken.
   */
  const goToOccurrence = (
    verseKey: string,
    wordFrom?: number,
    wordTo?: number,
    matchIndex?: number,
    matchTotal?: number,
    g?: string,
  ) => {
    const [s, v] = verseKey.split(":").map(Number);
    if (!s || !v) return;
    setPhraseSheet(null);
    setConfusableSheet(null);

    const wf = wordFrom && wordFrom > 0 ? wordFrom : 0;
    const wt = wordTo && wordTo >= (wf || 1) ? wordTo : wf;

    // Same passage: reposition in place, no navigation.
    const idx = state.verses.findIndex((x) => x.key === verseKey);
    if (idx >= 0) {
      engine.loadVerseAudio(idx, false);
      if (wf) setArrived({ verse: v, from: wf, to: wt });
      return;
    }

    // Otherwise open the target with a couple of verses of context around it.
    const ctxFrom = Math.max(1, v - 1);
    const ctxTo = v + 1;
    const params = new URLSearchParams({ from: String(ctxFrom), to: String(ctxTo) });
    if (state.reciterId) params.set("reciter", String(state.reciterId));
    if (wf) params.set("focus", `${v}-${wf}-${wt}`);
    // Carry what the reader is leaving. When already comparing (stepping
    // between matches), keep the ORIGINAL origin — Return must go back to the
    // passage they started from, not to the previous match.
    if (cameFromLive) {
      params.set("back", cameFromLive);
      if (heldAtLive) params.set("held", String(heldAtLive));
    } else {
      const p = state.passage;
      if (p) params.set("back", `${p.name} ${p.from}${p.to > p.from ? `–${p.to}` : ""}`);
      const heldVerse = state.verses[state.vIdx]?.number;
      if (heldVerse) params.set("held", String(heldVerse));
    }
    if (matchIndex && matchTotal) params.set("match", `${matchIndex}-${matchTotal}`);
    if (g) params.set("g", g);
    /*
     * `replace`, not `push`: the overlay occupies the current history entry, so
     * replacing it means back from the destination lands on the passage the
     * reader left rather than on a re-opened sheet.
     */
    navigatingAway.current = true;
    router.replace(`/read/${s}?${params.toString()}`);
  };

  const setMode = (m: Mode) => {
    setSelection(null);
    setPopover(null);
    engine.setMode(m);
    if (m === "relay") setRelaySheet(true);
  };

  const startRelay = async (order: RelayParticipant[], vFrom: number, vTo: number, rounds: number) => {
    const ok = await engine.beginRelay(order, vFrom, vTo, rounds);
    if (ok) setRelaySheet(false);
  };

  /* ---- render ---- */

  if (appStatus === "error" || load === "error") {
    return (
      <main className="shell" id="main">
        <PlayerHeader
          title={title}
          qariName={reciterName(activeReciter)}
          mode="verse"
          style={state.style}
          onStyle={() => {}}
          onQari={() => {}}
        />
        <OfflineBanner />
        {/* Even when the destination fails, the reader must be able to get
            back to the passage they left. */}
        {cameFromLive && (
          <div className="return-bar">
            <span className="rb-icon">
              <Icon name="pause" size={14} />
            </span>
            <span className="rb-text">
              <b>
                {cameFromLive}
                {heldAtLive ? ` · held at verse ${heldAtLive}` : ""}
              </b>
              <span>Comparing elsewhere — nothing lost</span>
            </span>
            <button className="rb-return" onClick={() => router.back()}>
              <Icon name="corner-up-left" size={14} />
              Return
            </button>
          </div>
        )}
        <div className="status-block">
          <div className="status-medallion">
            <Icon name="volume-x" size={34} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2>Can&rsquo;t reach the recitation</h2>
            <p>
              This passage couldn&rsquo;t be loaded. Check your connection and try again — your place is
              saved.
            </p>
          </div>
          <div className="status-actions">
            <button className="btn-primary" onClick={() => router.refresh()}>
              <Icon name="rotate-cw" size={17} />
              Try again
            </button>
            <button className="btn-secondary" onClick={() => router.push("/")}>
              <Icon name="chevron-left" size={16} />
              Choose another passage
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (load === "loading" || appStatus === "loading") {
    return (
      <main className="shell" id="main">
        <PlayerHeader
          title={title}
          qariName={reciterName(activeReciter)}
          mode="verse"
          style={state.style}
          onStyle={() => {}}
          onQari={() => {}}
        />
        <OfflineBanner />
        <div className="status-block">
          <div className="spinner" />
          <p>{slow ? "Still loading — the connection looks slow." : "Loading passage…"}</p>
        </div>
      </main>
    );
  }

  const viewProps: ViewProps = { engine, state, onWordTap, selection, annFor, arrived };

  const body =
    state.mode === "relay" && state.relay?.active ? (
      <RelayView {...viewProps} />
    ) : state.mode === "masked" ? (
      <MaskedView {...viewProps} />
    ) : state.mode === "word" ? (
      <WordRangeView {...viewProps} />
    ) : state.style === "focus" ? (
      <FocusView {...viewProps} />
    ) : (
      <MushafView {...viewProps} />
    );

  const relaySub = state.relay ? `Relay · ${state.relay.order.length} participants` : undefined;

  return (
    <main className="shell player" id="main">
      <PlayerHeader
        title={title}
        subtitle={relaySub}
        qariName={reciterName(state.reciterId ?? activeReciter)}
        mode={state.mode}
        style={state.style}
        onStyle={(s) => engine.setStyle(s)}
        onQari={() => setQariSheet(true)}
        matchLabel={
          arrived && gParam && ann?.groups[gParam]
            ? (() => {
                const occ = ann.groups[gParam]!.occ;
                const i = occ.findIndex((o) => o.k === `${chapter}:${arrived.verse}` && o.f === arrived.from);
                return i >= 0 ? `Match ${i + 1} of ${occ.length}` : null;
              })()
            : matchOfLive
              ? `Match ${matchOfLive.split("-")[0]} of ${matchOfLive.split("-")[1]}`
              : null
        }
        backLabel={cameFromLive ? cameFromLive.split(" ")[0] : null}
        onEditRelay={() => {
          engine.pauseRelayForEdit();
          setRelaySheet(true);
        }}
      />

      <OfflineBanner />

      {state.mode !== "relay" && (
        <LayerBar
          layers={state.layers}
          counts={layerCounts}
          onToggle={(layer, on) => engine.setLayer(layer, on)}
        />
      )}

      {arrived && cameFromLive && (
        <div className="return-bar">
          <span className="rb-icon">
            <Icon name="pause" size={14} />
          </span>
          <span className="rb-text">
            <b>
              {cameFromLive}
              {heldAtLive ? ` · held at verse ${heldAtLive}` : ""}
            </b>
            <span>Comparing elsewhere — nothing lost</span>
          </span>
          <button className="rb-return" onClick={() => router.back()}>
            <Icon name="corner-up-left" size={14} />
            Return
          </button>
        </div>
      )}

      {/* Step through the group's other occurrences without reopening the sheet. */}
      {arrived && gParam && ann?.groups[gParam] && load === "ready" &&
        (() => {
          const occ = ann.groups[gParam]!.occ;
          const i = occ.findIndex((o) => o.k === `${chapter}:${arrived.verse}` && o.f === arrived.from);
          if (i < 0) return null;
          const prev = occ[i - 1];
          const next = occ[i + 1];
          return (
            <div className="arrive-stepper">
              <button
                className="icon-btn sm tap"
                disabled={!prev}
                onClick={() => prev && goToOccurrence(prev.k, prev.f, prev.t, i, occ.length, gParam)}
                aria-label="Previous occurrence"
              >
                <Icon name="chevron-right" size={19} />
              </button>
              <span className="as-text">
                <b>Step through matches</b>
                <span>{next ? `Next: ${next.k}` : "Last occurrence"}</span>
              </span>
              <button
                className="icon-btn sm tap"
                disabled={!next}
                onClick={() => next && goToOccurrence(next.k, next.f, next.t, i + 2, occ.length, gParam)}
                aria-label="Next occurrence"
              >
                <Icon name="chevron-left" size={19} />
              </button>
            </div>
          );
        })()}

      {/* Twin arrival: hear the vowels clearly before comparing. */}
      {arrived && !gParam && cameFromLive && load === "ready" &&
        (() => {
          const vIdx = state.verses.findIndex((v) => v.number === arrived.verse);
          const w = state.verses[vIdx]?.words.find((x) => x.pos === arrived.from);
          if (!w) return null;
          return (
            <div className="arrive-twin">
              <span className="at-word">
                <span className="ar">{w.ar}</span>
                {w.tr && <span className="tr">{w.tr}</span>}
              </span>
              <button className="at-play" onClick={() => engine.playWordSlow(vIdx, arrived.from)}>
                <Icon name="volume-2" size={15} />
                Play slowly
              </button>
            </div>
          );
        })()}

      {state.pendingLoopStart && !selection && (
        <div className="range-banner">
          <Icon name="brackets" size={17} style={{ color: "var(--action-primary)", flex: "none" }} />
          Start word set — tap the last word of the range
        </div>
      )}

      {body}

      {selection && (
        <div className="range-action-bar">
          <span className="ra-t">
            <b>
              {state.mode === "word" ? "Drill" : "Loop"} words {selection.start}–{selection.end}
            </b>
            <span>
              Verse {state.verses[selection.vIdx]?.key} ·{" "}
              {state.loopCount === 0 ? "until stopped" : `×${state.loopCount} passes`}
            </span>
          </span>
          <button
            className="btn-cancel"
            onClick={() => {
              setSelection(null);
              engine.clearPendingLoopStart();
            }}
          >
            Cancel
          </button>
          <button
            className="btn-commit"
            onClick={() => {
              engine.loopWordRange(selection.vIdx, selection.start, selection.end);
              setSelection(null);
            }}
          >
            <Icon name="repeat" size={15} />
            {state.mode === "word" ? "Drill" : "Loop"}
          </button>
        </div>
      )}

      <PlayerFooter engine={engine} state={state} onOpenModeSheet={() => setModeSheet(true)} />

      {popover && popWord && (
        <WordPopover
          word={popWord}
          target={popover}
          loopCount={state.loopCount}
          isWordRangeMode={state.mode === "word"}
          onSetCount={(n) => engine.setLoopCount(n)}
          onPlayWord={() => {
            engine.playWordOneshot(popover.vIdx, popover.pos);
            setPopover(null);
          }}
          onLoopWord={() => {
            engine.loopSingleWord(popover.vIdx, popover.pos, `“${popWord.gloss || popWord.tr || "word"}”`);
            setPopover(null);
          }}
          onStartRange={() => {
            engine.setPendingLoopStart(popover.vIdx, popover.pos);
            setPopover(null);
          }}
          onClose={() => setPopover(null)}
          annotation={annFor(state.verses[popover.vIdx]?.number ?? -1)?.get(popover.pos)}
          onOpenPhrase={() => openPhraseSheet(popover.vIdx, popover.pos)}
          onOpenConfusable={() => {
            const mark = annFor(state.verses[popover.vIdx]?.number ?? -1)?.get(popover.pos)?.confusable;
            setPopover(null);
            if (mark) setConfusableSheet({ mark, vIdx: popover.vIdx });
          }}
        />
      )}

      {phraseSheet &&
        (() => {
          const verse = state.verses[phraseSheet.vIdx];
          if (!verse) return null;
          const groups = phraseGroupsAt(ann, verse.number, phraseSheet.pos);
          if (!groups.length) return null;
          const mark = groups[0]!.mark;
          const hereText = verse.words
            .filter((w) => w.pos >= mark.f && w.pos <= mark.t)
            .map((w) => w.ar)
            .join(" ");
          return (
            <PhraseSheet
              groups={groups}
              hereKey={verse.key}
              hereText={hereText}
              onGo={goToOccurrence}
              onClose={() => setPhraseSheet(null)}
            />
          );
        })()}

      {confusableSheet &&
        (() => {
          const verse = state.verses[confusableSheet.vIdx];
          if (!verse) return null;
          const word = verse.words.find((w) => w.pos === confusableSheet.mark.p);
          return (
            <ConfusableSheet
              mark={confusableSheet.mark}
              verseKey={verse.key}
              gloss={word?.gloss}
              transliteration={word?.tr}
              onPlayWord={() => engine.playWordOneshot(confusableSheet.vIdx, confusableSheet.mark.p)}
              onGo={goToOccurrence}
              onClose={() => setConfusableSheet(null)}
            />
          );
        })()}

      {modeSheet && (
        <PractiseSheet
          surahName={passageName}
          versesCount={chapterMeta?.verses_count ?? to}
          initialFrom={from}
          initialTo={to}
          initialMode={state.mode}
          taj={state.taj}
          onTaj={(on) => engine.setTajweed(on)}
          onStart={(f, t, m) => {
            setModeSheet(false);
            const params = new URLSearchParams({ from: String(f), to: String(t) });
            if (state.reciterId) params.set("reciter", String(state.reciterId));
            if (m !== "verse") params.set("mode", m);
            // If only the mode changed, the passage effect's deps don't fire
            // and the mode param effect switches without a reload.
            navigatingAway.current = true;
            router.replace(`/read/${chapter}?${params.toString()}`);
          }}
          onClose={() => setModeSheet(false)}
        />
      )}

      {qariSheet && (
        <QariSheet
          currentId={state.reciterId}
          onPick={(id, name) => engine.switchReciter(id, name)}
          onClose={() => setQariSheet(false)}
        />
      )}

      {relaySheet && (
        <RelaySetupSheet
          verses={state.verses}
          defaultReciterId={state.reciterId ?? activeReciter ?? 0}
          initial={
            state.relay
              ? {
                  order: state.relay.order,
                  vFrom: state.relay.vFrom,
                  vTo: state.relay.vTo,
                  rounds: state.relay.rounds,
                }
              : undefined
          }
          onStart={startRelay}
          onClose={() => {
            setRelaySheet(false);
            if (!state.relay?.active) engine.setMode("verse");
          }}
        />
      )}
    </main>
  );
}
