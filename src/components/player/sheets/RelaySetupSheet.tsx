"use client";

import { useState } from "react";
import { useAppData } from "@/components/providers/AppDataProvider";
import { Icon } from "@/components/shared/Icon";
import { Sheet } from "@/components/shared/Sheet";
import type { RelayParticipant, Verse } from "@/lib/types";

const ROUND_CHOICES: { value: number; label: string; numeral?: boolean }[] = [
  { value: 1, label: "Once" },
  { value: 2, label: "×2", numeral: true },
  { value: 4, label: "×4", numeral: true },
  { value: 0, label: "Until I stop" },
];

export function RelaySetupSheet({
  verses,
  defaultReciterId,
  initial,
  onStart,
  onClose,
}: {
  verses: Verse[];
  defaultReciterId: number;
  initial?: { order: RelayParticipant[]; vFrom: number; vTo: number; rounds: number };
  onStart: (order: RelayParticipant[], vFrom: number, vTo: number, rounds: number) => void;
  onClose: () => void;
}) {
  const { recitations, reciterName } = useAppData();
  const first = verses[0]?.number ?? 1;
  const last = verses[verses.length - 1]?.number ?? 1;

  const [order, setOrder] = useState<RelayParticipant[]>(
    initial?.order ?? [{ kind: "qari", reciterId: defaultReciterId }, { kind: "you" }],
  );
  const [vFrom, setVFrom] = useState(initial?.vFrom ?? first);
  const [vTo, setVTo] = useState(initial?.vTo ?? last);
  const [rounds, setRounds] = useState(initial?.rounds ?? 2);
  const [busy, setBusy] = useState(false);

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
    setOrder(next);
  };

  return (
    <Sheet title="Relay setup" onClose={onClose} maxHeight="86dvh">
      <span className="label-eyebrow">Turn order</span>
      <div className="sheet-list">
        {order.map((p, i) => {
          const name = p.kind === "you" ? "You (paced)" : reciterName(p.reciterId);
          return (
            <div key={i} className={`order-row${p.kind === "you" ? " you" : ""}`}>
              <Icon name="grip-vertical" size={17} style={{ color: "var(--text-muted)", flex: "none" }} />
              <span className="order-avatar">
                <Icon name={p.kind === "you" ? "user" : "mic"} size={16} />
              </span>
              <label className="order-name">
                {name}
                <select
                  aria-label={`Participant ${i + 1}`}
                  value={p.kind === "you" ? "you" : `q${p.reciterId}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = order.slice();
                    next[i] = val === "you" ? { kind: "you" } : { kind: "qari", reciterId: Number(val.slice(1)) };
                    setOrder(next);
                  }}
                >
                  <option value="you">You (paced)</option>
                  <optgroup label="Qaris">
                    {recitations.map((r) => (
                      <option key={r.id} value={`q${r.id}`}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <button
                className="tap"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${name} up`}
                style={{ color: "var(--text-muted)", opacity: i === 0 ? 0.3 : 1 }}
              >
                <Icon name="chevron-up" size={16} />
              </button>
              <button
                className="tap"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label={`Move ${name} down`}
                style={{ color: "var(--text-muted)", opacity: i === order.length - 1 ? 0.3 : 1 }}
              >
                <Icon name="chevron-down" size={16} />
              </button>
              <button
                className="tap"
                onClick={() => {
                  if (order.length <= 1) return;
                  setOrder(order.filter((_, x) => x !== i));
                }}
                disabled={order.length <= 1}
                aria-label={`Remove ${name}`}
                style={{ color: "var(--text-muted)", opacity: order.length <= 1 ? 0.3 : 1 }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        className="btn-dashed"
        onClick={() => setOrder([...order, { kind: "qari", reciterId: defaultReciterId }])}
      >
        <Icon name="plus" size={16} />
        Add participant
      </button>

      <div style={{ display: "flex", gap: 12 }}>
        {(
          [
            { label: "From", value: vFrom, set: setVFrom },
            { label: "To", value: vTo, set: setVTo },
          ] as const
        ).map((f) => (
          <label key={f.label} className="range-field">
            <span className="label-eyebrow">{f.label}</span>
            <span className="select-box">
              {verses[0]?.key.split(":")[0]}:{f.value}
              <Icon name="chevron-down" size={15} style={{ color: "var(--text-muted)" }} />
              <select
                aria-label={`${f.label} verse`}
                value={f.value}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  f.set(n);
                  if (f.label === "From" && vTo < n) setVTo(n);
                  if (f.label === "To" && n < vFrom) setVFrom(n);
                }}
              >
                {verses.map((v) => (
                  <option key={v.number} value={v.number}>
                    {v.key}
                  </option>
                ))}
              </select>
            </span>
          </label>
        ))}
      </div>

      <div>
        <span className="label-eyebrow">Rounds</span>
        <div className="rounds-row" style={{ marginTop: 6 }} role="group" aria-label="Rounds">
          {ROUND_CHOICES.map((r) => (
            <button
              key={r.value}
              className={rounds === r.value ? "on" : ""}
              onClick={() => setRounds(r.value)}
              aria-pressed={rounds === r.value}
              style={r.value === 0 ? { fontSize: 12 } : undefined}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onStart(order, vFrom, vTo, rounds);
          setBusy(false);
        }}
      >
        {busy ? (
          <>
            <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            Preparing qaris…
          </>
        ) : (
          <>
            <Icon name="play" size={18} />
            Start relay
          </>
        )}
      </button>
    </Sheet>
  );
}
