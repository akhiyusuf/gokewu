import { describe, expect, it } from "vitest";
import { annotationsForVerse, phraseGroupsAt, type SurahAnnotations } from "./annotations";

const ann: SurahAnnotations = {
  s: 36,
  phrases: {
    "4": [{ g: "16739", f: 1, t: 3, n: 6 }],
    "20": [{ g: "16294", f: 1, t: 2, n: 2, v: 1 }],
  },
  groups: {
    "16739": {
      surahs: 6,
      ayahs: 6,
      count: 6,
      occ: [
        { k: "6:39", f: 15, t: 17, x: "عَلَىٰ صِرَٰطٍ مُّسْتَقِيمٍ" },
        { k: "36:4", f: 1, t: 3, x: "عَلَىٰ صِرَٰطٍ مُّسْتَقِيمٍ" },
      ],
    },
    "16294": { surahs: 2, ayahs: 2, count: 2, occ: [{ k: "36:20", f: 1, t: 2, x: "وَجَآءَ مِنْ" }] },
  },
  confusables: {
    "15": [
      {
        p: 15,
        w: "تَكْذِبُونَ",
        lemma: "كَذَبَ",
        pos: "IV",
        n: 1,
        with: [{ w: "تُكَذِّبُونَ", lemma: "كَذَّبَ", pos: "IV", at: "23:105", n: 9 }],
      },
    ],
  },
};

const both = { phrases: true, confusables: true };

describe("annotationsForVerse", () => {
  it("marks every word inside a phrase span, flagging the ends", () => {
    const m = annotationsForVerse(ann, 4, both);
    expect([...m.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(m.get(1)).toMatchObject({ phraseStart: true, phraseEnd: false });
    expect(m.get(2)).toMatchObject({ phraseStart: false, phraseEnd: false });
    expect(m.get(3)).toMatchObject({ phraseStart: false, phraseEnd: true });
  });

  it("carries the near-variant flag through", () => {
    const m = annotationsForVerse(ann, 20, both);
    expect(m.get(1)?.phrase?.v).toBe(1);
  });

  it("marks a confusable word at its position only", () => {
    const m = annotationsForVerse(ann, 15, both);
    expect(m.get(15)?.confusable?.w).toBe("تَكْذِبُونَ");
    expect(m.get(14)).toBeUndefined();
  });

  it("honours layer toggles independently", () => {
    expect(annotationsForVerse(ann, 4, { phrases: false, confusables: true }).size).toBe(0);
    expect(annotationsForVerse(ann, 15, { phrases: true, confusables: false }).size).toBe(0);
    expect(annotationsForVerse(ann, 15, { phrases: false, confusables: true }).size).toBe(1);
  });

  it("returns an empty map for verses with nothing, and for missing data", () => {
    expect(annotationsForVerse(ann, 99, both).size).toBe(0);
    expect(annotationsForVerse(null, 4, both).size).toBe(0);
  });
});

describe("phraseGroupsAt", () => {
  it("finds the group covering a word", () => {
    const g = phraseGroupsAt(ann, 4, 2);
    expect(g).toHaveLength(1);
    expect(g[0]?.id).toBe("16739");
    expect(g[0]?.group.occ).toHaveLength(2);
  });

  it("returns nothing outside the span", () => {
    expect(phraseGroupsAt(ann, 4, 9)).toEqual([]);
    expect(phraseGroupsAt(null, 4, 1)).toEqual([]);
  });
});
