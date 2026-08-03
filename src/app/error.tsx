"use client";

import Link from "next/link";
import { Icon } from "@/components/shared/Icon";

/**
 * Route-level error boundary. Without it, any uncaught render error
 * white-screens the app with no way back.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="shell" id="main">
      <div className="status-block">
        <div className="status-medallion">
          <Icon name="cloud-off" size={34} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2>Something went wrong</h2>
          <p>
            The app hit an unexpected error. Nothing you were reading is affected — try again, or go
            back to the passage list.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Reference: {error.digest}</p>
          )}
        </div>
        <div className="status-actions">
          <button className="btn-primary" onClick={reset}>
            <Icon name="rotate-cw" size={17} />
            Try again
          </button>
          <Link className="btn-secondary" href="/">
            <Icon name="chevron-left" size={16} />
            Back to passages
          </Link>
        </div>
      </div>
    </main>
  );
}
