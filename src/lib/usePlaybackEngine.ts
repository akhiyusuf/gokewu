"use client";

import { useSyncExternalStore } from "react";
import type { EngineState, PlaybackEngine } from "./engine";

/**
 * Binds a PlaybackEngine to React. The engine only notifies on meaningful
 * state changes — per-frame time updates go through `subscribeTime` instead
 * (see SeekBar), so playback doesn't re-render the tree 60 times a second.
 */
export function useEngineState(engine: PlaybackEngine): EngineState {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
