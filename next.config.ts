import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true, // Disable TypeScript errors blocking the build
  },
  eslint: {
    ignoreDuringBuilds: true, // Ignore ESLint errors during the build
  },
};

export default nextConfig;