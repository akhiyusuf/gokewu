"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/providers/AppDataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Icon } from "@/components/shared/Icon";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { loadPassageText } from "@/lib/api";
import { PlaybackEngine } from "@/lib/engine";
import { useEngineState } from "@/lib/usePlaybackEngine";
import type { Mode, RelayParticipant } from "@/lib/types";
import { PlayerFooter } from "./PlayerFooter";
import { PlayerHeader } from "./PlayerHeader";
import { WordPopover, type PopoverTarget } from "./WordPopover";
import { ModeSheet } from "./sheets/ModeSheet";
import { QariSheet } from "./sheets/QariSheet";
import { RelaySetupSheet } from "./sheets/RelaySetupSheet";
import { FocusView } from "./views/FocusView";
import { MaskedView } from "./views/MaskedView";
import { MushafView } from "./views/MushafView";
import { RelayView } from "./views/RelayView";
import { WordRangeView } from "./views/WordRangeView";
import type { ViewProps } from "./views/types";

type LoadState = "loading" | "ready" | "error";

export interface Selection {
  vIdx: number;
  start: number;
  end: number;
}

export function PlayerScreen({
  chapter,
  from,
  to,
  reciterParam,
}: {
  chapter: number;
  from: number;
  to: number;
  reciterParam: number | null;
}) {
  const router = useRouter();
  const { chapters, status: appStatus, reciterId, setReciterId, reciterName, pushRecent } = useAppData();
  const { showToast } = useToast();

  // Constructed once per mount. The engine is SSR-safe (it no-ops without an
  // Audio constructor), so it must NOT be gated on `window` — doing that left
  // it null during server rendering and threw on the first subscribe.
  const [engine] = useState(() => new PlaybackEngine());

  const [load, setLoad] = useState<LoadState>("loading");
  const [slow, setSlow] = useState(false);
  const [modeSheet, setModeSheet] = useState(false);
  const [qariSheet, setQariSheet] = useState(false);
  const [relaySheet, setRelaySheet] = useState(false);
  const [popover, setPopover] = useState<PopoverTarget | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  const state = useEngineState(engine);
  const activeReciter = reciterParam ?? reciterId;

  const chapterMeta = chapters.find((c) => c.id === chapter);
  const passageName = chapterMeta?.name_simple ?? `Surah ${chapter}`;
  const title = `${passageName} ${from}${to > from ? `–${to}` : ""}`;

  useEffect(() => () => engine.destroy(), [engine]);

  useEffect(() => engine.subscribeToast(showToast), [engine, showToast]);

  // Sync the reciter chosen on the picker into app state.
  useEffect(() => {
    if (reciterParam != null && reciterParam !== reciterId) setReciterId(reciterParam);
  }, [reciterParam, reciterId, setReciterId]);

  // Load the passage.
  useEffect(() => {
    if (appStatus !== "ready" || activeReciter == null) return;
    let cancelled = false;
    setLoad("loading");
    setSlow(false);
    const slowTimer = setTimeout(() => !cancelled && setSlow(true), 5000);

    loadPassageText(chapter, from, to)
      .then(async ({ verses, translationName }) => {
        if (cancelled) return;
        if (!verses.length) throw new Error("empty passage");
        await engine.openPassage(
          { chapter, from, to, name: passageName },
          activeReciter,
          verses,
          translationName,
        );
        if (cancelled) return;
        setLoad("ready");
        pushRecent({
          chapter,
          from,
          to,
          name: passageName,
          reciter: reciterName(activeReciter),
        });
      })
      .catch(() => {
        if (!cancelled) setLoad("error");
      })
      .finally(() => clearTimeout(slowTimer));

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      engine.stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, from, to, activeReciter, appStatus, engine]);

  /* ---- word interaction ---- */

  const onWordTap = useCallback(
    (vIdx: number, pos: number, el: HTMLElement) => {
      const snap = engine.getSnapshot();
      const pending = snap.pendingLoopStart;
      if (pending) {
        // Second tap of the two-step range flow.
        if (pending.vIdx === vIdx && pending.w !== pos) {
          setSelection({ vIdx, start: Math.min(pending.w, pos), end: Math.max(pending.w, pos) });
          setPopover(null);
          return;
        }
        // A range can't span verses. Say so rather than silently restarting.
        if (pending.vIdx !== vIdx) {
          showToast(`A range stays inside one verse — pick a second word in ${snap.verses[pending.vIdx]?.key}.`);
        }
      }
      setSelection(null);
      setPopover({ vIdx, pos, rect: el.getBoundingClientRect() });
    },
    [engine, showToast],
  );

  const popWord = useMemo(() => {
    if (!popover) return null;
    return state.verses[popover.vIdx]?.words.find((w) => w.pos === popover.pos) ?? null;
  }, [popover, state.verses]);

  const setMode = (m: Mode) => {
    setSelection(null);
    setPopover(null);
    engine.setMode(m);
    if (m === "relay") setRelaySheet(true);
  };

  const startRelay = async (order: RelayParticipant[], vFrom: number, vTo: number, rounds: number) => {
    const ok = await engine.beginRelay(order, vFrom, vTo, rounds);
    if (ok) setRelaySheet(false);
  };

  /* ---- render ---- */

  if (appStatus === "error" || load === "error") {
    return (
      <main className="shell" id="main">
        <PlayerHeader
          title={title}
          qariName={reciterName(activeReciter)}
          mode="verse"
          style={state.style}
          onStyle={() => {}}
          onQari={() => {}}
        />
        <OfflineBanner />
        <div className="status-block">
          <div className="status-medallion">
            <Icon name="volume-x" size={34} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2>Can&rsquo;t reach the recitation</h2>
            <p>
              This passage couldn&rsquo;t be loaded. Check your connection and try again — your place is
              saved.
            </p>
          </div>
          <div className="status-actions">
            <button className="btn-primary" onClick={() => router.refresh()}>
              <Icon name="rotate-cw" size={17} />
              Try again
            </button>
            <button className="btn-secondary" onClick={() => router.push("/")}>
              <Icon name="chevron-left" size={16} />
              Choose another passage
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (load === "loading" || appStatus === "loading") {
    return (
      <main className="shell" id="main">
        <PlayerHeader
          title={title}
          qariName={reciterName(activeReciter)}
          mode="verse"
          style={state.style}
          onStyle={() => {}}
          onQari={() => {}}
        />
        <OfflineBanner />
        <div className="status-block">
          <div className="spinner" />
          <p>{slow ? "Still loading — the connection looks slow." : "Loading passage…"}</p>
        </div>
      </main>
    );
  }

  const viewProps: ViewProps & { selection: Selection | null } = {
    engine,
    state,
    onWordTap,
    selection,
  };

  const body =
    state.mode === "relay" && state.relay?.active ? (
      <RelayView {...viewProps} />
    ) : state.mode === "masked" ? (
      <MaskedView {...viewProps} />
    ) : state.mode === "word" ? (
      <WordRangeView {...viewProps} />
    ) : state.style === "focus" ? (
      <FocusView {...viewProps} />
    ) : (
      <MushafView {...viewProps} />
    );

  const relaySub = state.relay ? `Relay · ${state.relay.order.length} participants` : undefined;

  return (
    <main className="shell player" id="main">
      <PlayerHeader
        title={title}
        subtitle={relaySub}
        qariName={reciterName(state.reciterId ?? activeReciter)}
        mode={state.mode}
        style={state.style}
        onStyle={(s) => engine.setStyle(s)}
        onQari={() => setQariSheet(true)}
        onEditRelay={() => {
          engine.pauseRelayForEdit();
          setRelaySheet(true);
        }}
      />

      <OfflineBanner />

      {state.pendingLoopStart && !selection && (
        <div className="range-banner">
          <Icon name="brackets" size={17} style={{ color: "var(--action-primary)", flex: "none" }} />
          Start word set — tap the last word of the range
        </div>
      )}

      {body}

      {selection && (
        <div className="range-action-bar">
          <span className="ra-t">
            <b>
              {state.mode === "word" ? "Drill" : "Loop"} words {selection.start}–{selection.end}
            </b>
            <span>
              Verse {state.verses[selection.vIdx]?.key} ·{" "}
              {state.loopCount === 0 ? "until stopped" : `×${state.loopCount} passes`}
            </span>
          </span>
          <button
            className="btn-cancel"
            onClick={() => {
              setSelection(null);
              engine.clearPendingLoopStart();
            }}
          >
            Cancel
          </button>
          <button
            className="btn-commit"
            onClick={() => {
              engine.loopWordRange(selection.vIdx, selection.start, selection.end);
              setSelection(null);
            }}
          >
            <Icon name="repeat" size={15} />
            {state.mode === "word" ? "Drill" : "Loop"}
          </button>
        </div>
      )}

      <PlayerFooter engine={engine} state={state} onOpenModeSheet={() => setModeSheet(true)} />

      {popover && popWord && (
        <WordPopover
          word={popWord}
          target={popover}
          loopCount={state.loopCount}
          isWordRangeMode={state.mode === "word"}
          onSetCount={(n) => engine.setLoopCount(n)}
          onPlayWord={() => {
            engine.playWordOneshot(popover.vIdx, popover.pos);
            setPopover(null);
          }}
          onLoopWord={() => {
            engine.loopSingleWord(popover.vIdx, popover.pos, `“${popWord.gloss || popWord.tr || "word"}”`);
            setPopover(null);
          }}
          onStartRange={() => {
            engine.setPendingLoopStart(popover.vIdx, popover.pos);
            setPopover(null);
          }}
          onClose={() => setPopover(null)}
        />
      )}

      {modeSheet && (
        <ModeSheet
          mode={state.mode}
          taj={state.taj}
          onMode={setMode}
          onTaj={(on) => engine.setTajweed(on)}
          onClose={() => setModeSheet(false)}
        />
      )}

      {qariSheet && (
        <QariSheet
          currentId={state.reciterId}
          onPick={(id, name) => engine.switchReciter(id, name)}
          onClose={() => setQariSheet(false)}
        />
      )}

      {relaySheet && (
        <RelaySetupSheet
          verses={state.verses}
          defaultReciterId={state.reciterId ?? activeReciter ?? 0}
          initial={
            state.relay
              ? {
                  order: state.relay.order,
                  vFrom: state.relay.vFrom,
                  vTo: state.relay.vTo,
                  rounds: state.relay.rounds,
                }
              : undefined
          }
          onStart={startRelay}
          onClose={() => {
            setRelaySheet(false);
            if (!state.relay?.active) engine.setMode("verse");
          }}
        />
      )}
    </main>
  );
}
