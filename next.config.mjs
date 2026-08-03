/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // 3.3MB of static annotation JSON that only changes when the datasets
        // are regenerated. Cached forever; the fetch URL carries a ?v= version
        // (ANNOTATIONS_VERSION in src/lib/constants.ts) that is bumped on
        // regeneration, so stale entries can never be served after an update.
        source: "/data/annotations/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
