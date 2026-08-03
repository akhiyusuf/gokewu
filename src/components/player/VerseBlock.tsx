"use client";

import { memo, Fragment } from "react";
import { toArabicNum } from "@/lib/segments";
import type { WordAnnotation } from "@/lib/annotations";
import type { Verse } from "@/lib/types";
import { WordSpan, type MaskPhase } from "./WordSpan";

export interface VerseBlockProps {
  verse: Verse;
  vIdx: number;
  taj: boolean;
  /** Word position currently recited in THIS verse, or 0. */
  curWord: number;
  done: boolean;
  rangeStart: number;
  rangeEnd: number;
  pendingPos: number;
  /** Words at or below this position are revealed; 0 disables masking. */
  revealUpTo: number;
  masked: boolean;
  interactive: boolean;
  /** Per-word static annotations, keyed by word position. */
  annotations?: Map<number, WordAnnotation>;
  /** Word span the reader was sent to, highlighted on arrival. */
  arrivedFrom?: number;
  arrivedTo?: number;
  onWordTap?: (vIdx: number, pos: number, el: HTMLElement) => void;
  onMarkTap?: (vIdx: number) => void;
}

function VerseBlockBase({
  verse,
  vIdx,
  taj,
  curWord,
  done,
  rangeStart,
  rangeEnd,
  pendingPos,
  revealUpTo,
  masked,
  interactive,
  annotations,
  arrivedFrom = 0,
  arrivedTo = 0,
  onWordTap,
  onMarkTap,
}: VerseBlockProps) {
  // Non-word tokens (pause marks, sajdah) are re-inserted after the word they
  // follow; the verse-end number is rendered as a marker instead.
  const marksAfter = new Map<number, string[]>();
  for (const m of verse.marks) {
    if (m.kind === "end" || /^[\d٠-٩۰-۹]/.test(m.ar)) continue;
    const list = marksAfter.get(m.afterPos) || [];
    list.push(m.ar);
    marksAfter.set(m.afterPos, list);
  }

  return (
    <span className={`v${done ? " done" : ""}`} data-vi={vIdx}>
      {verse.words.map((w) => {
        const inRange = rangeStart > 0 && w.pos >= rangeStart && w.pos <= rangeEnd;
        const mask: MaskPhase = masked ? (w.pos <= revealUpTo ? "revealed" : "hidden") : null;
        // A phrase is one thing, so its marker must be one line: when the next
        // word continues the same phrase, the joining space is underlined too
        // instead of leaving a gap at every word boundary.
        const a = annotations?.get(w.pos);
        const joinPhrase =
          !masked && a?.phrase && !a.phraseEnd && !marksAfter.get(w.pos) ? a.phrase : null;
        return (
          <Fragment key={w.pos}>
            <WordSpan
              word={w}
              vIdx={vIdx}
              taj={taj}
              isCur={w.pos === curWord}
              inRange={inRange}
              isRangeStart={inRange && w.pos === rangeStart}
              isRangeEnd={inRange && w.pos === rangeEnd}
              isPending={pendingPos === w.pos}
              mask={mask}
              interactive={interactive}
              isArrived={arrivedFrom > 0 && w.pos >= arrivedFrom && w.pos <= arrivedTo}
              annotation={annotations?.get(w.pos)}
              onTap={onWordTap}
            />
            {marksAfter.get(w.pos)?.map((mk, i) => (
              <span key={i} style={{ color: "var(--text-muted)" }}>
                {mk}
              </span>
            ))}
            {joinPhrase ? <span className={`recurring-join${joinPhrase.v ? " variant" : ""}`}> </span> : " "}
          </Fragment>
        );
      })}
      <span
        className="vmark"
        role={onMarkTap ? "button" : undefined}
        tabIndex={onMarkTap ? 0 : undefined}
        aria-label={onMarkTap ? `Play verse ${verse.key}` : undefined}
        onClick={onMarkTap ? () => onMarkTap(vIdx) : undefined}
        onKeyDown={
          onMarkTap
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onMarkTap(vIdx);
                }
              }
            : undefined
        }
      >
        {toArabicNum(verse.number)}
      </span>{" "}
    </span>
  );
}

export const VerseBlock = memo(VerseBlockBase);
