# Working notes for Claude

Read `README.md` first — it covers the architecture, the annotation layers, and
the licensing constraints. This file covers the things a fresh session cannot
infer from the code: conventions, current state, and what is deliberately left
undone.

## Branch and deploy

- All work goes on **`claude/hifz-quran-player-web-ret1n3`**. Do not push to the
  default branch, and do not open a PR unless asked.
- Hosting is **one** Vercel project, **`hifz-quran-player`** — always redeploy
  that project, never create a new one. Its stable public URL is
  `https://hifz-quran-player.vercel.app`; per-deploy hashed URLs are protected
  and their share links expire in ~24h, so quote the stable URL to the user.
  Get the team id from `list_teams` / `list_projects` rather than hardcoding it.
- The project is **not** yet connected to GitHub. Deploys go through the Vercel
  connector with a file-tree payload whose `installCommand` clones the branch
  at build time:

  ```
  git clone --depth 1 --branch claude/hifz-quran-player-web-ret1n3 \
    https://github.com/akhiyusuf/gokewu.git _src && cp -a _src/. . && rm -rf _src && npm ci
  ```

  This exists only because Git integration is off; connecting the repo in the
  Vercel dashboard (Settings → Git, production branch as above) replaces it and
  is the standing recommendation to the user.
- Deployment protection is **ON deliberately** — the QUL licence question below
  blocks public release. Do not turn it off.
- A `302` from a deployment URL is an auth redirect, **not** a finished build.
  Poll `get_deployment` until `readyState === "READY"`.

## Verifying a deploy

Fetch the live stylesheet and grep for markers of the build you expect, then
check `get_runtime_errors`:

```bash
curl -sS https://hifz-quran-player.vercel.app/ -o home.html
css=$(grep -o '/_next/static/css/[^"]*\.css' home.html | head -1)
curl -sS "https://hifz-quran-player.vercel.app$css" | grep -c 'tjc-ghunnah'
```

`--tjc-*` custom properties are present from the tajweed-contrast commit
onward; `dotted var(--layer-confusable)` only exists in builds *older* than the
solid-underline commit.

## Local verification

`npm run build` and `npm test` (42 tests) must both pass before pushing.

The sandbox browser **cannot reach `api.quran.com`** (the proxy never completes
CONNECT, though `curl` works). Verify UI in Playwright by intercepting
`**://api.quran.com/**` and `**://verses.quran.com/**` with local fixtures —
see the scratchpad scripts from prior sessions, or rebuild fixtures with curl.
Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

Two traps when probing styles:

- `.w` has `transition: background 160ms`, so `getComputedStyle` immediately
  after `classList.add` reads the *pre-transition* value. Wait ~400 ms.
- To compute contrast against a tinted highlight, composite the alpha
  background over the nearest **opaque** ancestor, not `document.body`.

Kill stale dev servers by port (`fuser -k -n tcp <port>`) and use a fresh port
each run — stale Next servers serve old chunks and produce phantom 400s.

## Conventions

- Plain CSS with custom properties in `src/app/globals.css`; no utility
  framework. Colours come from tokens — avoid literal hex outside the token
  blocks and the tajweed palette.
- Comments explain *why*, especially where a simpler-looking approach was tried
  and rejected. Keep that density; don't strip the rationale comments.
- The playback engine's hardening invariants are documented in its docblock.
  Read them before touching `src/lib/engine.ts`.
- Overlay back-button handling has a **single owner** in `PlayerScreen`
  (`useDismissOnBack`). Per-surface handlers race; only add a local one for an
  overlay that never hands off to another (e.g. the marker legend).
- On the player route, read params with `useSearchParams` — server
  `searchParams` do not update on same-route client navigation.

## Visual language of the annotation layers

Settled with the user over several rounds; don't "improve" these without asking:

- Recurring phrase → **one solid blue underline**, continuous across the whole
  phrase (the space between words carries it via `.recurring-join`).
- Near-twin word → **one solid amber underline**.
- Dotted and dashed variants were tried and **rejected** — readers took them
  for rendering glitches. Near-variant occurrences are distinguished *in the
  detail sheet a tap opens*, never by line style.
- The current word on a marked word gets a deeper tint plus a ring, and tajweed
  rule colours stay visible on it, using intensified same-hue variants that
  clear 3:1 against the tint (`--tjc-*`).
- The Layers bar has an info button opening a two-row legend explaining both
  markers.

## Licensing — hard constraints

- API content caching stays at 7 days (`CONTENT_CACHE_TTL_MS`). Do not extend.
- Quran text is annotated, never modified.
- No auto-generated explanations of confusable pairs; the placeholder state is
  intentional.
- **QUL Mutashabihat licence is unconfirmed** and blocks public release. Two
  emails (SinaLab BY/BY-ND contradiction; QUL terms) were drafted for the user
  to send; as of this writing they are unsent.

## Open items for the user (not ours to do)

- Send the two licence emails.
- Connect the repo to the Vercel project (Settings → Git).
- Disable deployment protection only once the QUL licence clears.
- Test on a real phone: iOS Word-mode autoplay chaining, and loading a long
  surah (Al-Baqarah) end to end.

## Backlog, designed but unbuilt

Onboarding / mode explanation, Progress, Revision, Saved, Search, translation
picker, beginner track, i18n, external timing providers, full desktop rails.
The user's standing rule: anything in the design file not directly discussed
ships in a later phase.

The user has said the app "feels complicated". That is a real finding, not a
styling problem — onboarding is unbuilt. The recommendation on the table is to
test with 3–5 memorisers before adding more features.
