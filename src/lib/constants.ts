import type { Mode } from "./types";

export const API_BASE = "https://api.quran.com/api/v4";
export const AUDIO_BASE = "https://verses.quran.com/";
/**
 * Only one translation is wired for v1.
 *
 * The spec asks for Dr. Mustafa Khattab's "The Clear Quran" (id 131), but that
 * resource is no longer served by the public v4 API — `/resources/translations`
 * does not list it and `/quran/translations/131` returns an empty set. Saheeh
 * International is used instead: it is present, widely used, and modern
 * English. The name shown in the UI is read back from the API response rather
 * than hardcoded, so swapping this id keeps the label honest.
 */
export const TRANSLATION_ID = 20;

/**
 * Quran Foundation's developer terms prohibit storing their content for more
 * than one week without written permission. Do not extend this — see
 * feature-spec.md §2 "Caching" and §10 constraint #2.
 */
export const CONTENT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const RATES = [0.75, 1, 1.25, 1.5] as const;

/** Order, names, icons and descriptions follow the hi-fi design's mode sheet. */
export const MODES: { id: Mode; name: string; icon: string; desc: string }[] = [
  {
    id: "word",
    name: "Word range",
    icon: "brackets",
    desc: "Loop a chosen span of words",
  },
  {
    id: "verse",
    name: "Verse",
    icon: "book-open",
    desc: "Continuous recitation, live highlight",
  },
  {
    id: "masked",
    name: "Masked",
    icon: "eye-off",
    desc: "Words hidden until the audio arrives",
  },
  {
    id: "relay",
    name: "Relay",
    icon: "users",
    desc: "Take turns with one or more qaris",
  },
];

export const REPEAT_CHOICES = [3, 5, 10, 0] as const;
export const PEEKS_PER_VERSE = 3;

export const TAJWEED_LEGEND: { color: string; label: string }[] = [
  { color: "#FF7E1E", label: "Ghunnah" },
  { color: "#9400A8", label: "Ikhfa" },
  { color: "#D500B7", label: "Ikhfa shafawi" },
  { color: "#26BFFD", label: "Iqlab" },
  { color: "#169777", label: "Idgham (ghunnah)" },
  { color: "#169200", label: "Idgham (no ghunnah)" },
  { color: "#58B800", label: "Idgham shafawi" },
  { color: "#DD0008", label: "Qalqalah" },
  { color: "#537FFF", label: "Madd (2)" },
  { color: "#4050FF", label: "Madd (4–5)" },
  { color: "#0018C9", label: "Madd (6)" },
  { color: "#9A958C", label: "Silent / hamzat wasl" },
];

export const STORAGE_KEYS = {
  dark: "hifz.dark",
  style: "hifz.style",
  reciter: "hifz.reciter",
  recents: "hifz.recents",
  taj: "hifz.taj",
  wordRepeat: "hifz.wrep",
  loopCount: "hifz.passes",
  chapters: "hifz.chapters",
  recitations: "hifz.recitations",
} as const;
