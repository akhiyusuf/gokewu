import { readStorage, writeStorage } from "./storage";

/**
 * Local study-session memory: where the reader is in each passage, and which
 * days they showed up. This is the reader's own activity, not API content, so
 * the 7-day cache limit does not apply. Nothing here leaves the device.
 */

export interface SessionEntry {
  chapter: number;
  from: number;
  to: number;
  name: string;
  reciterId: number;
  reciterName: string;
  /** verse number the session is paused at */
  verse: number;
  updatedAt: number;
}

const SESSIONS_KEY = "hifz.sessions";
const DAYS_KEY = "hifz.days";
const MAX_SESSIONS = 12;
const MAX_DAYS = 400;

const keyOf = (s: Pick<SessionEntry, "chapter" | "from" | "to">) => `${s.chapter}:${s.from}-${s.to}`;

export function readSessions(): SessionEntry[] {
  const list = readStorage<SessionEntry[]>(SESSIONS_KEY) || [];
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveSession(entry: SessionEntry): void {
  const list = readSessions().filter((s) => keyOf(s) !== keyOf(entry));
  list.unshift(entry);
  writeStorage(SESSIONS_KEY, list.slice(0, MAX_SESSIONS));
}

/** Local calendar date, so a session at 11pm counts for the day it happened. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function recordDay(): void {
  const days = readStorage<string[]>(DAYS_KEY) || [];
  const t = today();
  if (days[0] === t) return;
  writeStorage(DAYS_KEY, [t, ...days.filter((d) => d !== t)].slice(0, MAX_DAYS));
}

/**
 * Consecutive days of use ending today or yesterday. Derived from real usage
 * dates — never invented — and the UI only shows it from 2 days up, so a
 * first open isn't greeted with a scoreboard.
 */
export function computeStreak(): number {
  const days = readStorage<string[]>(DAYS_KEY) || [];
  if (!days.length) return 0;
  const set = new Set(days);
  const cur = new Date();
  // A streak survives overnight: if today has no session yet, start counting
  // from yesterday.
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (!set.has(fmt(cur))) cur.setDate(cur.getDate() - 1);
  let streak = 0;
  while (set.has(fmt(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export function relativeTime(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  const w = Math.floor(d / 7);
  return `${w} week${w === 1 ? "" : "s"} ago`;
}

/** Greeting eyebrow for the Read screen, e.g. "Wednesday morning". */
export function greeting(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString("en", { weekday: "long" });
  const h = d.getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `${weekday} ${part}`;
}
