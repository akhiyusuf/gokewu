"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/shared/Icon";
import { REPEAT_CHOICES } from "@/lib/constants";
import type { Word } from "@/lib/types";

const WIDTH = 262;

export interface PopoverTarget {
  vIdx: number;
  pos: number;
  rect: DOMRect;
}

function countLabel(n: number) {
  return n === 0 ? "∞" : `×${n}`;
}

export function WordPopover({
  word,
  target,
  loopCount,
  isWordRangeMode,
  onSetCount,
  onPlayWord,
  onLoopWord,
  onStartRange,
  onClose,
}: {
  word: Word;
  target: PopoverTarget;
  loopCount: number;
  isWordRangeMode: boolean;
  onSetCount: (n: number) => void;
  onPlayWord: () => void;
  onLoopWord: () => void;
  onStartRange: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flipped: boolean } | null>(null);

  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 240;
    const r = target.rect;
    const left = Math.min(window.innerWidth - WIDTH - 10, Math.max(10, r.left + r.width / 2 - WIDTH / 2));
    // Flip above the word if the card would overflow the viewport.
    const below = r.bottom + 12;
    const flipped = below + h > window.innerHeight - 12;
    setPos({ top: flipped ? Math.max(10, r.top - h - 12) : below, left, flipped });
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const verb = isWordRangeMode ? "Drill" : "Loop";

  return (
    <div className="pop-wrap" onClick={onClose}>
      <div
        className="popover"
        ref={ref}
        role="dialog"
        aria-label={`Study ${word.ar}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          top: pos?.top ?? -9999,
          left: pos?.left ?? 0,
          visibility: pos ? "visible" : "hidden",
        }}
      >
        <span
          className={`p-arrow ${pos?.flipped ? "down" : "up"}`}
          style={{
            left: Math.min(
              WIDTH - 20,
              Math.max(20, target.rect.left + target.rect.width / 2 - (pos?.left ?? 0)),
            ),
          }}
        />

        <div className="p-word">
          <span className="ar">{word.ar}</span>
          {word.tr && <span className="tr">{word.tr}</span>}
          <span className="gl">{word.gloss || "—"}</span>
        </div>

        <div className="p-repeat">
          <span id="rep-lbl">Repeat</span>
          <div className="seg" role="group" aria-labelledby="rep-lbl">
            {REPEAT_CHOICES.map((n) => (
              <button
                key={n}
                className={loopCount === n ? "on" : ""}
                onClick={() => onSetCount(n)}
                aria-pressed={loopCount === n}
                style={n === 0 ? { fontFamily: "var(--font-body)", fontSize: 14 } : undefined}
              >
                {countLabel(n)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-actions">
          <button className="sec" onClick={onPlayWord}>
            <Icon name="volume-2" size={15} style={{ color: "var(--action-primary)" }} />
            Play this word
          </button>
          <button className="pri" onClick={onLoopWord}>
            <Icon name="repeat" size={15} />
            {verb} this word {countLabel(loopCount)}
          </button>
        </div>

        <button className="p-tertiary" onClick={onStartRange}>
          <Icon name="brackets" size={14} />
          Start {verb.toLowerCase()} range here
        </button>
      </div>
    </div>
  );
}
