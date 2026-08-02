"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchChapters, fetchRecitations } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { readStorage, writeStorage } from "@/lib/storage";
import type { Chapter, Recitation, RecentEntry } from "@/lib/types";

type LoadStatus = "loading" | "ready" | "error";

interface AppDataValue {
  chapters: Chapter[];
  recitations: Recitation[];
  status: LoadStatus;
  reload: () => void;
  reciterId: number | null;
  setReciterId: (id: number) => void;
  reciterName: (id: number | null) => string;
  recents: RecentEntry[];
  pushRecent: (entry: RecentEntry) => void;
  online: boolean;
}

const AppDataContext = createContext<AppDataValue | null>(null);

/** last used → Minshawi → Husary → Alafasy → first available */
function resolveDefaultReciter(recitations: Recitation[]): number | null {
  const saved = readStorage<number>(STORAGE_KEYS.reciter);
  if (saved && recitations.some((r) => r.id === saved)) return saved;
  const pick = (needle: string) =>
    recitations.find((r) => (r.name || "").toLowerCase().includes(needle))?.id;
  return pick("minshawi") ?? pick("husary") ?? pick("alafasy") ?? recitations[0]?.id ?? null;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [recitations, setRecitations] = useState<Recitation[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [reciterId, setReciterIdState] = useState<number | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [online, setOnline] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setRecents(readStorage<RecentEntry[]>(STORAGE_KEYS.recents) || []);
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([fetchChapters(), fetchRecitations()])
      .then(([ch, rec]) => {
        if (cancelled) return;
        setChapters(ch);
        setRecitations(rec);
        setReciterIdState((prev) => prev ?? resolveDefaultReciter(rec));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const setReciterId = useCallback((id: number) => {
    setReciterIdState(id);
    writeStorage(STORAGE_KEYS.reciter, id);
  }, []);

  const reciterName = useCallback(
    (id: number | null) => recitations.find((r) => r.id === id)?.name || "—",
    [recitations],
  );

  const pushRecent = useCallback((entry: RecentEntry) => {
    setRecents((prev) => {
      const next = [
        entry,
        ...prev.filter((r) => !(r.chapter === entry.chapter && r.from === entry.from && r.to === entry.to)),
      ].slice(0, 6);
      writeStorage(STORAGE_KEYS.recents, next);
      return next;
    });
  }, []);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return (
    <AppDataContext.Provider
      value={{
        chapters,
        recitations,
        status,
        reload,
        reciterId,
        setReciterId,
        reciterName,
        recents,
        pushRecent,
        online,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
