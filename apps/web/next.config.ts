import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@twentynine/engine"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
