import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/shared/Icon";

export const metadata: Metadata = {
  title: "Privacy — Hifz",
};

/**
 * The honest version: there is nothing to disclose beyond "everything stays on
 * your device." Saying so explicitly is still worth a page — an app used for
 * worship should not make people wonder.
 */
export default function PrivacyPage() {
  const sectionStyle = { display: "flex", flexDirection: "column" as const, gap: 6 };
  const h2Style = {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 15,
  };
  const pStyle = { fontSize: 13.5, lineHeight: 1.55, color: "var(--text-secondary)" };

  return (
    <main className="shell" id="main">
      <nav className="page-nav">
        <Link className="icon-btn sm tap" href="/" aria-label="Back">
          <Icon name="chevron-left" size={19} />
        </Link>
        <h1>Privacy</h1>
      </nav>

      <div style={{ flex: 1, padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
        <p style={{ ...pStyle, fontSize: 14.5, color: "var(--text-primary)" }}>
          Hifz has no accounts, no analytics, no advertising, and no server that stores anything
          about you.
        </p>

        <section style={sectionStyle}>
          <h2 style={h2Style}>What stays on your device</h2>
          <p style={pStyle}>
            Your reading position, recent passages, day streak, chosen reciter, theme, and settings
            are saved in your browser&rsquo;s local storage. They never leave your device, and we
            cannot see them. Clearing your browser data removes them.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>What the app requests from the internet</h2>
          <p style={pStyle}>
            Quran text, translations, and recitation audio are fetched from the Quran Foundation
            (quran.com). Those requests go directly from your browser to their servers and are
            governed by their privacy policy. We add no identifiers to them. API content is cached
            on your device for at most seven days, in line with the Quran Foundation developer
            terms.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Study annotations</h2>
          <p style={pStyle}>
            The recurring-phrase and near-twin markings ship with the app as static files. Looking
            them up involves no third party.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Cookies and tracking</h2>
          <p style={pStyle}>None. No cookies, no fingerprinting, no third-party scripts.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Changes and contact</h2>
          <p style={pStyle}>
            If this policy ever changes — for example, if error reporting is added — this page will
            say so plainly, including what is collected and why. Questions:{" "}
            <a href="mailto:contact@brotheryusuf.com" style={{ color: "var(--action-primary)" }}>
              contact@brotheryusuf.com
            </a>
            .
          </p>
        </section>

        <Link
          href="/credits"
          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}
        >
          <Icon name="shield-check" size={14} />
          Data sources &amp; attributions
        </Link>
      </div>
    </main>
  );
}
