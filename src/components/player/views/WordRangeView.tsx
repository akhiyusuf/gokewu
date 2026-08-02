"use client";

import { Icon } from "@/components/shared/Icon";
import { VerseBlock } from "../VerseBlock";
import { rangeFor, type ViewProps } from "./types";

const REPEATS = [1, 2, 3, 0];

/**
 * Word range drills a span the reader selects. With no span chosen it falls
 * back to stepping word-by-word through the verse, which is the plain
 * pronunciation drill.
 */
export function WordRangeView({ engine, state, onWordTap, selection }: ViewProps) {
  const v = state.verses[state.vIdx];
  if (!v) return null;

  const paint = rangeFor(state.vIdx, state, selection);
  const range = state.wordStep.range;
  const curPos = state.wordStep.w || state.curWord || 1;
  const spanWords = range
    ? v.words.filter((w) => w.pos >= range.startW && w.pos <= range.endW)
    : v.words.filter((w) => w.pos === curPos);

  const heroAr = spanWords.map((w) => w.ar).join(" ");
  const heroTr = spanWords
    .map((w) => w.tr)
    .filter(Boolean)
    .join(" ");
  const heroGloss = spanWords
    .map((w) => w.gloss)
    .filter(Boolean)
    .join(" · ");

  const passes = range?.passes ?? 0;
  const pass = range?.pass ?? 0;

  return (
    <div className="player-body">
      <div className="range-bar">
        <span className="rb-t">
          <b>
            {range ? `Words ${range.startW}–${range.endW}` : `Word ${curPos} of ${v.words.length}`} ·{" "}
            {state.passage?.name} {v.key}
          </b>
          <span>{range ? "Looping selected span" : "Tap a word to set a span"}</span>
        </span>
        <div className="rep-seg" role="group" aria-label="Repeats per word">
          {REPEATS.map((n) => (
            <button
              key={n}
              className={`${state.wordRepeat === n ? "on" : ""}${n === 0 ? " inf" : ""}`}
              onClick={() => engine.setWordRepeat(n === 0 ? 1 : n)}
              aria-pressed={state.wordRepeat === n}
            >
              {n === 0 ? "∞" : `×${n}`}
            </button>
          ))}
        </div>
      </div>

      <div className="wr-hero">
        <span className="ar">{heroAr}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {heroTr && <span className="tr">{heroTr}</span>}
          {heroGloss && <span className="gl">{heroGloss}</span>}
        </div>

        {range && passes > 0 && (
          <div className="pass-dots">
            {Array.from({ length: passes }, (_, i) => (
              <i key={i} className={i < pass ? "on" : ""} />
            ))}
            <span>
              Pass {Math.min(pass + 1, passes)} of {passes}
            </span>
          </div>
        )}
      </div>

      <div className="wr-verse">
        <div className="ar">
          <VerseBlock
            verse={v}
            vIdx={state.vIdx}
            taj={state.taj}
            curWord={state.curWord}
            done={false}
            rangeStart={paint.start}
            rangeEnd={paint.end}
            pendingPos={paint.pending}
            revealUpTo={0}
            masked={false}
            interactive
            onWordTap={onWordTap}
          />
        </div>
        <span className="wr-hint">
          <Icon name="pointer" size={13} />
          Tap words to change the range
        </span>
      </div>
    </div>
  );
}
