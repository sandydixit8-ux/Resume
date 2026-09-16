/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@nexus/ui", "@nexus/contracts"],
  experimental: {
    optimizePackageImports: ["@nexus/ui"],
  },
};

export default nextConfig;