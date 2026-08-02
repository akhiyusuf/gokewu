import type { WordAnnotation } from "@/lib/annotations";
import type { EngineState, PlaybackEngine } from "@/lib/engine";

/** In-progress two-step range selection, before it is committed to a loop. */
export interface Selection {
  vIdx: number;
  start: number;
  end: number;
}

export interface ViewProps {
  engine: PlaybackEngine;
  state: EngineState;
  onWordTap: (vIdx: number, pos: number, el: HTMLElement) => void;
  selection: Selection | null;
  /** Static annotations for a verse, keyed by word position. */
  annFor: (verseNumber: number) => Map<number, WordAnnotation> | undefined;
}

/** Resolves which word span a verse should paint as "in range". */
export function rangeFor(
  vIdx: number,
  state: EngineState,
  selection: Selection | null,
): { start: number; end: number; pending: number } {
  if (selection && selection.vIdx === vIdx) {
    return { start: selection.start, end: selection.end, pending: selection.end };
  }
  if (state.loop && state.loop.vIdx === vIdx) {
    return { start: state.loop.startW, end: state.loop.endW, pending: 0 };
  }
  if (state.mode === "word" && state.wordStep.range && vIdx === state.vIdx) {
    return { start: state.wordStep.range.startW, end: state.wordStep.range.endW, pending: 0 };
  }
  const pending = state.pendingLoopStart?.vIdx === vIdx ? state.pendingLoopStart.w : 0;
  return { start: 0, end: 0, pending };
}
