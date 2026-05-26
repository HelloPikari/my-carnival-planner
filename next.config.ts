import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint is not installed in this project — lint runs separately via CI
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
