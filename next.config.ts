import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e suite builds with placeholder config into its own directory, so it never
  // overwrites (or reuses) a real build in .next. See scripts/e2e/inner.sh.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
