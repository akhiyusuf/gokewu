import Link from "next/link";
import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/shared/Icon";

export const metadata: Metadata = {
  title: "Data & attributions — Hifz",
};

/**
 * Attribution is a compliance requirement, not a nicety — the Quran
 * Foundation licence requires it, and each additional dataset carries its own
 * obligations. Datasets are listed here only once they actually ship.
 */
const SOURCES: { icon: IconName; title: string; sub: string; href: string; badge?: string }[] = [
  {
    icon: "book",
    title: "Quran text & audio",
    sub: "Quran Foundation — quran.com v4 API",
    href: "https://api-docs.quran.foundation/",
  },
  {
    icon: "languages",
    title: "Translation",
    sub: "Saheeh International, via the quran.com v4 API",
    href: "https://quran.com/about-us",
  },
  {
    icon: "palette",
    title: "Tajweed colouring",
    sub: "Rule classes from the v4 word markup",
    href: "https://quran.com/about-us",
  },
  {
    icon: "git-compare",
    title: "Confusable words",
    // CC-BY-4.0 requires attribution, the paper citation and a licence link.
    sub: "QuranMorph — SinaLab, Birzeit University. Akra, Hammouda & Jarrar (2025), “QuranMorph: Morphologically Annotated Quranic Corpus”. Licensed CC-BY-4.0.",
    href: "https://creativecommons.org/licenses/by/4.0/",
    badge: "Beta",
  },
  {
    icon: "layers",
    title: "Recurring phrases",
    sub: "Mutashabihat dataset — Quranic Universal Library (QUL).",
    href: "https://qul.tarteel.ai/",
    badge: "Beta",
  },
];

export default function CreditsPage() {
  return (
    <main className="shell" id="main">
      <nav className="page-nav">
        <Link className="icon-btn sm tap" href="/" aria-label="Back">
          <Icon name="chevron-left" size={19} />
        </Link>
        <h1>Data &amp; attributions</h1>
      </nav>

      <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)", marginBottom: 2 }}>
          Quran text, translations, and recitations are provided by the sources below.
        </p>

        {SOURCES.map((s) => (
          <a
            key={s.title}
            className="credit-card"
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <span className="credit-tile">
              <Icon name={s.icon} size={18} />
            </span>
            <span className="credit-text">
              <b style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {s.title}
                {s.badge && <span className="badge-beta">{s.badge}</span>}
              </b>
              <span>{s.sub}</span>
            </span>
            <Icon name="external-link" size={15} style={{ color: "var(--text-muted)", flex: "none" }} />
          </a>
        ))}

        <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)", marginTop: 6 }}>
          API content is cached on this device for no more than seven days, in line with the Quran
          Foundation developer terms. The QuranMorph corpus is provided for peaceful, non-military and
          non-malicious use only.
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
          Recurring-phrase and confusable-word markings are algorithmic candidates, not a curated
          list. They point out where the text resembles itself; they do not interpret it.
        </p>

        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            color: "var(--text-muted)",
            marginTop: 2,
          }}
        >
          <Icon name="shield-check" size={14} />
          Quran content is always free to access.
        </span>
      </div>
    </main>
  );
}
