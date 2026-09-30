import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      { source: "/@:username", destination: "/u/:username" },
      { source: "/@:username/:pageSlug", destination: "/u/:username/:pageSlug" },
      { source: "/@:username/book/:serviceSlug", destination: "/u/:username/book/:serviceSlug" },
    ];
  },
};

export default nextConfig;