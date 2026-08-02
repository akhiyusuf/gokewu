"use client";

import { useEffect, useRef } from "react";
import type { PlaybackEngine } from "@/lib/engine";
import { fmtTime } from "@/lib/segments";

/**
 * Reads time straight from the engine's high-frequency channel and writes to
 * the DOM, so playback never re-renders React 60 times a second.
 *
 * Dragging updates the UI only — the audio element is seeked once on release,
 * because seeking on every pointermove made playback stutter and re-buffer.
 */
export function SeekBar({ engine, disabled }: { engine: PlaybackEngine; disabled?: boolean }) {
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLSpanElement>(null);
  const durRef = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const dragFrac = useRef(0);
  const durationRef = useRef(0);

  const paint = (frac: number) => {
    const pct = `${Math.min(100, Math.max(0, frac * 100))}%`;
    if (fillRef.current) fillRef.current.style.width = pct;
    if (thumbRef.current) thumbRef.current.style.left = pct;
  };

  useEffect(() => {
    return engine.subscribeTime((currentTime, duration) => {
      durationRef.current = duration;
      if (durRef.current) durRef.current.textContent = fmtTime(duration);
      if (dragging.current) return;
      if (curRef.current) curRef.current.textContent = fmtTime(currentTime);
      paint(duration > 0 ? currentTime / duration : 0);
    });
  }, [engine]);

  const fracFor = (clientX: number) => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const showFrac = (frac: number) => {
    paint(frac);
    if (curRef.current && durationRef.current > 0) {
      curRef.current.textContent = fmtTime(frac * durationRef.current);
    }
  };

  const commit = () => {
    if (!dragging.current) return;
    dragging.current = false;
    engine.commitSeek(dragFrac.current);
  };

  return (
    <div className="seek-row">
      <span className="tm" ref={curRef}>
        0:00
      </span>
      <div
        className="seekbar"
        ref={barRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        onPointerDown={(e) => {
          if (disabled) return;
          dragging.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          dragFrac.current = fracFor(e.clientX);
          showFrac(dragFrac.current);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          dragFrac.current = fracFor(e.clientX);
          showFrac(dragFrac.current);
        }}
        onPointerUp={commit}
        /* A cancelled gesture used to leave the drag flag stuck true, which
           froze the timeline for the rest of the session. */
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onLostPointerCapture={commit}
        onKeyDown={(e) => {
          if (disabled || durationRef.current <= 0) return;
          const step = e.key === "ArrowLeft" ? -0.05 : e.key === "ArrowRight" ? 0.05 : 0;
          if (!step) return;
          e.preventDefault();
          const next = Math.min(1, Math.max(0, dragFrac.current + step));
          dragFrac.current = next;
          showFrac(next);
          engine.commitSeek(next);
        }}
      >
        <div className="track">
          <div className="fill" ref={fillRef} />
          <div className="thumb" ref={thumbRef} />
        </div>
      </div>
      <span className="tm end" ref={durRef}>
        0:00
      </span>
    </div>
  );
}
