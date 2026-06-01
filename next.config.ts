import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "biomedicconsulting.com",
      },
    ],
  },
};

export default nextConfig;
