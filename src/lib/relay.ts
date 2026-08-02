import type { RelayParticipant, RelayTurn, Verse } from "./types";

/**
 * One verse per turn, cycling through the participant order. Each round the
 * order rotates by one position so participants get different verses next
 * time around.
 */
export function buildRelayTurns(
  verses: Verse[],
  vFrom: number,
  vTo: number,
  order: RelayParticipant[],
  round: number,
  fallbackReciterId: number,
): RelayTurn[] {
  const inRange = verses.filter((v) => v.number >= vFrom && v.number <= vTo);
  const offset = (round - 1) % order.length;
  const turns: RelayTurn[] = [];
  const firstQari = order.find((p): p is Extract<RelayParticipant, { kind: "qari" }> => p.kind === "qari");
  let lastQari = firstQari ? firstQari.reciterId : fallbackReciterId;
  for (let i = 0; i < inRange.length; i++) {
    const p = order[(i + offset) % order.length]!;
    if (p.kind === "qari") {
      lastQari = p.reciterId;
      turns.push({ kind: "qari", reciterId: p.reciterId, verseKey: inRange[i]!.key });
    } else {
      turns.push({ kind: "you", reciterId: lastQari, verseKey: inRange[i]!.key });
    }
  }
  return turns;
}

export function initials(name: string): string {
  return (
    name
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase() || "Q"
  );
}
