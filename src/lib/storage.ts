/** Typed localStorage wrapper. Silently no-ops when storage is unavailable (SSR, private mode). */
export function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or unavailable — non-fatal */
  }
}

interface CacheEnvelope<T> {
  t: number;
  d: T;
}

export function readCache<T>(key: string, maxAgeMs: number): T | null {
  const hit = readStorage<CacheEnvelope<T>>(key);
  if (hit && hit.t && Date.now() - hit.t < maxAgeMs) return hit.d;
  return null;
}

export function writeCache<T>(key: string, data: T): void {
  writeStorage<CacheEnvelope<T>>(key, { t: Date.now(), d: data });
}
