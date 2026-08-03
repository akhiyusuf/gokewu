"use client";

/**
 * Last-resort boundary for errors in the root layout itself. Styled inline
 * because globals.css may not have loaded when this renders.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf8f3",
          color: "#242019",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: "#5c554a", marginBottom: 20 }}>
            The app couldn&rsquo;t start. Reloading usually fixes this.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "13px 24px",
              borderRadius: 8,
              border: "none",
              background: "#e8590c",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
