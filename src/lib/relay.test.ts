import { describe, expect, it } from "vitest";
import { buildRelayTurns, initials } from "./relay";
import type { RelayParticipant, Verse } from "./types";

function verse(number: number): Verse {
  return {
    key: `2:${number}`,
    number,
    words: [],
    marks: [],
    translation: "",
    audio: null,
  };
}

const verses = [verse(1), verse(2), verse(3), verse(4)];

describe("buildRelayTurns", () => {
  const order: RelayParticipant[] = [
    { kind: "qari", reciterId: 7 },
    { kind: "you" },
  ];

  it("assigns one verse per turn, cycling the order", () => {
    const turns = buildRelayTurns(verses, 1, 4, order, 1, 7);
    expect(turns.map((t) => t.kind)).toEqual(["qari", "you", "qari", "you"]);
    expect(turns.map((t) => t.verseKey)).toEqual(["2:1", "2:2", "2:3", "2:4"]);
  });

  it("rotates the order by one position each round", () => {
    const round2 = buildRelayTurns(verses, 1, 4, order, 2, 7);
    expect(round2.map((t) => t.kind)).toEqual(["you", "qari", "you", "qari"]);
  });

  it("paces a 'you' turn with the most recent qari's audio", () => {
    const mixed: RelayParticipant[] = [
      { kind: "qari", reciterId: 3 },
      { kind: "qari", reciterId: 9 },
      { kind: "you" },
    ];
    const turns = buildRelayTurns(verses, 1, 3, mixed, 1, 1);
    expect(turns[2]).toMatchObject({ kind: "you", reciterId: 9 });
  });

  it("falls back to the main reciter when 'you' leads the order", () => {
    const youFirst: RelayParticipant[] = [{ kind: "you" }, { kind: "qari", reciterId: 5 }];
    const turns = buildRelayTurns(verses, 1, 2, youFirst, 1, 42);
    expect(turns[0]).toMatchObject({ kind: "you", reciterId: 5 });
  });

  it("respects the verse range", () => {
    const turns = buildRelayTurns(verses, 2, 3, order, 1, 7);
    expect(turns.map((t) => t.verseKey)).toEqual(["2:2", "2:3"]);
  });

  it("returns nothing for an empty range", () => {
    expect(buildRelayTurns(verses, 9, 12, order, 1, 7)).toEqual([]);
  });
});

describe("initials", () => {
  it("takes up to two initials", () => {
    expect(initials("Mishary Alafasy")).toBe("MA");
    expect(initials("Al-Husary")).toBe("AH");
    expect(initials("Minshawi")).toBe("M");
  });
  it("falls back to Q when empty", () => {
    expect(initials("")).toBe("Q");
  });
});
