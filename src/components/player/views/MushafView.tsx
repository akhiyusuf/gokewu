"use client";

import { useEffect, useRef } from "react";
import { VerseBlock } from "../VerseBlock";
import { rangeFor, type ViewProps } from "./types";

const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export function MushafView({ engine, state, onWordTap, selection, annFor, arrived }: ViewProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const cur = state.verses[state.vIdx];

  // Keep the recited word in view without yanking the page on every change.
  useEffect(() => {
    const el = bodyRef.current?.querySelector<HTMLElement>('[data-cur="1"]');
    const box = bodyRef.current;
    if (!el || !box) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top < b.top + 48 || r.bottom > b.bottom - 48) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state.curWord, state.vIdx]);

  // Land the reader on the word they followed a link to.
  useEffect(() => {
    if (!arrived) return;
    const el = bodyRef.current?.querySelector<HTMLElement>('[data-arrived="1"]');
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [arrived, state.verses]);

  const p = state.passage;
  // Al-Fatiha counts the basmala as verse 1, and At-Tawbah has none.
  const showBasmala = !!p && p.from === 1 && p.chapter !== 1 && p.chapter !== 9;

  return (
    <div ref={bodyRef} className="player-body" style={{ padding: "16px 20px 6px" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0 }}>
        {showBasmala && <div className="basmala">{BASMALA}</div>}

        <div className="mushaf">
          {state.verses.map((v, i) => {
            const r = rangeFor(i, state, selection);
            return (
              <VerseBlock
                key={v.key}
                verse={v}
                vIdx={i}
                taj={state.taj}
                curWord={i === state.vIdx ? state.curWord : 0}
                done={engine.isVerseDone(i)}
                rangeStart={r.start}
                rangeEnd={r.end}
                pendingPos={r.pending}
                revealUpTo={0}
                masked={false}
                interactive
                annotations={annFor(v.number)}
                arrivedFrom={arrived?.verse === v.number ? arrived.from : 0}
                arrivedTo={arrived?.verse === v.number ? arrived.to : 0}
                onWordTap={onWordTap}
                onMarkTap={(vi) => engine.jumpToVerse(vi)}
              />
            );
          })}
        </div>

        {cur?.translation && (
          <div className="trans-card">
            <div className="trans-meta">
              <b>{cur.key.replace(":", " : ")}</b>
              <span>{state.translationName}</span>
            </div>
            <p>{cur.translation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
