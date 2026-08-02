import { describe, expect, it } from "vitest";
import { phrasesOf } from "./focus";
import type { Verse, VerseMark, Word } from "./types";

function words(n: number, overrides: Record<number, string> = {}): Word[] {
  return Array.from({ length: n }, (_, i) => ({
    pos: i + 1,
    ar: overrides[i + 1] ?? `w${i + 1}`,
    taj: null,
    gloss: "",
    tr: "",
  }));
}

function verse(w: Word[], marks: VerseMark[] = []): Verse {
  return { key: "2:1", number: 1, words: w, marks, translation: "", audio: null };
}

describe("phrasesOf", () => {
  it("caps phrases at 6 words", () => {
    const out = phrasesOf(verse(words(12)));
    expect(out.map((p) => p.length)).toEqual([6, 6]);
  });

  it("splits at a pause mark carried on a mark token", () => {
    const v = verse(words(8), [{ afterPos: 3, ar: "ۖ", kind: "pause" }]);
    const out = phrasesOf(v);
    expect(out[0]).toHaveLength(3);
  });

  it("merges a trailing fragment of 2 or fewer words into the previous phrase", () => {
    // 8 words: first phrase takes 6, remaining 2 should merge back
    const out = phrasesOf(verse(words(8)));
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(8);
  });

  it("keeps a trailing fragment of 3+ words as its own phrase", () => {
    const out = phrasesOf(verse(words(9)));
    expect(out.map((p) => p.length)).toEqual([6, 3]);
  });

  it("returns the whole verse when there is nothing to split", () => {
    const out = phrasesOf(verse(words(3)));
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(3);
  });

  it("caches the result on the verse", () => {
    const v = verse(words(4));
    const a = phrasesOf(v);
    const b = phrasesOf(v);
    expect(a).toBe(b);
  });
});
