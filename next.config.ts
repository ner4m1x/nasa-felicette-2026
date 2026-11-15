import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Python pipeline (scripts/: .venv, data_raw, out) is never part of the app's server trace.
  // (scripts/config/deck_text.json is imported by src/lib/userCards.ts and bundled, not traced.)
  outputFileTracingExcludes: {
    "/*": ["scripts/**/*"],
  },
  cacheComponents: true,
  partialPrefetching: true,
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
