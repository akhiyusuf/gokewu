export interface Chapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name?: { name: string };
  verses_count: number;
}

export interface Recitation {
  id: number;
  name: string;
  style: string;
}

export interface Word {
  pos: number;
  ar: string;
  taj: string | null;
  gloss: string;
  tr: string;
  /** Fallback per-word tajweed HTML when the API doesn't return word-level markup. */
  tajHTML?: string | null;
  /**
   * Reserved for future annotation layers (recurring-phrase / confusable-word
   * highlighting, see supplementary-features doc). Not populated yet — kept
   * here so those layers can attach to existing word elements without a
   * redesign of the word-rendering system.
   */
  recurringPhraseId?: string | null;
  confusableWithLemma?: string | null;
}

export interface VerseMark {
  afterPos: number;
  ar: string;
  kind: string;
}

export interface Segment {
  w: number;
  start: number;
  end: number;
  est?: boolean;
}

export interface VerseAudio {
  url: string;
  segments: Segment[] | null;
}

export interface Verse {
  key: string;
  number: number;
  words: Word[];
  marks: VerseMark[];
  translation: string;
  audio: VerseAudio | null;
  /** Cached estimated segments + the duration they were computed for. */
  _est?: Segment[] | null;
  _estDur?: number;
  _phrases?: Word[][];
}

export type Mode = "word" | "verse" | "masked" | "relay";
export type Style = "mushaf" | "focus";

export interface RecentEntry {
  chapter: number;
  from: number;
  to: number;
  name: string;
  reciter: string;
}

export interface LoopState {
  vIdx: number;
  startW: number;
  endW: number;
  passes: number;
  pass: number;
  label: string;
}

export interface WordDrillRange {
  startW: number;
  endW: number;
  passes: number;
  pass: number;
}

export type RelayParticipant =
  | { kind: "you" }
  | { kind: "qari"; reciterId: number };

export interface RelayTurn {
  kind: "you" | "qari";
  reciterId: number;
  verseKey: string;
}

export interface RelayDraft {
  key: string;
  order: RelayParticipant[];
  vFrom: number;
  vTo: number;
  rounds: number;
}

export interface RelayState {
  order: RelayParticipant[];
  vFrom: number;
  vTo: number;
  rounds: number;
  round: number;
  idx: number;
  active: boolean;
  waitingTap: boolean;
  replaying?: boolean;
  turns: RelayTurn[];
}

export interface MaskState {
  maxRev: number;
  peeks: number;
}
