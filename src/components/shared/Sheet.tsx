"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Bottom sheet. Closes on Escape and on scrim click, restores focus to the
 * trigger, and keeps focus inside while open.
 */
export function Sheet({
  title,
  onClose,
  children,
  maxHeight,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement;
    const el = sheetRef.current;
    el?.querySelector<HTMLElement>("button, [href], input, select, [tabindex]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      returnFocus.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={sheetRef}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn borderless tap" onClick={onClose} aria-label="Close">
            <Icon name="x" size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
