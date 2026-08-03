# Hifz — Quran reading & memorisation player

A mobile-first Quran reading and memorisation web app. Pick a surah and verse
range, pick a reciter, then work through the passage in one of four modes —
from looping a single word to reciting alongside a qari with the text hidden.

Everything is driven by **word-level audio timing**: the app knows the start and
end millisecond of every word, which is what makes word highlighting, span
looping, masked reveal and relay pacing possible.

## Stack

- Next.js 14 (App Router) + TypeScript, deployed on Vercel
- Plain CSS with custom properties — no UI framework
- No backend, no accounts. State persists in `localStorage` only.

## Running locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + type check + lint
npm test         # unit tests for the timing/relay/phrase logic
```

## Routes

| Route | Screen |
|---|---|
| `/` | Read screen — Continue hero (resumes your last session), recents, searchable surah index. Range and mode are chosen in the Practise sheet just before starting. |
| `/read/[chapter]?from=&to=&reciter=&mode=&at=` | Player. The passage, mode and resume position live in the URL, so a session is shareable and the back button behaves. |
| `/credits` | Data & attributions (a licensing requirement, not a nicety) |
| `/privacy` | Privacy policy — no accounts, no analytics, everything stays on-device |

## Release infrastructure

- **CI**: GitHub Actions (`.github/workflows/ci.yml`) runs unit tests and the
  production build on every push. Vercel deploys via its Git integration.
- **PWA**: web manifest + icons; installable app shell. Offline *content*
  remains blocked pending Quran Foundation permission.
- **Caching**: `/data/annotations/*` is served immutable for a year; the fetch
  URL carries `?v=ANNOTATIONS_VERSION`, bumped when datasets are regenerated.
- **Sessions**: reading position, recents and the day streak persist in
  localStorage (`src/lib/sessions.ts`) — the reader's own activity, not API
  content, so the 7-day limit does not apply.
- **Error handling**: route and global error boundaries, designed 404, fetch
  retry with backoff, Save-Data-aware audio preloading.
- **Media Session**: lock-screen playback controls with passage/reciter
  metadata.

## Playback modes

| Mode | What it does |
|---|---|
| **Word range** | Loops a chosen span of words with a repeat count; falls back to stepping word-by-word when no span is set |
| **Verse** | Continuous recitation with a live word-by-word highlight (default) |
| **Masked** | Words stay hidden and appear as the audio reaches them, with a 3-per-verse peek budget |
| **Relay** | Take turns verse by verse with one or more qaris. On your turn the qari's audio plays **muted**, so the highlight paces you at their speed while you recite aloud. |

Verse and Word range additionally offer two display styles: **Mushaf** (the full
range as continuous justified RTL text) and **Focus** (one phrase at a time).

## Architecture

The audio engine is the fragile part and is kept deliberately separate from the
view layer.

- `src/lib/engine.ts` — `PlaybackEngine`, a framework-agnostic class owning all
  playback state. React subscribes via `useSyncExternalStore`. Per-frame time
  updates go through a separate `subscribeTime` channel that writes straight to
  the DOM, so playback never re-renders the tree 60 times a second.
- `src/lib/segments.ts` — word-timing maths. Segment arrays arrive as
  `[w, start, end]` or `[w, ?, start, end]` and may be 0- or 1-based; the parser
  auto-detects and normalises. Falls back to dividing duration evenly when a
  reciter ships no segments.
- `src/lib/tajweed.ts` — parses the API's tajweed markup in an **inert
  document**, keeping only text nodes and recognised rule wrappers. This is
  deliberate XSS hardening against raw API strings; do not replace it with a
  regex or with `dangerouslySetInnerHTML` over the raw source.
- `src/lib/api.ts`, `src/lib/focus.ts`, `src/lib/relay.ts` — data access, phrase
  segmentation, relay turn assignment.

The engine preserves a set of hardening properties against races that are easy
to reintroduce — a single armed seek, source-freshness tracking, a play-token
guard, an 80 ms loop-edge re-entrancy guard, and an idempotent word-gap timer.
They are documented in the class docblock; read it before changing playback.

## Annotation layers

Two static layers mark the Arabic text. Both are **annotation only** — they add
visual marking around text rendered exactly as the content API returns it, and
never modify, replace or reorder it.

- **Recurring phrases (mutashabihat).** Spans that recur near-identically
  elsewhere get an underline and an occurrence count; tapping lists every
  location, flagging the ones whose wording differs (the actual wrong-turn
  trap). Source: the QUL Mutashabihat dataset — 814 phrase groups, from 2 to 70
  occurrences each.
- **Confusable words (near-twins).** Words that look almost identical to
  another word but do not share a lemma get a dotted underline; tapping shows
  both forms side by side. Source: the QuranMorph corpus.

Both are preprocessed once into per-surah lookups keyed to
`surah:verse:word_position` — the same addressing already used for audio
timing, so they attach to existing word elements rather than needing a separate
rendering path. Nothing is fetched from a third party at runtime.

```bash
node scripts/build-annotations.mjs --src <dir>   # writes public/data/annotations/*.json
```

The source datasets are not committed (the corpus alone is 32 MB); `<dir>` must
contain `Quran/quran-dataset.csv`, `Quran/tagset_translation.csv`,
`mut/phrases.json` and `mut/phrase_verses.json`. The generated output is
committed, so a normal build needs no regeneration.

### How confusable pairs are derived, and why they are filtered

The dataset ships no list of confusable pairs; it is derived — compare words on
the consonant skeleton (diacritics removed), compare their lemmas, and treat
*similar spelling + different lemma* as a candidate. This is detection logic
run against vetted linguistic data, not new linguistic judgement.

Taken literally that marks **23.6% of the corpus**, which is noise rather than
signal. The real hazard is asymmetric: a *rare* form that looks like a
*familiar* one, so the eye supplies the familiar reading. Restricting to rare
readings (≤3 occurrences) of content words brings this to **1.46%** — roughly
one marked word per 70 — and surfaces pairs like مَٰلِكِ / مَّلِكٌ,
وَعَلَّمَ / وَعَلِمَ and تَظَٰهَرُونَ / تُظَٰهِرُونَ. The threshold lives in
`RARE_READING_MAX` and is a product decision that should be tested with actual
huffaz, not a linguistic claim.

**What the app will not assert.** The derivation produces candidates and will
produce false positives. The app states only what the data supports: the two
forms, their lemmas, their part of speech, and where each occurs. It does not
generate an explanation of the difference or of why the confusion matters —
that is a claim about the meaning of the Quran and requires qualified review.
The explanation slot renders a deliberate "Study note pending review" state.

### Word state layering

A word can simultaneously be: currently recited, inside an active span, the
pending start of a span, tajweed-coloured, concealed/revealed, or part of a
completed verse. Each state uses a different visual channel (background tint,
bottom border, dashed outline, glyph colour, muted colour) so they stay
distinguishable when they combine. Two further annotation layers — recurring
phrases and confusable words — are planned; `Word` in `src/lib/types.ts` already
carries the fields, and they should attach as an additional channel rather than
reusing an existing one.

## Data & licensing

Content comes from the Quran Foundation v4 API (`api.quran.com`), which needs no
credentials, so it is called directly from the client.

- **API content is cached for at most 7 days** (`CONTENT_CACHE_TTL_MS` in
  `src/lib/constants.ts`). This matches the Quran Foundation developer terms,
  which prohibit storing their content longer without written permission. Do not
  extend it.
- Attribution to the Quran Foundation is required and lives at `/credits`.
- Quran content stays free to access. Any future paid tier applies to original
  tooling only, never to reading or listening.

### Annotation dataset licences — one open item

- **QuranMorph** (Birzeit University SinaLab) — **CC-BY-4.0**, commercial use
  permitted. Obligations are met in `/credits`: attribution, the paper citation
  (Akra, Hammouda & Jarrar, 2025), and a link to the licence. The licence also
  carries a **non-military, non-malicious use** clause, stated on that page.

  ⚠️ The supplied `license.docx` calls the licence CC-BY-4.0 in its text but
  links to `creativecommons.org/licenses/**by-nd**/4.0/`. BY-ND forbids
  distributing adaptations, and deriving confusable pairs and reshaping the
  corpus is plausibly an adaptation. **This contradiction should be resolved
  in writing with SinaLab before a commercial launch.**

- **QUL Mutashabihat** — licence terms are **still unconfirmed**. The
  supplementary-features document flags this as an open item, not a cleared
  one, and no licence file shipped with the data. Terms should be obtained in
  writing — particularly for commercial use and redistribution — before this
  layer ships publicly. It is implemented and attributed, but that permission
  is outstanding.

**Translation note:** the spec asks for Dr. Mustafa Khattab's *The Clear Quran*
(id 131), but that resource is no longer served by the public v4 API — it is
absent from `/resources/translations` and `/quran/translations/131` returns an
empty set. Saheeh International (id 20) is used instead, and the translation
name shown in the UI is read back from the API rather than hardcoded, so
changing `TRANSLATION_ID` keeps the label correct.

## Not built yet

Deliberately out of scope for this phase — these appear in the design file but
are not described by the feature spec, and several depend on unresolved
questions or on datasets that were not supplied:

- Onboarding / level selection, and the beginner literacy track
- Progress, revision scheduling, bookmarks and notes
- Search within the Quran text
- A translation picker (only one translation is wired)
- Accounts and cross-device sync
- Offline storage, which is blocked by the 7-day caching limit above
