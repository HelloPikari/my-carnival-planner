import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint is not installed in this project — lint runs separately via CI
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
