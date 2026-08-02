"use client";

import { useState } from "react";
import { useAppData } from "@/components/providers/AppDataProvider";
import { Icon } from "@/components/shared/Icon";
import { Sheet } from "@/components/shared/Sheet";

export function QariSheet({
  currentId,
  onPick,
  onClose,
}: {
  currentId: number | null;
  onPick: (id: number, name: string) => void;
  onClose: () => void;
}) {
  const { recitations } = useAppData();
  const [q, setQ] = useState("");

  const list = q.trim()
    ? recitations.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()))
    : recitations;

  return (
    <Sheet title="Reciter" onClose={onClose} maxHeight="80dvh">
      <div className="field">
        <Icon name="search" size={16} style={{ color: "var(--text-muted)", flex: "none" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reciters"
          aria-label="Search reciters"
        />
      </div>

      <div className="info-line">
        <Icon name="info" size={13} />
        Switching mid-playback keeps your place
      </div>

      <div className="sheet-list" style={{ gap: 2 }}>
        {list.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 4px" }}>
            No reciter matches &ldquo;{q}&rdquo;.
          </p>
        )}
        {list.map((r) => (
          <button
            key={r.id}
            className={`qari-row${r.id === currentId ? " on" : ""}`}
            onClick={() => {
              onPick(r.id, r.name);
              onClose();
            }}
            aria-current={r.id === currentId}
          >
            <span className="qari-avatar">
              <Icon name="mic" size={17} />
            </span>
            <span className="qari-text">
              <b>{r.name}</b>
              {r.style && <span>{r.style}</span>}
            </span>
            {r.id === currentId && (
              <Icon name="check" size={19} style={{ color: "var(--action-primary)" }} />
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
