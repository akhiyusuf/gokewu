"use client";

import { Icon } from "@/components/shared/Icon";
import { phrasesOf } from "@/lib/focus";
import { WordSpan } from "../WordSpan";
import type { ViewProps } from "./types";

export function FocusView({ engine, state, onWordTap, selection }: ViewProps) {
  void selection;
  const v = state.verses[state.vIdx];
  if (!v) return null;

  const phrases = phrasesOf(v);
  const idx = Math.min(state.focusPhrase, phrases.length - 1);
  const phrase = phrases[idx];
  const next = phrases[idx + 1];
  if (!phrase) return null;

  const gloss = phrase
    .map((w) => w.gloss)
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="player-body focus-body">
      <span className="focus-counter">
        Phrase {idx + 1} of {phrases.length}
      </span>

      <div className="focus-phrase">
        <div className="focus-ar">
          {phrase.map((w) => (
            <WordSpan
              key={w.pos}
              word={w}
              vIdx={state.vIdx}
              taj={false}
              isCur={w.pos === state.curWord}
              inRange={false}
              isRangeStart={false}
              isRangeEnd={false}
              isPending={state.pendingLoopStart?.w === w.pos}
              mask={null}
              interactive
              onTap={onWordTap}
            />
          ))}
        </div>
        {gloss && <p className="focus-gloss">{gloss}</p>}
      </div>

      {next && (
        <div className="focus-next">
          <span className="lbl">Next</span>
          <span className="ar">{next.map((w) => w.ar).join(" ")}</span>
        </div>
      )}

      <div className="focus-nav">
        {/* RTL content: "previous" points right. */}
        <button className="nav-btn tap" onClick={() => engine.stepPhrase(-1)} aria-label="Previous phrase">
          <Icon name="chevron-right" size={22} />
        </button>
        <button className="loop-btn" onClick={() => engine.loopPhrase(5)}>
          <Icon name="repeat" size={16} style={{ color: "var(--action-primary)" }} />
          Loop ×5
        </button>
        <button className="nav-btn tap" onClick={() => engine.stepPhrase(1)} aria-label="Next phrase">
          <Icon name="chevron-left" size={22} />
        </button>
      </div>
    </div>
  );
}
