"use client";

import { Icon } from "@/components/shared/Icon";
import { VerseBlock } from "../VerseBlock";
import type { ViewProps } from "./types";

/**
 * The most emotionally exposed surface in the app: the user is being tested
 * on scripture they are trying to hold, and failing is the normal case. The
 * copy stays neutral and the peek allowance is framed as available help
 * rather than as a penalty.
 */
export function MaskedView({ engine, state }: ViewProps) {
  const v = state.verses[state.vIdx];
  if (!v) return null;

  const m = engine.maskStateFor(v);
  const total = v.words.length;
  const pct = total ? Math.round((m.maxRev / total) * 100) : 0;
  const allRevealed = m.maxRev >= total;

  return (
    <div className="player-body">
      <div className="mask-meter-row">
        <div className="mask-meter-head">
          <b>
            Revealed {m.maxRev} of {total}
          </b>
          <span>Verse {v.key}</span>
        </div>
        <div
          className="mask-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={m.maxRev}
          aria-label="Words revealed"
        >
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="masked-verse">
        <VerseBlock
          verse={v}
          vIdx={state.vIdx}
          taj={state.taj}
          curWord={state.curWord}
          done={false}
          rangeStart={0}
          rangeEnd={0}
          pendingPos={0}
          revealUpTo={m.maxRev}
          masked
          interactive={false}
        />
      </div>

      <div className="peek-row">
        <button
          className="peek-btn"
          onClick={() => engine.peek()}
          disabled={m.peeks <= 0 || allRevealed}
        >
          <Icon name="eye" size={17} />
          {allRevealed ? "Verse revealed" : `Peek · ${m.peeks} left`}
        </button>
      </div>

      {v.translation && (
        <div className="trans-card" style={{ margin: "0 20px 12px" }}>
          <div className="trans-meta">
            <b>{v.key.replace(":", " : ")}</b>
            <span>{state.translationName}</span>
          </div>
          <p>{v.translation}</p>
        </div>
      )}
    </div>
  );
}
