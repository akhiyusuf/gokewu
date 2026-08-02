"use client";

import { Icon } from "@/components/shared/Icon";
import { useAppData } from "@/components/providers/AppDataProvider";
import { VerseBlock } from "../VerseBlock";
import type { ViewProps } from "./types";

export function RelayView({ engine, state }: ViewProps) {
  const { reciterName } = useAppData();
  const R = state.relay;
  if (!R) return null;

  const turn = R.turns[R.idx];
  const v = state.verses[state.vIdx];
  if (!turn || !v) return null;

  const isYou = turn.kind === "you";
  const turnsLeft = R.turns.length - R.idx;

  return (
    <div className="player-body">
      <div className="relay-round">
        <b>{R.rounds === 0 ? `Round ${R.round}` : `Round ${R.round} of ${R.rounds}`}</b>
        <span>
          {turnsLeft} {turnsLeft === 1 ? "turn" : "turns"} left
        </span>
      </div>

      <ol className="relay-queue" aria-label="Turn order">
        {R.turns.map((t, i) => {
          const done = i < R.idx;
          const now = i === R.idx;
          const who = t.kind === "you" ? "You" : reciterName(t.reciterId).split(" ")[0];
          return (
            <li
              key={`${t.verseKey}-${i}`}
              className={`turn-chip${done ? " done" : ""}${now ? " now" : ""}`}
              aria-current={now ? "step" : undefined}
            >
              <span className="turn-avatar">
                <Icon name={t.kind === "you" ? "user" : "mic"} size={14} />
                {done && (
                  <span className="turn-check">
                    <Icon name="check" size={9} />
                  </span>
                )}
              </span>
              {!done && (
                <span className="turn-text">
                  <b>{who}</b>
                  <span>{t.verseKey.split(":")[1]}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {isYou && (
        <div className="your-turn">
          <Icon name="mic" size={18} style={{ color: "var(--action-primary)", flex: "none" }} />
          <span className="yt">
            <b>Your turn — recite aloud</b>
            {/* The muted-pacing mechanic is the core of relay and is not
                self-evident from a label, so it is explained here, at the
                moment it happens. */}
            <span>Qari plays muted to pace you</span>
          </span>
        </div>
      )}

      <div className="relay-verse">
        <div className="ar">
          <VerseBlock
            verse={v}
            vIdx={state.vIdx}
            taj={state.taj}
            curWord={state.curWord}
            done={false}
            rangeStart={0}
            rangeEnd={0}
            pendingPos={0}
            revealUpTo={0}
            masked={false}
            interactive={false}
          />
        </div>
        {v.translation && <p className="gl">{v.translation}</p>}
        {!isYou && (
          <p className="gl">
            {reciterName(turn.reciterId)} recites verse {turn.verseKey.split(":")[1]}
            {R.waitingTap ? " — tap play to begin" : ""}
          </p>
        )}
      </div>

      {isYou && (
        <div className="relay-actions">
          <button className="replay" onClick={() => engine.startRelayTurn(true)}>
            <Icon name="volume-2" size={16} style={{ color: "var(--action-primary)" }} />
            Replay qari
          </button>
          <button className="skip" onClick={() => engine.advanceRelay()}>
            <Icon name="skip-forward" size={16} />
            Skip my turn
          </button>
        </div>
      )}
    </div>
  );
}
