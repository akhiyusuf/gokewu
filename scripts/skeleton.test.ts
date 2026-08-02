import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM build script, no type declarations
import { skeleton } from "./build-annotations.mjs";

/**
 * The confusable-word derivation rests entirely on this normalisation: two
 * words are candidates when their consonant skeletons match but their lemmas
 * differ. If it over-normalises, unrelated words collide; if it
 * under-normalises, real near-twins are missed.
 */
describe("skeleton", () => {
  it("strips short vowels and sukun", () => {
    expect(skeleton("مَلِكِ")).toBe("ملك");
    expect(skeleton("مُلْكِ")).toBe("ملك");
  });

  it("collapses alef variants and alef wasla", () => {
    expect(skeleton("ٱلْمُرْسَلِينَ")).toBe(skeleton("الْمُرْسَلِينَ"));
    expect(skeleton("أَنذَرَ")).toBe(skeleton("انذر"));
    expect(skeleton("إِنَّ")).toBe("ان");
    expect(skeleton("آمَنَ")).toBe("امن");
  });

  it("makes the classic near-twins collide", () => {
    // These differ only by vowelling (including shadda, which is stripped as a
    // diacritic) — which is precisely why they are candidate pairs.
    expect(skeleton("أُنذِرَ")).toBe(skeleton("أَنذَرَ"));
    expect(skeleton("تَكْذِبُونَ")).toBe(skeleton("تُكَذِّبُونَ"));
    expect(skeleton("مُنزِلِينَ")).toBe(skeleton("مُنزَلِينَ"));
    expect(skeleton("مَٰلِكِ")).toBe(skeleton("مَّلِكٌ"));
  });

  it("keeps genuinely different consonants apart", () => {
    expect(skeleton("كِتَابٌ")).not.toBe(skeleton("كَاتِبٌ"));
    expect(skeleton("عَلِمَ")).not.toBe(skeleton("عَمِلَ"));
  });

  it("removes superscript alef and tatweel", () => {
    expect(skeleton("عَلَىٰ")).toBe("على");
    expect(skeleton("مـــن")).toBe("من");
  });
});
