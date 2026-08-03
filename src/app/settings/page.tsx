"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Icon } from "@/components/shared/Icon";
import { STORAGE_KEYS } from "@/lib/constants";
import { readStorage, writeStorage } from "@/lib/storage";

/**
 * One place for every preference that used to live scattered inside sheets.
 * Everything here is stored on-device; nothing syncs anywhere.
 */

function useSetting(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    setValue(readStorage<boolean>(key) ?? fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (v: boolean) => {
    setValue(v);
    writeStorage(key, v);
  };
  return [value, set];
}

function SettingRow({
  title,
  sub,
  checked,
  onChange,
}: {
  title: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="settings-row" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      <span className="st">
        <b>{title}</b>
        <span>{sub}</span>
      </span>
      <button
        className={`switch${checked ? " on" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { dark, toggle } = useTheme();
  const { showToast } = useToast();

  const [taj, setTaj] = useSetting(STORAGE_KEYS.taj, false);
  const [phrases, setPhrases] = useSetting(STORAGE_KEYS.layerPhrases, true);
  const [twins, setTwins] = useSetting(STORAGE_KEYS.layerConfusables, true);
  const [trans, setTrans] = useSetting(STORAGE_KEYS.showTranslation, true);

  const clearHistory = () => {
    if (!window.confirm("Clear your reading history, recents and day streak? This cannot be undone.")) return;
    for (const k of ["hifz.sessions", "hifz.days", STORAGE_KEYS.recents]) window.localStorage.removeItem(k);
    showToast("Reading history cleared");
  };

  const clearCache = () => {
    for (const k of [STORAGE_KEYS.chapters, STORAGE_KEYS.recitations]) window.localStorage.removeItem(k);
    showToast("Cached content cleared — it re-downloads on next use");
  };

  const eyebrow = { marginTop: 6 } as const;

  return (
    <main className="shell" id="main">
      <nav className="page-nav">
        <Link className="icon-btn sm tap" href="/" aria-label="Back">
          <Icon name="chevron-left" size={19} />
        </Link>
        <h1>Settings</h1>
      </nav>

      <div style={{ flex: 1, padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 9, maxWidth: 640 }}>
        <span className="label-eyebrow">Appearance</span>
        <SettingRow title="Dark theme" sub="Easier on the eyes at night" checked={dark} onChange={toggle} />
        <SettingRow
          title="Tajweed colours"
          sub="Colour letters by recitation rule"
          checked={taj}
          onChange={setTaj}
        />
        <SettingRow
          title="Show translation while playing"
          sub="Keeps the current verse's meaning above the player"
          checked={trans}
          onChange={setTrans}
        />

        <span className="label-eyebrow" style={eyebrow}>
          Study layers
        </span>
        <SettingRow
          title="Recurring phrases"
          sub="Marks passages that recur elsewhere in the Quran"
          checked={phrases}
          onChange={setPhrases}
        />
        <SettingRow
          title="Near-twin words"
          sub="Marks words that look like a different word elsewhere"
          checked={twins}
          onChange={setTwins}
        />
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "2px 4px 0" }}>
          Changes apply when you next open a passage. Inside the player, the Layers chips switch
          them instantly.
        </p>

        <span className="label-eyebrow" style={eyebrow}>
          Data
        </span>
        <button className="settings-row" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", textAlign: "left" }} onClick={clearHistory}>
          <span className="st">
            <b>Clear reading history</b>
            <span>Removes sessions, recents and your day streak from this device</span>
          </span>
          <Icon name="rotate-ccw" size={17} style={{ color: "var(--state-error)", flex: "none" }} />
        </button>
        <button className="settings-row" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", textAlign: "left" }} onClick={clearCache}>
          <span className="st">
            <b>Clear cached content</b>
            <span>Surah and reciter lists re-download on next use (kept at most 7 days)</span>
          </span>
          <Icon name="cloud-off" size={17} style={{ color: "var(--text-muted)", flex: "none" }} />
        </button>

        <span className="label-eyebrow" style={eyebrow}>
          About
        </span>
        <div className="link-row" style={{ justifyContent: "flex-start", padding: "0 4px" }}>
          <Link href="/credits">Data &amp; attributions</Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy">Privacy</Link>
          <span aria-hidden="true">·</span>
          <span>v0.1.0</span>
        </div>
      </div>
    </main>
  );
}
