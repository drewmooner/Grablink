import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase timeout for long-running video extraction
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // For App Router, body size limits are set in route.ts files
  
  // Turbopack configuration (Next.js 16 default)
  turbopack: {
    // Empty config - we handle FFmpeg path resolution manually at runtime
  },
  
  // Webpack configuration for production builds (fallback)
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
