import type { Verse, Word } from "./types";

const PAUSE_MARK = /[ۖ-ۜ]/;

/**
 * Segments a verse into short phrases for Focus style, split at Quranic
 * pause marks and capped at 6 words. A trailing fragment of ≤2 words merges
 * into the previous phrase rather than standing alone. Cached on the verse.
 */
export function phrasesOf(v: Verse): Word[][] {
  if (v._phrases) return v._phrases;
  const out: Word[][] = [];
  let buf: Word[] = [];
  const markSet = new Set(v.marks.filter((m) => PAUSE_MARK.test(m.ar)).map((m) => m.afterPos));
  for (const w of v.words) {
    buf.push(w);
    if (markSet.has(w.pos) || PAUSE_MARK.test(w.ar) || buf.length >= 6) {
      out.push(buf);
      buf = [];
    }
  }
  if (buf.length) {
    if (out.length && buf.length <= 2) {
      out[out.length - 1] = out[out.length - 1]!.concat(buf);
    } else {
      out.push(buf);
    }
  }
  v._phrases = out.length ? out : [v.words];
  return v._phrases;
}
