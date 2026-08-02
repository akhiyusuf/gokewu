import type { Segment, Verse } from "./types";

/**
 * Accepts raw segments as `[w, start, end]` or `[w, ?, start, end]` in ms.
 * Auto-detects 0- vs 1-based word indices: the live quran.com API is
 * 0-based, other datasets are 1-based — normalises everything to 1-based.
 */
export function parseSegments(raw: unknown, wordCount: number): Segment[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  let out: Segment[] = [];
  for (const s of raw) {
    if (!Array.isArray(s) || s.length < 3) continue;
    const w = Number(s[0]);
    let a = Number(s[s.length - 2]);
    let b = Number(s[s.length - 1]);
    if (!isFinite(w) || !isFinite(a) || !isFinite(b)) continue;
    if (b < a) {
      const t = a;
      a = b;
      b = t;
    }
    out.push({ w, start: a / 1000, end: b / 1000 });
  }
  if (!out.length) return null;
  const ws = out.map((s) => s.w);
  const hasZero = ws.includes(0);
  const maxW = Math.max(...ws);
  const zeroBased = hasZero || (!!wordCount && maxW === wordCount - 1 && !ws.includes(wordCount));
  if (zeroBased) for (const s of out) s.w += 1;
  if (wordCount) out = out.filter((s) => s.w >= 1 && s.w <= wordCount);
  if (!out.length) return null;
  out.sort((x, y) => x.start - y.start);
  return out;
}

/** Fallback when a reciter has no word-level segments: divide duration evenly. */
export function estimateSegments(duration: number, wordCount: number): Segment[] | null {
  if (!isFinite(duration) || duration <= 0 || !wordCount) return null;
  const per = duration / wordCount;
  const out: Segment[] = [];
  for (let i = 0; i < wordCount; i++) {
    out.push({ w: i + 1, start: i * per, end: (i + 1) * per, est: true });
  }
  return out;
}

/**
 * Resolves the segment list for a verse, estimating (and caching the
 * estimate) if the verse is the one currently loaded and has a known
 * duration but no real segments.
 */
export function segsFor(verse: Verse, isCurrent: boolean, duration: number): Segment[] | null {
  const a = verse.audio;
  if (!a) return null;
  if (a.segments && a.segments.length) return a.segments;
  if (isCurrent && isFinite(duration) && duration > 0) {
    if (!verse._est || verse._estDur !== duration) {
      verse._est = estimateSegments(duration, verse.words.length);
      verse._estDur = duration;
    }
    return verse._est;
  }
  return null;
}

export function wordAt(segs: Segment[] | null, t: number): number {
  if (!segs) return 0;
  let cur = 0;
  for (const s of segs) {
    if (t >= s.start - 0.02) cur = s.w;
    if (t < s.end) break;
  }
  return cur;
}

export function segForWord(segs: Segment[] | null, w: number): Segment | null {
  if (!segs) return null;
  for (const s of segs) if (s.w === w) return s;
  return null;
}

export function fmtTime(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function toArabicNum(n: number): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
}
