import type { Metadata, Viewport } from "next";
import { Amiri_Quran, Bricolage_Grotesque, Inter, Space_Grotesk } from "next/font/google";
import { AppDataProvider } from "@/components/providers/AppDataProvider";
import { AppSidebar } from "@/components/shared/AppSidebar";
import { ThemeProvider, themeInitScript } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display-loaded",
  display: "swap",
});
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-loaded",
  display: "swap",
});
const numeral = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-numeral-loaded",
  display: "swap",
});
const arabic = Amiri_Quran({
  subsets: ["arabic"],
  weight: "400",
  variable: "--font-arabic-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hifz — Quran reading & memorisation",
  description:
    "A mobile-first Quran reading and memorisation player with word-level audio timing, tajweed colouring, masked recall and relay practice.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8F3" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1712" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${numeral.variable} ${arabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Set the theme before first paint so there's no flash of the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ThemeProvider>
          <ToastProvider>
            <AppDataProvider>
              <AppSidebar />
              {children}
            </AppDataProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
