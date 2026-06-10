import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // pin the workspace root (this folder) so a parent lockfile isn't picked up
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
