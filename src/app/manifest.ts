import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hifz — Quran reading & memorisation",
    short_name: "Hifz",
    description:
      "Quran reading and memorisation player with word-level timing, tajweed colouring, masked recall and relay practice.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF8F3",
    theme_color: "#FAF8F3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
