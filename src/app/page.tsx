"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAppData } from "@/components/providers/AppDataProvider";
import { Icon } from "@/components/shared/Icon";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { Sheet } from "@/components/shared/Sheet";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import type { Chapter } from "@/lib/types";

export default function PickerPage() {
  const router = useRouter();
  const { chapters, recitations, status, reload, reciterId, setReciterId, reciterName, recents } =
    useAppData();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [qariSheet, setQariSheet] = useState(false);

  const filtered = useMemo(() => {
    const raw = query.trim().toLowerCase();
    if (!raw) return chapters;
    // Surah names carry hyphens and apostrophes ("Ya-Sin", "Al-An'am"), so
    // matching is done on a stripped form — typing "yasin" or "anam" works.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const q = norm(raw);
    return chapters.filter(
      (c) =>
        String(c.id) === raw ||
        norm(c.name_simple).includes(q) ||
        norm(c.translated_name?.name || "").includes(q) ||
        c.name_arabic.includes(raw),
    );
  }, [chapters, query]);

  const selectedChapter = chapters.find((c) => c.id === selected) || null;

  function pickChapter(c: Chapter) {
    if (selected === c.id) {
      setSelected(null);
      return;
    }
    setSelected(c.id);
    setFrom(1);
    setTo(Math.min(c.verses_count, 3));
  }

  function open() {
    if (!selectedChapter || reciterId == null) return;
    router.push(`/read/${selectedChapter.id}?from=${from}&to=${to}&reciter=${reciterId}`);
  }

  const ctaLabel = selectedChapter
    ? `Open player — ${selectedChapter.name_simple} ${from}${to > from ? `–${to}` : ""}`
    : "Open player";

  return (
    <main className="shell" id="main">
      <div className="picker-head">
        <h1>Choose a passage</h1>
        <ThemeToggle />
      </div>

      <OfflineBanner />

      <div className="picker-search">
        <div className="field">
          <Icon name="search" size={18} style={{ color: "var(--text-muted)", flex: "none" }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search surah, name or number"
            aria-label="Search surahs by name or number"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="picker-body">
        {status === "loading" && (
          <div className="status-block">
            <div className="spinner" />
            <p>Loading surahs…</p>
          </div>
        )}

        {status === "error" && (
          <div className="status-block">
            <div className="status-medallion">
              <Icon name="cloud-off" size={34} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h2>Can&rsquo;t reach the library</h2>
              <p>
                The surah list couldn&rsquo;t be loaded. Check your connection and try again.
              </p>
            </div>
            <div className="status-actions">
              <button className="btn-primary" onClick={reload}>
                <Icon name="rotate-cw" size={17} />
                Try again
              </button>
            </div>
          </div>
        )}

        {status === "ready" && (
          <>
            {recents.length > 0 && (
              <section className="picker-section">
                <span className="label-eyebrow">Recents</span>
                <div className="picker-list">
                  {recents.slice(0, 3).map((r) => (
                    <Link
                      key={`${r.chapter}-${r.from}-${r.to}`}
                      className="recent-row"
                      href={`/read/${r.chapter}?from=${r.from}&to=${r.to}${
                        reciterId != null ? `&reciter=${reciterId}` : ""
                      }`}
                    >
                      <span className="recent-tile">
                        <Icon name="rotate-ccw" size={18} />
                      </span>
                      <span className="recent-text">
                        <b>
                          {r.name} {r.from}
                          {r.to > r.from ? `–${r.to}` : ""}
                        </b>
                        <span>{r.reciter}</span>
                      </span>
                      <Icon name="play" size={20} style={{ color: "var(--text-secondary)" }} />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="picker-section">
              <span className="label-eyebrow">All surahs</span>
              {filtered.length === 0 ? (
                <div className="status-block" style={{ padding: "32px 8px" }}>
                  <div className="status-medallion">
                    <Icon name="search" size={30} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <h2>No surah matches</h2>
                    <p>Nothing found for &ldquo;{query}&rdquo;. Try a different name or number.</p>
                  </div>
                  <div className="status-actions">
                    <button className="btn-secondary" onClick={() => setQuery("")}>
                      Clear search
                    </button>
                  </div>
                </div>
              ) : (
                <div className="picker-list">
                  {filtered.map((c) => {
                    const isSel = selected === c.id;
                    return (
                      <div key={c.id} className={`surah-card${isSel ? " sel" : ""}`}>
                        <button
                          className="surah-row"
                          onClick={() => pickChapter(c)}
                          aria-expanded={isSel}
                        >
                          <span className="sn">{c.id}</span>
                          <span className="stext">
                            <b>{c.name_simple}</b>
                            <span>
                              {c.translated_name?.name} · {c.verses_count} verses
                            </span>
                          </span>
                          <span className="ar">{c.name_arabic}</span>
                        </button>

                        {isSel && (
                          <div className="range-panel">
                            <div className="range-pair">
                              <label className="range-field">
                                <span>From verse</span>
                                <span className="select-box">
                                  {from}
                                  <Icon
                                    name="chevron-down"
                                    size={15}
                                    style={{ color: "var(--text-muted)" }}
                                  />
                                  <select
                                    value={from}
                                    aria-label="From verse"
                                    onChange={(e) => {
                                      const v = Number(e.target.value);
                                      setFrom(v);
                                      if (to < v) setTo(v);
                                    }}
                                  >
                                    {Array.from({ length: c.verses_count }, (_, i) => i + 1).map((n) => (
                                      <option key={n} value={n}>
                                        {n}
                                      </option>
                                    ))}
                                  </select>
                                </span>
                              </label>
                              <label className="range-field">
                                <span>To verse</span>
                                <span className="select-box">
                                  {to}
                                  <Icon
                                    name="chevron-down"
                                    size={15}
                                    style={{ color: "var(--text-muted)" }}
                                  />
                                  <select
                                    value={to}
                                    aria-label="To verse"
                                    onChange={(e) => {
                                      const v = Number(e.target.value);
                                      setTo(v);
                                      if (v < from) setFrom(v);
                                    }}
                                  >
                                    {Array.from({ length: c.verses_count }, (_, i) => i + 1).map((n) => (
                                      <option key={n} value={n}>
                                        {n}
                                      </option>
                                    ))}
                                  </select>
                                </span>
                              </label>
                            </div>
                            <span className="range-help">
                              {to - from + 1} {to - from + 1 === 1 ? "verse" : "verses"} selected · of{" "}
                              {c.verses_count}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <Link
              href="/credits"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 11.5,
                color: "var(--text-muted)",
                padding: "4px 0 8px",
                textDecoration: "none",
              }}
            >
              <Icon name="shield-check" size={14} />
              Quran content is always free to access · Data &amp; attributions
            </Link>
          </>
        )}
      </div>

      {status === "ready" && (
        <div className="picker-foot">
          <button className="field" onClick={() => setQariSheet(true)}>
            <Icon name="mic" size={17} style={{ color: "var(--text-muted)", flex: "none" }} />
            <span style={{ flex: 1, textAlign: "left", color: "var(--text-primary)" }}>
              {reciterName(reciterId)}
            </span>
            <Icon name="chevron-down" size={16} style={{ color: "var(--text-muted)", flex: "none" }} />
          </button>
          <button className="btn-primary" onClick={open} disabled={!selectedChapter}>
            <Icon name="play" size={18} />
            {ctaLabel}
          </button>
        </div>
      )}

      {qariSheet && (
        <Sheet title="Reciter" onClose={() => setQariSheet(false)} maxHeight="80dvh">
          <div className="info-line">
            <Icon name="info" size={13} />
            Switching mid-playback keeps your place
          </div>
          <div className="sheet-list" style={{ gap: 2 }}>
            {recitations.map((r) => (
              <button
                key={r.id}
                className={`qari-row${r.id === reciterId ? " on" : ""}`}
                onClick={() => {
                  setReciterId(r.id);
                  setQariSheet(false);
                }}
                aria-current={r.id === reciterId}
              >
                <span className="qari-avatar">
                  <Icon name="mic" size={17} />
                </span>
                <span className="qari-text">
                  <b>{r.name}</b>
                  {r.style && <span>{r.style}</span>}
                </span>
                {r.id === reciterId && (
                  <Icon name="check" size={19} style={{ color: "var(--action-primary)" }} />
                )}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </main>
  );
}
