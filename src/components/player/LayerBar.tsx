"use client";

import { Icon } from "@/components/shared/Icon";

/**
 * Controls the density of the static annotation layers. Both are on by
 * default; a reader who finds the marking noisy can drop either without
 * losing the other.
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
    </div>
  );
}
