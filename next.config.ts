import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve("."),
  },
  // Keep the dev tools roundel off the mobile bottom nav bar
  devIndicators: {
    position: "top-right",
  },
};

export default nextConfig;
