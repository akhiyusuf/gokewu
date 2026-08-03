/**
 * Static annotation layers — recurring phrases (mutashabihat) and confusable
 * words. Both are preprocessed by `scripts/build-annotations.mjs` into
 * per-surah files under `public/data/annotations/`, so nothing is fetched from
 * a third party at runtime and nothing needs a live API call.
 *
 * These layers are **annotation only**: they mark text that is rendered
 * exactly as the content API returns it. They never modify, replace or
 * reorder the Quran text.
 */

import { ANNOTATIONS_VERSION } from "./constants";

export interface PhraseMark {
  /** phrase-group id */
  g: string;
  /** first word position in this verse */
  f: number;
  /** last word position in this verse */
  t: number;
  /** how many times the group occurs in total */
  n: number;
  /**
   * Present when this occurrence differs from the group's dominant wording —
   * the near-variant that actually causes a wrong turn.
   */
  v?: 1;
}

export interface PhraseOccurrence {
  /** verse key, e.g. "19:48" */
  k: string;
  f: number;
  t: number;
  /** the phrase text at that location */
  x: string;
}

export interface PhraseGroup {
  surahs: number;
  ayahs: number;
  count: number;
  occ: PhraseOccurrence[];
}

export interface ConfusablePartner {
  w: string;
  lemma: string;
  /** English POS label, straight from the corpus tagset */
  pos: string;
  /** a verse where this other reading occurs */
  at: string;
  /** word position of that occurrence, so arrival can highlight it */
  atPos: number;
  /** how many times this reading occurs in the Quran */
  n: number;
}

export interface ConfusableMark {
  /** word position in the verse */
  p: number;
  w: string;
  lemma: string;
  pos: string;
  n: number;
  with: ConfusablePartner[];
}

export interface SurahAnnotations {
  s: number;
  /** verse number (as string) -> phrase marks */
  phrases: Record<string, PhraseMark[]>;
  /** phrase-group id -> detail, restricted to groups touching this surah */
  groups: Record<string, PhraseGroup>;
  /** verse number (as string) -> confusable marks */
  confusables: Record<string, ConfusableMark[]>;
}

/** Per-word annotation, resolved for rendering. */
export interface WordAnnotation {
  phrase?: PhraseMark;
  phraseStart?: boolean;
  phraseEnd?: boolean;
  confusable?: ConfusableMark;
}

const cache = new Map<number, SurahAnnotations | null>();
const inflight = new Map<number, Promise<SurahAnnotations | null>>();

/**
 * Loads a surah's annotations. Failure is non-fatal — annotations are an
 * enhancement and must never block reading.
 */
export function loadAnnotations(surah: number): Promise<SurahAnnotations | null> {
  if (cache.has(surah)) return Promise.resolve(cache.get(surah)!);
  const hit = inflight.get(surah);
  if (hit) return hit;

  const p = fetch(`/data/annotations/${surah}.json?v=${ANNOTATIONS_VERSION}`)
    .then((r) => (r.ok ? (r.json() as Promise<SurahAnnotations>) : null))
    .catch(() => null)
    .then((data) => {
      cache.set(surah, data);
      inflight.delete(surah);
      return data;
    });
  inflight.set(surah, p);
  return p;
}

/**
 * Resolves per-word annotations for one verse. Returns an empty map when a
 * layer is switched off or no data applies, so callers can index freely.
 */
export function annotationsForVerse(
  ann: SurahAnnotations | null,
  verseNumber: number,
  layers: { phrases: boolean; confusables: boolean },
): Map<number, WordAnnotation> {
  const out = new Map<number, WordAnnotation>();
  if (!ann) return out;
  const key = String(verseNumber);

  if (layers.phrases) {
    for (const mark of ann.phrases[key] || []) {
      for (let p = mark.f; p <= mark.t; p++) {
        const entry = out.get(p) || {};
        // A word can sit in more than one recurring phrase; the first wins for
        // marking and the sheet lists every group touching the word.
        if (!entry.phrase) {
          entry.phrase = mark;
          entry.phraseStart = p === mark.f;
          entry.phraseEnd = p === mark.t;
        }
        out.set(p, entry);
      }
    }
  }

  if (layers.confusables) {
    for (const mark of ann.confusables[key] || []) {
      const entry = out.get(mark.p) || {};
      entry.confusable = mark;
      out.set(mark.p, entry);
    }
  }

  return out;
}

/** Every phrase group touching a given word, for the detail sheet. */
export function phraseGroupsAt(
  ann: SurahAnnotations | null,
  verseNumber: number,
  wordPos: number,
): { id: string; mark: PhraseMark; group: PhraseGroup }[] {
  if (!ann) return [];
  const out: { id: string; mark: PhraseMark; group: PhraseGroup }[] = [];
  for (const mark of ann.phrases[String(verseNumber)] || []) {
    if (wordPos < mark.f || wordPos > mark.t) continue;
    const group = ann.groups[mark.g];
    if (group) out.push({ id: mark.g, mark, group });
  }
  return out;
}
