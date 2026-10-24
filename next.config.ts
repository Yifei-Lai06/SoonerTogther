import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    return [
      { source: "/home", destination: "/dashboard", permanent: false },
      { source: "/discover", destination: "/match", permanent: false },
      { source: "/profile", destination: "/students/me", permanent: false },
    ];
  },
  partialPrefetching: true,
  experimental: {
    // The app pages render from browser storage (demo mode), so only validate
    // instant navigation for segments that explicitly opt in.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
