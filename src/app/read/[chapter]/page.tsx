import { PlayerScreen } from "@/components/player/PlayerScreen";

function num(v: string | string[] | undefined, fallback: number): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * The passage lives in the URL so a session is bookmarkable and the browser
 * back button behaves — the prototype toggled screens inside one document.
 */
export default function ReadPage({
  params,
  searchParams,
}: {
  params: { chapter: string };
  searchParams: { from?: string; to?: string; reciter?: string };
}) {
  const chapter = Math.min(114, Math.max(1, num(params.chapter, 1)));
  const from = num(searchParams.from, 1);
  const to = Math.max(from, num(searchParams.to, from));
  const reciterRaw = Number(searchParams.reciter);
  const reciterParam = Number.isFinite(reciterRaw) && reciterRaw > 0 ? reciterRaw : null;

  return <PlayerScreen chapter={chapter} from={from} to={to} reciterParam={reciterParam} />;
}
