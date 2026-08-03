#!/usr/bin/env node
/**
 * Preprocesses the two static annotation datasets into per-surah lookups that
 * ship with the app.
 *
 * Both datasets are static reference data: neither changes, neither needs a
 * live API call, and neither is fetched from a third party at runtime. This
 * script runs once (or whenever the sources are updated) and writes trimmed
 * JSON keyed to verse and word position, matching the addressing already used
 * for audio timing (surah:verse:word_position).
 *
 *   node scripts/build-annotations.mjs --src <dir>
 *
 * <dir> must contain:
 *   Quran/quran-dataset.csv        QuranMorph corpus (Birzeit SinaLab, CC-BY-4.0)
 *   Quran/tagset_translation.csv   POS tag translation
 *   mut/phrases.json               QUL Mutashabihat phrase groups
 *   mut/phrase_verses.json         QUL Mutashabihat reverse index
 *
 * Output: public/data/annotations/{surah}.json  (114 files)
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "data", "annotations");


/* ------------------------------------------------------------------ */
/* Confusable-word derivation                                          */
/* ------------------------------------------------------------------ */

/**
 * Arabic diacritics, superscript alef, tatweel and Quranic annotation marks.
 * Removing these leaves the consonant skeleton, which is what makes two words
 * look alike on the page.
 */
const DIACRITICS = /[ً-ْٰٓ-ٕـۖ-ۭ]/g;

export function skeleton(word) {
  return word
    .replace(DIACRITICS, "")
    .replace(/ٱ/g, "ا") // alef wasla -> alef
    .replace(/[آأإ]/g, "ا"); // alef variants -> alef
}

/**
 * Closed-class function words. A shared skeleton between two particles or
 * pronouns is not a memorisation hazard — the reader already knows both — so
 * flagging them would bury the signal in noise.
 */
const FUNCTION_POS = new Set([
  "ضمير", "ضمير اشارة", "اسم موصول", "ظرف موصول", "أداة استفهام", "ظرف استفهام",
  "ضمير استفهام", "أداة إستثناء", "أداة تفصيل", "أداة نداء", "أداة تعريف", "أداة",
  "أداة ربط", "حرف جر", "حرف جر + أداة تعريف", "حرف جر + أداة ربط",
  "حرف جر + أداة نفي", "حرف جر + اسم موصول", "حرف جر + ضمير استفهام",
  "حرف جر + ضمير اشارة", "أداة ربط + أداة نفي", "عطف", "أداة استقبال",
  "أداة مضارعة", "أداة نفي", "جواب شرط + أداة نفي", "أداة فعل", "شبه فعل",
  "علامة ترقيم", "جواب", "شبه فعل + اسم موصول", "حرف-اختصار",
]);

/**
 * A reading occurring this many times or fewer counts as "rare".
 *
 * The dataset yields candidate pairs, not curated ones: flagging every word
 * whose skeleton is shared marks 23.6% of the corpus, which is noise. The
 * actual hazard is asymmetric — a *rare* form that looks like a *familiar*
 * one, so the eye supplies the familiar reading. Restricting to rare readings
 * of content words brings this to ~1.5% (about one marked word per 70), and
 * surfaces pairs like مَٰلِكِ / مَّلِكٌ and وَعَلَّمَ / وَعَلِمَ.
 *
 * This is a product threshold, not a linguistic claim. The doc notes filtering
 * should be informed by testing with actual huffaz; this is a defensible
 * default to test against, not a final answer.
 */
const RARE_READING_MAX = 3;

/* ------------------------------------------------------------------ */

/** Minimal RFC4180 CSV parser — the corpus quotes fields containing commas. */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* Everything above is importable (and unit-tested); the pipeline below  */
/* only runs when this file is executed directly.                        */
/* ------------------------------------------------------------------ */

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!isMain) {
  // imported for its pure helpers — nothing to do
} else {
  const srcFlag = process.argv.indexOf("--src");
  if (srcFlag === -1 || !process.argv[srcFlag + 1]) {
    console.error("usage: node scripts/build-annotations.mjs --src <dir>");
    process.exit(1);
  }
  const SRC = process.argv[srcFlag + 1];

console.log("reading QuranMorph corpus…");
/**
 * Arabic POS tag -> English, from the corpus's own tagset translation. These
 * are vetted morphological labels from the dataset, not generated claims about
 * meaning, so they are safe to display (see the licence note in the README).
 */
const posEn = new Map();
{
  const rows = parseCSV(readFileSync(join(SRC, "Quran", "tagset_translation.csv"), "utf8"));
  for (let i = 1; i < rows.length; i++) {
    const [ar, en] = rows[i];
    if (ar && en && en !== "-") posEn.set(ar.trim(), en.trim());
  }
}

const csv = parseCSV(readFileSync(join(SRC, "Quran", "quran-dataset.csv"), "utf8"));
const header = csv[0].map((h) => h.trim());
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const words = [];
for (let i = 1; i < csv.length; i++) {
  const r = csv[i];
  if (!r || r.length < header.length) continue;
  words.push({
    s: Number(r[col.surah_number]),
    v: Number(r[col.verse_number]),
    p: Number(r[col.word_position]),
    w: r[col.word],
    pos: r[col.POS],
    lemmaId: r[col.qabas_lemma_id],
    lemma: r[col.qabas_lemma],
  });
}
console.log(`  ${words.length} tokens`);

// word index for rendering phrase snippets
const wordAt = new Map(); // "s:v" -> Map(pos -> form)
for (const t of words) {
  const key = `${t.s}:${t.v}`;
  let m = wordAt.get(key);
  if (!m) wordAt.set(key, (m = new Map()));
  m.set(t.p, t.w);
}
const snippet = (verseKey, from, to) => {
  const m = wordAt.get(verseKey);
  if (!m) return "";
  const out = [];
  for (let i = from; i <= to; i++) if (m.has(i)) out.push(m.get(i));
  return out.join(" ");
};

/* ---- derive confusable sets ---- */
console.log("deriving confusable candidates…");
const skelLemmas = new Map(); // skeleton -> Set(lemmaId)
const readingCount = new Map(); // "skeleton|lemmaId" -> n
const readingForms = new Map(); // "skeleton|lemmaId" -> Map(form -> n)
const readingMeta = new Map(); // "skeleton|lemmaId" -> {lemma, first}

for (const t of words) {
  const sk = skeleton(t.w);
  if (sk.length < 2) continue;
  t._sk = sk;
  let set = skelLemmas.get(sk);
  if (!set) skelLemmas.set(sk, (set = new Set()));
  set.add(t.lemmaId);

  const rk = `${sk}|${t.lemmaId}`;
  readingCount.set(rk, (readingCount.get(rk) || 0) + 1);
  let forms = readingForms.get(rk);
  if (!forms) readingForms.set(rk, (forms = new Map()));
  forms.set(t.w, (forms.get(t.w) || 0) + 1);
  if (!readingMeta.has(rk)) {
    // Word position is kept so a link to the twin can highlight the exact
    // word on arrival, not just open the verse.
    readingMeta.set(rk, {
      lemma: t.lemma,
      first: `${t.s}:${t.v}`,
      firstPos: t.p,
      pos: posEn.get(t.pos) || "",
    });
  }
}

/** Marks keyed "s:v" -> [{p, w, lemma, with:[{w, lemma, at, n}]}] */
const confusables = new Map();
let confusableCount = 0;
for (const t of words) {
  const sk = t._sk;
  if (!sk) continue;
  const lemmas = skelLemmas.get(sk);
  if (!lemmas || lemmas.size < 2) continue;
  if (FUNCTION_POS.has(t.pos)) continue;
  const rk = `${sk}|${t.lemmaId}`;
  if ((readingCount.get(rk) || 0) > RARE_READING_MAX) continue;

  const others = [];
  for (const lid of lemmas) {
    if (lid === t.lemmaId) continue;
    const ork = `${sk}|${lid}`;
    const forms = readingForms.get(ork);
    const meta = readingMeta.get(ork);
    if (!forms || !meta) continue;
    const [form, n] = [...forms.entries()].sort((a, b) => b[1] - a[1])[0];
    others.push({
      w: form,
      lemma: meta.lemma,
      pos: meta.pos,
      at: meta.first,
      atPos: meta.firstPos,
      n: readingCount.get(ork) || n,
    });
  }
  if (!others.length) continue;
  others.sort((a, b) => b.n - a.n);

  const key = `${t.s}:${t.v}`;
  if (!confusables.has(key)) confusables.set(key, []);
  confusables.get(key).push({
    p: t.p,
    w: t.w,
    lemma: t.lemma,
    pos: posEn.get(t.pos) || "",
    n: readingCount.get(rk) || 1,
    with: others.slice(0, 4),
  });
  confusableCount++;
}
console.log(`  ${confusableCount} flagged occurrences (${((confusableCount / words.length) * 100).toFixed(2)}% of corpus)`);

/* ---- mutashabihat ---- */
console.log("reading Mutashabihat dataset…");
const phrases = JSON.parse(readFileSync(join(SRC, "mut", "phrases.json"), "utf8"));
const phraseVerses = JSON.parse(readFileSync(join(SRC, "mut", "phrase_verses.json"), "utf8"));
console.log(`  ${Object.keys(phrases).length} phrase groups, ${Object.keys(phraseVerses).length} tagged verses`);

/* ---- emit per-surah files ---- */
console.log("writing per-surah annotation files…");
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

// group -> trimmed detail, computed once and copied into each surah that uses it
const groupDetail = new Map();
function detailFor(gid) {
  if (groupDetail.has(gid)) return groupDetail.get(gid);
  const g = phrases[gid];
  if (!g) return null;
  const occ = [];
  for (const [verseKey, ranges] of Object.entries(g.ayah || {})) {
    for (const [from, to] of ranges) {
      occ.push({ k: verseKey, f: from, t: to, x: snippet(verseKey, from, to) });
    }
  }
  // Recitation order, so the list reads like the mushaf.
  occ.sort((a, b) => {
    const [as, av] = a.k.split(":").map(Number);
    const [bs, bv] = b.k.split(":").map(Number);
    return as - bs || av - bv || a.f - b.f;
  });
  const d = { surahs: g.surahs, ayahs: g.ayahs, count: g.count ?? occ.length, occ };
  groupDetail.set(gid, d);
  return d;
}

/**
 * The dominant wording of a group. Occurrences that differ from it are
 * near-variants — the actual trap, since the phrase reads the same up to one
 * word. They are marked so the reading view can distinguish them.
 */
const modalText = new Map();
function modalFor(gid) {
  if (modalText.has(gid)) return modalText.get(gid);
  const d = detailFor(gid);
  const counts = new Map();
  for (const o of d?.occ || []) counts.set(o.x, (counts.get(o.x) || 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const text = best ? best[0] : "";
  modalText.set(gid, text);
  return text;
}

// verse -> group marks, restricted to this surah
const marksByVerse = new Map(); // "s:v" -> [{g, f, t, n, v}]
for (const [verseKey, groupIds] of Object.entries(phraseVerses)) {
  const list = [];
  for (const gid of groupIds) {
    const g = phrases[String(gid)];
    if (!g) continue;
    const ranges = (g.ayah || {})[verseKey];
    if (!ranges) continue;
    const modal = modalFor(String(gid));
    const detail = detailFor(String(gid));
    for (const [from, to] of ranges) {
      const here = snippet(verseKey, from, to);
      list.push({
        g: String(gid),
        f: from,
        t: to,
        n: detail?.occ.length ?? 0,
        ...(here && modal && here !== modal ? { v: 1 } : {}),
      });
    }
  }
  if (list.length) marksByVerse.set(verseKey, list);
}

let totalBytes = 0;
let biggest = { surah: 0, bytes: 0 };
for (let surah = 1; surah <= 114; surah++) {
  const prefix = `${surah}:`;
  const phraseMarks = {};
  const usedGroups = new Set();
  for (const [verseKey, list] of marksByVerse) {
    if (!verseKey.startsWith(prefix)) continue;
    const v = verseKey.slice(prefix.length);
    phraseMarks[v] = list;
    for (const m of list) usedGroups.add(m.g);
  }

  const groups = {};
  for (const gid of usedGroups) {
    const d = detailFor(gid);
    if (d) groups[gid] = d;
  }

  const conf = {};
  for (const [verseKey, list] of confusables) {
    if (!verseKey.startsWith(prefix)) continue;
    conf[verseKey.slice(prefix.length)] = list;
  }

  const payload = { s: surah, phrases: phraseMarks, groups, confusables: conf };
  const json = JSON.stringify(payload);
  writeFileSync(join(OUT_DIR, `${surah}.json`), json);
  totalBytes += json.length;
  if (json.length > biggest.bytes) biggest = { surah, bytes: json.length };
}

console.log(
  `  wrote 114 files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB total, ` +
    `largest surah ${biggest.surah} at ${(biggest.bytes / 1024).toFixed(0)} KB`,
);
console.log("done.");
}
