import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // 画像データを含むServer Actionsのため10MBに増量
    },
  },
};

export default nextConfig;
