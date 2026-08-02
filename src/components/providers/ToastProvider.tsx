"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Transient messaging. The UI requirements ask that different classes of
 * event be distinguishable, so toasts carry a tone: `info` (default),
 * `success` (completion) and `error` (failure).
 */
export type ToastTone = "info" | "success" | "error";

interface ToastContextValue {
  showToast: (msg: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

const DURATION_MS = 2600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; tone: ToastTone; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, tone: ToastTone = "info") => {
    setToast({ msg, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Announced to screen readers; assertive for failures only. */}
      <div
        className="toast-region"
        role="status"
        aria-live={toast?.tone === "error" ? "assertive" : "polite"}
        aria-atomic="true"
      >
        {toast ? (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            {toast.msg}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
