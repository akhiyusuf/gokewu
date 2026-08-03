"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/Icon";
import { Sheet } from "@/components/shared/Sheet";
import { useDismissOnBack } from "@/lib/useDismissOnBack";

/**
 * Controls the density of the static annotation layers, and explains what the
 * markers mean — an unexplained underline reads as a rendering glitch, not a
 * study aid.
 */
export function LayerBar({
  layers,
  counts,
  onToggle,
}: {
  layers: { phrases: boolean; confusables: boolean };
  counts: { phrases: number; confusables: number };
  onToggle: (layer: "phrases" | "confusables", on: boolean) => void;
}) {
  const [legend, setLegend] = useState(false);
  // Self-contained back handling is safe here: this sheet never hands off to
  // another overlay, which is what made per-surface handling race elsewhere.
  useDismissOnBack(legend, () => setLegend(false));

  // Nothing to annotate in this passage — don't spend a row on it.
  if (!counts.phrases && !counts.confusables) return null;

  return (
    <div className="layer-bar" role="group" aria-label="Annotation layers">
      <Icon name="layers" size={15} style={{ color: "var(--text-muted)", flex: "none" }} />
      <span className="lb-label">Layers</span>

      {counts.phrases > 0 && (
        <button
          className={`layer-chip recurring-chip${layers.phrases ? " on" : ""}`}
          onClick={() => onToggle("phrases", !layers.phrases)}
          aria-pressed={layers.phrases}
        >
          {layers.phrases && <Icon name="check" size={12} />}
          Recurring · {counts.phrases}
        </button>
      )}

      {counts.confusables > 0 && (
        <button
          className={`layer-chip confusable-chip${layers.confusables ? " on" : ""}`}
          onClick={() => onToggle("confusables", !layers.confusables)}
          aria-pressed={layers.confusables}
        >
          {layers.confusables && <Icon name="check" size={12} />}
          Near-twins · {counts.confusables}
        </button>
      )}

      <button
        className="tap"
        onClick={() => setLegend(true)}
        aria-label="What do the markers mean?"
        style={{ color: "var(--text-muted)", flex: "none", marginLeft: "auto", display: "inline-flex" }}
      >
        <Icon name="info" size={15} />
      </button>

      {legend && (
        <Sheet title="Reading markers" onClose={() => setLegend(false)}>
          <div className="marker-legend">
            <div className="ml-row">
              <span className="ml-sample">
                <span className="w recurring recurring-start recurring-end">مُّسْتَقِيمٍ</span>
              </span>
              <span className="ml-text">
                <b>Recurring phrase</b>
                <span>
                  This wording appears in other places in the Quran. Tap it to see every occurrence
                  — including where the wording differs slightly, the classic wrong-turn point when
                  reciting from memory.
                </span>
              </span>
            </div>
            <div className="ml-row">
              <span className="ml-sample">
                <span className="w confusable">لِتُنذِرَ</span>
              </span>
              <span className="ml-text">
                <b>Near-twin word</b>
                <span>
                  Looks almost identical to a different word elsewhere. Tap it to compare the two
                  side by side.
                </span>
              </span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
            Markers never change the text — they only sit under it. Switch either layer off with the
            chips above, or in Settings.
          </p>
        </Sheet>
      )}
    </div>
  );
}
