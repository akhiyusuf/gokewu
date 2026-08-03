"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/shared/Icon";
import type { Mode, Style } from "@/lib/types";

export function PlayerHeader({
  title,
  subtitle,
  qariName,
  mode,
  style,
  onStyle,
  onQari,
  onEditRelay,
  matchLabel = null,
  backLabel = null,
}: {
  title: string;
  subtitle?: string;
  qariName: string;
  mode: Mode;
  style: Style;
  onStyle: (s: Style) => void;
  onQari: () => void;
  onEditRelay?: () => void;
  /** Position within an occurrence list when arrived via an annotation link. */
  matchLabel?: string | null;
  /** Names the passage the back button returns to, when it isn't the index. */
  backLabel?: string | null;
}) {
  const router = useRouter();
  // The style toggle only applies to Verse and Word range, so it is removed
  // rather than hidden in the other modes (an invisible-but-focusable
  // control was one of the prototype's rough edges).
  const showStyle = mode === "verse" || mode === "word";
  const isRelay = mode === "relay";

  return (
    <header className="player-head">
      {/* When the reader followed an annotation link, back returns to the
          passage they left — and says so — rather than to the index. */}
      <button
        className={`icon-btn sm tap${backLabel ? " labelled" : ""}`}
        onClick={() => (backLabel ? router.back() : router.push("/"))}
        aria-label={backLabel ? `Back to ${backLabel}` : "Back to passage list"}
      >
        <Icon name="chevron-left" size={19} />
        {backLabel && <span>{backLabel}</span>}
      </button>

      <div className="ttl">
        <h1>{title}</h1>
        {matchLabel && <span className="match-chip">{matchLabel}</span>}
        {isRelay ? (
          <span className="sub">{subtitle}</span>
        ) : (
          <button className="qari-pill tap" onClick={onQari} aria-label={`Reciter: ${qariName}. Change reciter`}>
            <Icon name="mic" size={11} style={{ color: "var(--action-primary)", flex: "none" }} />
            <span>{qariName}</span>
            <Icon name="chevron-down" size={12} style={{ color: "var(--text-muted)", flex: "none" }} />
          </button>
        )}
      </div>

      {showStyle && (
        <div className="style-toggle" role="group" aria-label="Display style">
          {(["mushaf", "focus"] as const).map((s) => (
            <button
              key={s}
              className={style === s ? "on" : ""}
              onClick={() => onStyle(s)}
              aria-pressed={style === s}
            >
              {s === "mushaf" ? "Mushaf" : "Focus"}
            </button>
          ))}
        </div>
      )}

      {isRelay && onEditRelay && (
        <button
          onClick={onEditRelay}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 10px",
            borderRadius: "var(--radius-button)",
            border: "1px solid var(--border-default)",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-secondary)",
            flex: "none",
          }}
        >
          <Icon name="settings-2" size={14} />
          Edit
        </button>
      )}

      {!showStyle && !isRelay && (
        <span className="icon-btn sm" style={{ borderColor: "transparent", color: "var(--text-muted)" }}>
          <Icon name="eye-off" size={19} />
        </span>
      )}
    </header>
  );
}
