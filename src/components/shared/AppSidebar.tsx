"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

/**
 * Desktop (≥1440px) sidebar. Deliberately minimal: it lists only destinations
 * that exist. Progress, Saved and Revision join it when those screens ship —
 * a sidebar of dead links would be worse than none.
 */
const NAV: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Read", icon: "book-open", match: (p) => p === "/" || p.startsWith("/read") },
  { href: "/settings", label: "Settings", icon: "settings-2", match: (p) => p === "/settings" },
  { href: "/credits", label: "Data & attributions", icon: "shield-check", match: (p) => p === "/credits" },
  { href: "/privacy", label: "Privacy", icon: "info", match: (p) => p === "/privacy" },
];

export function AppSidebar() {
  const pathname = usePathname() || "/";
  return (
    <nav className="app-sidebar" aria-label="Main">
      <div className="as-brand">
        <span className="as-mark">
          <Icon name="book-open" size={19} />
        </span>
        <span className="as-name">
          <b>Hifz</b>
          <span>Quran study</span>
        </span>
      </div>
      <div className="as-items">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`as-item${n.match(pathname) ? " on" : ""}`}>
            <Icon name={n.icon} size={18} />
            {n.label}
          </Link>
        ))}
      </div>
      <span className="as-foot">Quran content is always free to access</span>
    </nav>
  );
}
