import { AUDIO_BASE, API_BASE, CONTENT_CACHE_TTL_MS, STORAGE_KEYS, TRANSLATION_ID } from "./constants";
import { readCache, writeCache } from "./storage";
import type { Chapter, Recitation, Verse } from "./types";
import { parseSegments } from "./segments";
import { splitTajweedVerse } from "./tajweed";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

/** Cached GET wrapped around localStorage, capped at CONTENT_CACHE_TTL_MS. */
async function cachedFetch<T>(key: string, url: string, maxAgeMs: number): Promise<T> {
  const hit = readCache<T>(key, maxAgeMs);
  if (hit) return hit;
  const data = await getJSON<T>(url);
  writeCache(key, data);
  return data;
}

export async function fetchChapters(): Promise<Chapter[]> {
  const data = await cachedFetch<{ chapters: Chapter[] }>(
    STORAGE_KEYS.chapters,
    `${API_BASE}/chapters?language=en`,
    CONTENT_CACHE_TTL_MS,
  );
  return data.chapters || [];
}

export async function fetchRecitations(): Promise<Recitation[]> {
  const data = await cachedFetch<{
    recitations: { id: number; translated_name?: { name: string }; reciter_name?: string; style?: string }[];
  }>(STORAGE_KEYS.recitations, `${API_BASE}/resources/recitations?language=en`, CONTENT_CACHE_TTL_MS);
  return (data.recitations || []).map((r) => ({
    id: r.id,
    name: r.translated_name?.name || r.reciter_name || `Reciter ${r.id}`,
    style: r.style || "",
  }));
}

interface ApiWord {
  position: number;
  char_type_name?: string;
  char_type?: string;
  text_uthmani?: string;
  text?: string;
  text_uthmani_tajweed?: string | null;
  translation?: { text?: string };
  transliteration?: { text?: string };
}

interface ApiVerse {
  verse_key: string;
  verse_number: number;
  text_uthmani_tajweed?: string;
  words?: ApiWord[];
  translations?: { text?: string }[];
  audio?: { url?: string; segments?: unknown[] };
}

async function fetchVersePages(
  chapter: number,
  from: number,
  to: number,
  extraParams: string,
): Promise<ApiVerse[]> {
  const perPage = 50;
  const p1 = Math.ceil(from / perPage);
  const p2 = Math.ceil(to / perPage);
  const pages: number[] = [];
  for (let p = p1; p <= p2; p++) pages.push(p);
  const results = await Promise.all(
    pages.map((p) =>
      getJSON<{ verses: ApiVerse[] }>(
        `${API_BASE}/verses/by_chapter/${chapter}?page=${p}&per_page=${perPage}${extraParams}`,
      ),
    ),
  );
  const verses: ApiVerse[] = [];
  for (const r of results) {
    for (const v of r.verses || []) {
      if (v.verse_number >= from && v.verse_number <= to) verses.push(v);
    }
  }
  verses.sort((a, b) => a.verse_number - b.verse_number);
  return verses;
}

export interface AudioMapEntry {
  url: string;
  rawSegments: unknown[] | null;
}
export type AudioMap = Record<string, AudioMapEntry>;

export async function loadAudioMap(
  reciterId: number,
  chapter: number,
  from: number,
  to: number,
): Promise<AudioMap> {
  const raw = await fetchVersePages(chapter, from, to, `&audio=${reciterId}`);
  const map: AudioMap = {};
  for (const v of raw) {
    if (v.audio?.url) {
      const url = /^https?:/i.test(v.audio.url) ? v.audio.url : AUDIO_BASE + v.audio.url.replace(/^\//, "");
      map[v.verse_key] = { url, rawSegments: v.audio.segments || null };
    }
  }
  return map;
}

/**
 * Verse translations are not returned by `/verses/by_chapter` on the public
 * v4 API (the `translations` field comes back null), so they are fetched from
 * the dedicated resource endpoint. Rows come back in verse order for the whole
 * chapter, so row N is verse N+1.
 */
async function fetchTranslations(
  chapter: number,
): Promise<{ byVerse: Map<number, string>; name: string }> {
  const data = await getJSON<{
    translations: { text?: string }[];
    meta?: { translation_name?: string | null };
  }>(`${API_BASE}/quran/translations/${TRANSLATION_ID}?chapter_number=${chapter}`);
  const byVerse = new Map<number, string>();
  (data.translations || []).forEach((t, i) => {
    const text = (t.text || "")
      .replace(/<sup[^>]*>.*?<\/sup>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) byVerse.set(i + 1, text);
  });
  return { byVerse, name: data.meta?.translation_name || "Translation" };
}

export interface PassageText {
  verses: Verse[];
  translationName: string;
}

export async function loadPassageText(
  chapter: number,
  from: number,
  to: number,
): Promise<PassageText> {
  const [raw, tr] = await Promise.all([
    fetchVersePages(
      chapter,
      from,
      to,
      "&language=en&words=true&word_fields=text_uthmani,text_uthmani_tajweed&fields=text_uthmani,text_uthmani_tajweed",
    ),
    // A missing translation must not fail the passage — the Arabic is the product.
    fetchTranslations(chapter).catch(() => ({ byVerse: new Map<number, string>(), name: "Translation" })),
  ]);

  const verses = raw.map((v) => {
    const words: Verse["words"] = [];
    const marks: Verse["marks"] = [];
    for (const w of v.words || []) {
      const kind = w.char_type_name || w.char_type || "word";
      if (kind === "word") {
        words.push({
          pos: w.position,
          ar: w.text_uthmani || w.text || "",
          taj: w.text_uthmani_tajweed || null,
          gloss: w.translation?.text || "",
          tr: w.transliteration?.text || "",
        });
      } else {
        marks.push({
          afterPos: words.length ? words[words.length - 1]!.pos : 0,
          ar: w.text_uthmani || w.text || "",
          kind,
        });
      }
    }
    // Word-level tajweed is unreliable from the API — if every word came
    // back bare, split the verse-level markup across the word count instead.
    if (!words.some((w) => w.taj)) {
      const chunks = splitTajweedVerse(v.text_uthmani_tajweed || "", words.length);
      if (chunks) for (let i = 0; i < words.length; i++) words[i]!.tajHTML = chunks[i] ?? null;
    }
    return {
      key: v.verse_key,
      number: v.verse_number,
      words,
      marks,
      translation: tr.byVerse.get(v.verse_number) || "",
      audio: null,
    };
  });

  return { verses, translationName: tr.name };
}

/**
 * Transliteration for a single word, fetched on demand.
 *
 * Used by the near-twin comparison so both forms can be sounded out, not just
 * the one on screen. It is fetched rather than baked into the shipped
 * annotation data because transliteration is Quran Foundation API content and
 * is therefore subject to the 7-day caching limit.
 */
const translitCache = new Map<string, string>();

export async function fetchWordTransliteration(
  verseKey: string,
  wordPosition: number,
): Promise<string> {
  const cacheKey = `${verseKey}:${wordPosition}`;
  const hit = translitCache.get(cacheKey);
  if (hit !== undefined) return hit;
  try {
    const data = await getJSON<{ verse?: { words?: ApiWord[] } }>(
      `${API_BASE}/verses/by_key/${verseKey}?language=en&words=true&word_fields=text_uthmani`,
    );
    const words = (data.verse?.words || []).filter(
      (w) => (w.char_type_name || w.char_type || "word") === "word",
    );
    const match = words.find((w) => w.position === wordPosition);
    const text = match?.transliteration?.text || "";
    translitCache.set(cacheKey, text);
    return text;
  } catch {
    translitCache.set(cacheKey, "");
    return "";
  }
}

/** Merge a freshly-loaded audio map into a verse list, parsing segments per verse. */
export function applyAudioMap(verses: Verse[], map: AudioMap): Verse[] {
  return verses.map((v) => {
    const am = map[v.key];
    return {
      ...v,
      audio: am ? { url: am.url, segments: parseSegments(am.rawSegments, v.words.length) } : null,
      _est: null,
      _estDur: undefined,
    };
  });
}
