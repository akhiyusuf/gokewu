import { describe, expect, it } from "vitest";
import { estimateSegments, parseSegments, segForWord, wordAt, toArabicNum, fmtTime } from "./segments";

describe("parseSegments", () => {
  it("normalises 0-based indices to 1-based", () => {
    // live quran.com API shape: [wordIndex, startMs, endMs], 0-based
    const out = parseSegments(
      [
        [0, 0, 500],
        [1, 500, 1200],
        [2, 1200, 1900],
      ],
      3,
    );
    expect(out?.map((s) => s.w)).toEqual([1, 2, 3]);
    expect(out?.[0]).toMatchObject({ start: 0, end: 0.5 });
  });

  it("leaves 1-based indices alone", () => {
    const out = parseSegments(
      [
        [1, 0, 500],
        [2, 500, 1200],
        [3, 1200, 1900],
      ],
      3,
    );
    expect(out?.map((s) => s.w)).toEqual([1, 2, 3]);
  });

  it("accepts the 4-tuple form and uses the last two values as the range", () => {
    const out = parseSegments([[1, 99, 250, 900]], 1);
    expect(out?.[0]).toMatchObject({ w: 1, start: 0.25, end: 0.9 });
  });

  it("swaps reversed start/end pairs", () => {
    const out = parseSegments([[1, 900, 250]], 1);
    expect(out?.[0]).toMatchObject({ start: 0.25, end: 0.9 });
  });

  it("drops segments outside the word count and sorts by start", () => {
    const out = parseSegments(
      [
        [2, 500, 900],
        [1, 0, 500],
        [9, 900, 1200],
      ],
      2,
    );
    expect(out?.map((s) => s.w)).toEqual([1, 2]);
  });

  it("returns null for empty or malformed input", () => {
    expect(parseSegments(null, 3)).toBeNull();
    expect(parseSegments([], 3)).toBeNull();
    expect(parseSegments([["x", "y"]], 3)).toBeNull();
  });
});

describe("estimateSegments", () => {
  it("divides duration evenly and flags the result as estimated", () => {
    const out = estimateSegments(6, 3);
    expect(out).toHaveLength(3);
    expect(out?.[0]).toMatchObject({ w: 1, start: 0, end: 2, est: true });
    expect(out?.[2]).toMatchObject({ w: 3, start: 4, end: 6 });
  });

  it("refuses invalid input", () => {
    expect(estimateSegments(0, 3)).toBeNull();
    expect(estimateSegments(5, 0)).toBeNull();
    expect(estimateSegments(Infinity, 3)).toBeNull();
  });
});

describe("wordAt", () => {
  const segs = parseSegments(
    [
      [1, 0, 500],
      [2, 500, 1200],
      [3, 1200, 1900],
    ],
    3,
  );

  it("returns 0 before any segment starts", () => {
    expect(wordAt(segs, -1)).toBe(0);
  });

  it("tracks the word under the playhead", () => {
    expect(wordAt(segs, 0.1)).toBe(1);
    expect(wordAt(segs, 0.7)).toBe(2);
    expect(wordAt(segs, 1.5)).toBe(3);
  });

  it("holds the last word past the end", () => {
    expect(wordAt(segs, 99)).toBe(3);
  });

  it("returns 0 with no segments", () => {
    expect(wordAt(null, 1)).toBe(0);
  });
});

describe("segForWord", () => {
  const segs = parseSegments(
    [
      [1, 0, 500],
      [2, 500, 1200],
    ],
    2,
  );
  it("finds a segment by word position", () => {
    expect(segForWord(segs, 2)).toMatchObject({ start: 0.5, end: 1.2 });
  });
  it("returns null when absent", () => {
    expect(segForWord(segs, 7)).toBeNull();
    expect(segForWord(null, 1)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats times as m:ss and clamps invalid input", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(65)).toBe("1:05");
    expect(fmtTime(-4)).toBe("0:00");
    expect(fmtTime(NaN)).toBe("0:00");
  });

  it("converts to Arabic-Indic numerals", () => {
    expect(toArabicNum(1)).toBe("١");
    expect(toArabicNum(286)).toBe("٢٨٦");
  });
});
