"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/shared/Icon";
import { Sheet } from "@/components/shared/Sheet";
import { MODES, TAJWEED_LEGEND } from "@/lib/constants";
import type { Mode } from "@/lib/types";

export function ModeSheet({
  mode,
  taj,
  onMode,
  onTaj,
  onClose,
}: {
  mode: Mode;
  taj: boolean;
  onMode: (m: Mode) => void;
  onTaj: (on: boolean) => void;
  onClose: () => void;
}) {
  const [legend, setLegend] = useState(false);

  return (
    <Sheet title="Playback mode" onClose={onClose}>
      <div className="sheet-list">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-opt${mode === m.id ? " on" : ""}`}
            onClick={() => {
              onMode(m.id);
              onClose();
            }}
            aria-current={mode === m.id}
          >
            <span className="mo-ic">
              <Icon name={m.icon as IconName} size={19} />
            </span>
            <span className="mo-t">
              <b>{m.name}</b>
              <span>{m.desc}</span>
            </span>
            <span className="radio-dot">
              <Icon name="check" size={13} />
            </span>
          </button>
        ))}
      </div>

      <div className="settings-row">
        <span className="st">
          <b>Tajweed colours</b>
          <span>Colour letters by recitation rule</span>
        </span>
        <button
          className={`switch${taj ? " on" : ""}`}
          role="switch"
          aria-checked={taj}
          aria-label="Tajweed colours"
          onClick={() => onTaj(!taj)}
        >
          <i />
        </button>
      </div>

      <button className="legend-toggle" onClick={() => setLegend((v) => !v)} aria-expanded={legend}>
        {TAJWEED_LEGEND.slice(0, 3).map((l) => (
          <span key={l.label} className="legend-swatch" style={{ background: l.color }} />
        ))}
        Colour legend
        <Icon name={legend ? "chevron-up" : "chevron-down"} size={16} style={{ color: "var(--text-muted)" }} />
      </button>

      {legend && (
        <div className="legend-grid">
          {TAJWEED_LEGEND.map((l) => (
            <span key={l.label} className="lg">
              <span className="legend-swatch" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </Sheet>
  );
}
