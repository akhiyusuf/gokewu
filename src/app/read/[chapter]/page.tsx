import { PlayerScreen } from "@/components/player/PlayerScreen";

function num(v: string | string[] | undefined, fallback: number): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * The passage lives in the URL so a session is bookmarkable and the browser
 * back button behaves — the prototype toggled screens inside one document.
 */
/**
 * `focus=verse-wordFrom-wordTo` marks a word span to highlight and scroll to on
 * arrival — used when following a recurring-phrase occurrence or a near-twin,
 * so the reader lands on the actual word rather than somewhere in the surah.
 */
function parseFocus(v: string | undefined) {
  if (!v) return null;
  const [verse, wf, wt] = v.split("-").map(Number);
  if (!verse || !Number.isFinite(verse)) return null;
  const from = Number.isFinite(wf) && wf! > 0 ? wf! : 1;
  const to = Number.isFinite(wt) && wt! >= from ? wt! : from;
  return { verse, from, to };
}

export default function ReadPage({
  params,
  searchParams,
}: {
  params: { chapter: string };
  searchParams: {
    from?: string;
    to?: string;
    reciter?: string;
    focus?: string;
    back?: string;
    held?: string;
    match?: string;
  };
}) {
  const chapter = Math.min(114, Math.max(1, num(params.chapter, 1)));
  const from = num(searchParams.from, 1);
  const to = Math.max(from, num(searchParams.to, from));
  const reciterRaw = Number(searchParams.reciter);
  const reciterParam = Number.isFinite(reciterRaw) && reciterRaw > 0 ? reciterRaw : null;

  return (
    <PlayerScreen
      chapter={chapter}
      from={from}
      to={to}
      reciterParam={reciterParam}
      focus={parseFocus(searchParams.focus)}
      cameFrom={searchParams.back || null}
      heldAt={searchParams.held ? Number(searchParams.held) : null}
      matchOf={searchParams.match || null}
    />
  );
}
