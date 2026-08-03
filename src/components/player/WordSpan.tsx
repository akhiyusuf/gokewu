"use client";

import { memo } from "react";
import { tajToSpans } from "@/lib/tajweed";
import type { WordAnnotation } from "@/lib/annotations";
import type { Word } from "@/lib/types";

export type MaskPhase = "hidden" | "revealed" | null;

interface WordCache extends Word {
  _tj?: string | null;
}

/** Tajweed HTML is produced by an inert-document sanitiser (lib/tajweed.ts). */
function inner(w: Word, taj: boolean): { html: string } | null {
  if (!taj) return null;
  const cache = w as WordCache;
  if (cache._tj === undefined) {
    cache._tj = w.taj ? tajToSpans(w.taj) : (w.tajHTML ?? null);
  }
  return cache._tj ? { html: cache._tj } : null;
}

export interface WordSpanProps {
  word: Word;
  vIdx: number;
  taj: boolean;
  isCur: boolean;
  inRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isPending: boolean;
  mask: MaskPhase;
  interactive: boolean;
  /** Part of the span the reader was sent to by an annotation link. */
  isArrived?: boolean;
  annotation?: WordAnnotation;
  onTap?: (vIdx: number, pos: number, el: HTMLElement) => void;
}

function WordSpanBase({
  word,
  vIdx,
  taj,
  isCur,
  inRange,
  isRangeStart,
  isRangeEnd,
  isPending,
  mask,
  interactive,
  isArrived,
  annotation,
  onTap,
}: WordSpanProps) {
  const cls = ["w"];
  if (isCur) cls.push("cur");
  if (inRange) cls.push("inrange");
  if (isRangeStart) cls.push("range-start");
  if (isRangeEnd) cls.push("range-end");
  if (isPending) cls.push("pending");
  if (mask === "hidden") cls.push("masked");
  if (mask === "revealed") cls.push("revealed");
  if (isArrived) cls.push("arrived");
  // Annotation layers use their own channels (see globals.css) so they stay
  // readable underneath the playback states above.
  if (annotation?.phrase && mask !== "hidden") {
    cls.push("recurring");
    if (annotation.phraseStart) cls.push("recurring-start");
    if (annotation.phraseEnd) cls.push("recurring-end");
  }
  if (annotation?.confusable && mask !== "hidden") cls.push("confusable");

  const html = mask === "hidden" ? null : inner(word, taj);

  const common = {
    className: cls.join(" "),
    "data-v": vIdx,
    "data-w": word.pos,
    "data-cur": isCur ? "1" : undefined,
    "data-arrived": isArrived ? "1" : undefined,
  };

  // In masked mode the word is not interactive — the mask is the point.
  if (!interactive) {
    return html ? (
      <span {...common} dangerouslySetInnerHTML={{ __html: html.html }} />
    ) : (
      <span {...common}>{word.ar}</span>
    );
  }

  return (
    <span
      {...common}
      role="button"
      tabIndex={0}
      aria-label={`${word.ar}${word.gloss ? ` — ${word.gloss}` : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onTap?.(vIdx, word.pos, e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onTap?.(vIdx, word.pos, e.currentTarget);
        }
      }}
      {...(html ? { dangerouslySetInnerHTML: { __html: html.html } } : {})}
    >
      {html ? undefined : word.ar}
    </span>
  );
}

export const WordSpan = memo(WordSpanBase);
