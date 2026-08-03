"use client";

import { useEffect, useRef } from "react";

/**
 * Makes the device/browser back gesture dismiss transient surfaces (sheets,
 * popovers) instead of navigating away from the passage.
 *
 * A single owner drives this for the whole screen. Per-surface handling raced:
 * a popover handing off to a sheet would pop its own entry while the sheet
 * pushed a new one, and the two operations interleaved unpredictably. Here one
 * entry covers "some overlay is open", so moving between overlays is free and
 * back always lands the reader back on the text.
 */
export function useDismissOnBack(
  isOpen: boolean,
  onClose: () => void,
  /**
   * Set true immediately before navigating away from an overlay. Without it the
   * cleanup's history.back() races the router's push and cancels it, so
   * following a link from a sheet silently did nothing.
   */
  navigatingAway?: { current: boolean },
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    const token = `overlay-${Date.now()}`;
    let ours = true;
    window.history.pushState({ __overlay: token }, "");

    const onPop = () => {
      ours = false; // the entry is already gone; don't pop it again on cleanup
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      if (navigatingAway?.current) return;
      if (ours && window.history.state?.__overlay === token) window.history.back();
    };
  }, [isOpen]);
}
