import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents (pre-rendering + caching on the server) is off: this app loads
  // all its data in the browser, so there's nothing on the server to pre-render.
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
