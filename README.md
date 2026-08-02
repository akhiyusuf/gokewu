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
| `/` | Passage picker — search, recents, surah list with an inline range picker |
| `/read/[chapter]?from=&to=&reciter=` | Player. The passage lives in the URL, so a session is shareable and the back button behaves. |
| `/credits` | Data & attributions (a licensing requirement, not a nicety) |

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
- Recurring-phrase (mutashabihat) highlighting — QUL dataset, licence terms
  **unconfirmed**; must be obtained in writing before shipping
- Confusable-word study aid — QuranMorph, CC-BY-4.0, cleared but requires
  attribution and a paper citation in the app once shipped
- Accounts and cross-device sync
- Offline storage, which is blocked by the 7-day caching limit above
