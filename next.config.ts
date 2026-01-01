import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase timeout for long-running video extraction
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // For App Router, body size limits are set in route.ts files
  
  // Force webpack for builds to avoid Turbopack UTF-8 encoding bug
  // Set empty turbopack config to allow webpack config to work
  turbopack: {},
  
  // Webpack configuration for production builds
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize @ffmpeg-installer/ffmpeg to avoid bundling issues
      config.externals = config.externals || [];
      config.externals.push({
        "@ffmpeg-installer/ffmpeg": "commonjs @ffmpeg-installer/ffmpeg",
      });
    }
    return config;
  },
};

export default nextConfig;
