"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { Icon } from "./Icon";

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      className="icon-btn tap"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      style={dark ? { color: "var(--action-primary)" } : undefined}
    >
      <Icon name={dark ? "sun" : "moon"} size={19} />
    </button>
  );
}
