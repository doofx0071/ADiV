import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve("."),
  },
  // Keep the dev tools roundel off the mobile bottom nav bar. E2E runs hide
  // it entirely — on top-right it intercepts clicks meant for the theme toggle
  // (nextjs-portal swallows pointer events over it).
  devIndicators: process.env.E2E ? false : {
    position: "top-right",
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
