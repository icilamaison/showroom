import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/:path*`,
      },
    ];
  },
  webpack: (config, { dev }) => {
    // Dev HMR 중 webpack 청크 캐시가 꼬이며 './833.js' 류 오류가 나는 것을 방지
    if (dev) {
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;
