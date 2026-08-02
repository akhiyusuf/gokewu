"use client";

import { Icon, type IconName } from "@/components/shared/Icon";
import { MODES } from "@/lib/constants";
import type { EngineState, PlaybackEngine } from "@/lib/engine";
import { SeekBar } from "./SeekBar";

/**
 * All three repeat concepts surface here in one place so the user can always
 * tell what is repeating and how much of it remains (ui-requirements §6):
 * a word/phrase/span loop and a word-range drill both render the same chip,
 * and verse-repeat is the toggle in the transport row.
 */
export function PlayerFooter({
  engine,
  state,
  onOpenModeSheet,
}: {
  engine: PlaybackEngine;
  state: EngineState;
  onOpenModeSheet: () => void;
}) {
  const mode = MODES.find((m) => m.id === state.mode) || MODES[1]!;
  const isRelay = state.mode === "relay";
  const isWordRange = state.mode === "word";
  const drill = state.wordStep.range;

  const chip = state.loop
    ? {
        label: `${state.loop.label} · pass ${Math.min(state.loop.pass + 1, state.loop.passes || state.loop.pass + 1)}${
          state.loop.passes ? ` of ${state.loop.passes}` : " · until stopped"
        }`,
        clear: () => engine.clearLoop(),
      }
    : drill
      ? {
          label: `Drill: words ${drill.startW}–${drill.endW} · pass ${Math.min(
            drill.pass + 1,
            drill.passes || drill.pass + 1,
          )}${drill.passes ? ` of ${drill.passes}` : " · until stopped"}`,
          clear: () => engine.clearDrill(),
        }
      : null;

  return (
    <footer className="player-foot">
      {chip && (
        <div className="loop-chip">
          <Icon name="repeat" size={15} style={{ color: "var(--action-primary)", flex: "none" }} />
          <span>{chip.label}</span>
          <button className="tap" onClick={chip.clear} aria-label="Stop repeating">
            <Icon name="x" size={15} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
      )}

      {/* Word range steps word-by-word with gaps, so a continuous scrubber
          would be misleading there. */}
      {!isWordRange && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SeekBar engine={engine} disabled={isRelay} />
          <button
            className="speed-btn tap"
            onClick={() => engine.cycleRate()}
            aria-label={`Playback speed ${state.rate}×. Tap to change`}
          >
            {state.rate === 0.75 ? "¾" : state.rate}×
          </button>
        </div>
      )}

      <div className="transport">
        <button
          className="tr-btn tap"
          onClick={() => engine.prev()}
          aria-label={isWordRange ? "Previous word" : "Previous verse"}
        >
          <Icon name={(isWordRange ? "chevron-right" : "skip-back") as IconName} size={isWordRange ? 24 : 22} />
        </button>

        <button
          className={`tr-btn tap${state.verseLoop ? " on" : " muted"}`}
          onClick={() => engine.toggleVerseLoop()}
          aria-label="Repeat this verse"
          aria-pressed={state.verseLoop}
          disabled={isRelay}
        >
          <Icon name="repeat" size={20} />
        </button>

        <button
          className="play-btn"
          onClick={() => engine.togglePlay()}
          aria-label={state.playing ? "Pause" : "Play"}
        >
          <Icon name={state.playing ? "pause" : "play"} size={26} />
        </button>

        <button className="mode-chip tap" onClick={onOpenModeSheet} aria-label={`Playback mode: ${mode.name}. Change mode`}>
          <Icon name={mode.icon as IconName} size={14} style={{ color: "var(--action-primary)" }} />
          {mode.name}
          <Icon name="chevron-up" size={13} style={{ color: "var(--text-muted)" }} />
        </button>

        <button
          className="tr-btn tap"
          onClick={() => engine.next()}
          aria-label={isWordRange ? "Next word" : "Next verse"}
        >
          <Icon name={(isWordRange ? "chevron-left" : "skip-forward") as IconName} size={isWordRange ? 24 : 22} />
        </button>
      </div>
    </footer>
  );
}
