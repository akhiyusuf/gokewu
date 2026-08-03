"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/components/providers/AppDataProvider";
import { PractiseSheet } from "@/components/player/sheets/PractiseSheet";
import { Icon } from "@/components/shared/Icon";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { Sheet } from "@/components/shared/Sheet";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { STORAGE_KEYS } from "@/lib/constants";
import { computeStreak, greeting, readSessions, relativeTime, type SessionEntry } from "@/lib/sessions";
import { readStorage, writeStorage } from "@/lib/storage";
import type { Mode } from "@/lib/types";

/**
 * The "Read" screen (v2 design). The old picker asked the reader to make every
 * decision up front — surah, range, reciter — before seeing anything. This one
 * leads with continuing what they were doing; range and mode moved into the
 * Practise sheet, chosen right before starting.
 */
export default function ReadPage() {
  const router = useRouter();
  const { chapters, recitations, status, reload, reciterId, setReciterId, reciterName } = useAppData();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [practise, setPractise] = useState(false);
  const [qariSheet, setQariSheet] = useState(false);
  const [taj, setTaj] = useState(false);
  const [session, setSession] = useState<SessionEntry | null>(null);
  const [streak, setStreak] = useState(0);
  const [eyebrow, setEyebrow] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Local-storage reads happen after mount so SSR and client render agree.
  useEffect(() => {
    setSession(readSessions()[0] ?? null);
    setStreak(computeStreak());
    setEyebrow(greeting());
    setTaj(!!readStorage<boolean>(STORAGE_KEYS.taj));
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const filtered = useMemo(() => {
    const raw = query.trim().toLowerCase();
    if (!raw) return chapters;
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

  const recents = useMemo(() => {
    const list = readSessions();
    // The hero already shows the newest session; chips pick up the next two.
    return list.slice(1, 3);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const openUrl = (chapter: number, from: number, to: number, extra?: Record<string, string>) => {
    const p = new URLSearchParams({ from: String(from), to: String(to) });
    if (reciterId != null) p.set("reciter", String(reciterId));
    for (const [k, v] of Object.entries(extra || {})) p.set(k, v);
    return `/read/${chapter}?${p.toString()}`;
  };

  const startPractise = (from: number, to: number, mode: Mode) => {
    if (!selectedChapter) return;
    setPractise(false);
    router.push(openUrl(selectedChapter.id, from, to, mode !== "verse" ? { mode } : {}));
  };

  const heroTotal = session ? session.to - session.from + 1 : 0;
  const heroDone = session ? session.verse - session.from + 1 : 0;

  return (
    <main className="shell" id="main">
      <div className="read-head">
        <div className="rh-left">
          <span className="label-eyebrow" style={{ letterSpacing: "0.12em" }}>
            {eyebrow || " "}
          </span>
          <h1>Read</h1>
        </div>
        <div className="rh-actions">
          <button
            className="icon-btn tap"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search surahs"
            aria-expanded={searchOpen}
          >
            <Icon name="search" size={18} />
          </button>
          <ThemeToggle />
        </div>
      </div>

      <OfflineBanner />

      {searchOpen && (
        <div className="picker-search">
          <div className="field">
            <Icon name="search" size={18} style={{ color: "var(--text-muted)", flex: "none" }} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search surah, name or number"
              aria-label="Search surahs by name or number"
              autoComplete="off"
            />
            {query && (
              <button className="tap" onClick={() => setQuery("")} aria-label="Clear search">
                <Icon name="x" size={16} style={{ color: "var(--text-muted)" }} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="picker-body" style={{ paddingTop: 0 }}>
        {status === "loading" && (
          <div className="picker-section" aria-hidden="true">
            <div className="index-card">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="index-row">
                  <span className="skel" style={{ width: 24, height: 14 }} />
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="skel" style={{ width: "40%", height: 13 }} />
                    <span className="skel" style={{ width: "60%", height: 10 }} />
                  </span>
                  <span className="skel" style={{ width: 40, height: 18 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="status-block">
            <div className="status-medallion">
              <Icon name="cloud-off" size={34} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h2>Can&rsquo;t reach the library</h2>
              <p>The surah list couldn&rsquo;t be loaded. Check your connection and try again.</p>
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
            {session && !query && (
              <section className="hero-card">
                {streak >= 2 && (
                  <span className="streak-pill" title={`${streak} days in a row`}>
                    <Icon name="flame" size={13} />
                    <span className="num">{streak}</span>
                  </span>
                )}
                <div className="hc-head">
                  <span className="label-eyebrow" style={{ color: "var(--action-primary)" }}>
                    Continue
                  </span>
                  <span className="hc-title">
                    <h2>{session.name}</h2>
                    <span className="ar">
                      {chapters.find((c) => c.id === session.chapter)?.name_arabic ?? ""}
                    </span>
                  </span>
                  <span className="hc-sub">
                    Verses {session.from}–{session.to} · {session.reciterName}
                  </span>
                </div>
                <div className="hc-progress">
                  <div className="hc-track">
                    <i style={{ width: `${Math.min(100, Math.round((heroDone / heroTotal) * 100))}%` }} />
                  </div>
                  <div className="hc-meta">
                    <span>
                      {heroDone} of {heroTotal} verses
                    </span>
                    <span>{relativeTime(session.updatedAt)}</span>
                  </div>
                </div>
                <Link
                  className="btn-primary"
                  style={{ padding: 13 }}
                  href={openUrl(session.chapter, session.from, session.to, {
                    at: String(session.verse),
                    reciter: String(session.reciterId || reciterId || ""),
                  })}
                >
                  <Icon name="play" size={18} />
                  Resume at verse {session.verse}
                </Link>
              </section>
            )}

            {recents.length > 0 && !query && (
              <section className="picker-section">
                <span className="label-eyebrow">Pick up again</span>
                <div className="chip-row">
                  {recents.map((r) => (
                    <Link
                      key={`${r.chapter}-${r.from}-${r.to}`}
                      className="recent-chip"
                      href={openUrl(r.chapter, r.from, r.to, {
                        at: String(r.verse),
                        reciter: String(r.reciterId || reciterId || ""),
                      })}
                    >
                      <span className="rc-tile">
                        <Icon name="rotate-ccw" size={14} />
                      </span>
                      <span className="rc-text">
                        <b>
                          {r.name} {r.from}–{r.to}
                        </b>
                        <span>{r.reciterName}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="picker-section">
              <div className="index-head">
                <span className="label-eyebrow">Surahs</span>
                <span className="num" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {filtered.length}
                </span>
              </div>

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
                <div className="index-card">
                  {filtered.map((c) => {
                    const isSel = selected === c.id;
                    return (
                      <button
                        key={c.id}
                        className={`index-row${isSel ? " sel" : ""}`}
                        onClick={() => setSelected(isSel ? null : c.id)}
                        aria-pressed={isSel}
                      >
                        <span className="in">{c.id}</span>
                        <span className="itext">
                          <b>{c.name_simple}</b>
                          <span>
                            {c.translated_name?.name} · {c.verses_count} verses
                          </span>
                        </span>
                        <span className="iar">{c.name_arabic}</span>
                        <Icon
                          name="chevron-left"
                          size={16}
                          style={{ color: isSel ? "var(--action-primary)" : "var(--text-muted)", flex: "none" }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="link-row">
              <Link href="/credits">Data &amp; attributions</Link>
              <span aria-hidden="true">·</span>
              <Link href="/privacy">Privacy</Link>
            </div>
          </>
        )}
      </div>

      {status === "ready" && (
        <div className="picker-foot" style={{ flexDirection: "row", gap: 10 }}>
          <button className="qari-compact tap" onClick={() => setQariSheet(true)} aria-label="Change reciter">
            <Icon name="mic" size={15} style={{ color: "var(--text-muted)", flex: "none" }} />
            <span>{reciterName(reciterId).split(" ").slice(-1)[0]}</span>
            <Icon name="chevron-down" size={14} style={{ color: "var(--text-muted)", flex: "none" }} />
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1, width: "auto" }}
            disabled={!selectedChapter}
            onClick={() => selectedChapter && setPractise(true)}
          >
            <Icon name="sliders-horizontal" size={18} />
            {selectedChapter ? `Set up ${selectedChapter.name_simple}` : "Choose a surah"}
          </button>
        </div>
      )}

      {practise && selectedChapter && (
        <PractiseSheet
          surahName={selectedChapter.name_simple}
          versesCount={selectedChapter.verses_count}
          initialFrom={1}
          initialTo={Math.min(12, selectedChapter.verses_count)}
          initialMode="verse"
          taj={taj}
          onTaj={(on) => {
            setTaj(on);
            writeStorage(STORAGE_KEYS.taj, on);
          }}
          onStart={startPractise}
          onClose={() => setPractise(false)}
        />
      )}

      {qariSheet && (
        <Sheet title="Reciter" onClose={() => setQariSheet(false)} maxHeight="80dvh">
          <div className="info-line">
            <Icon name="info" size={13} />
            Applies to every passage you open
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
