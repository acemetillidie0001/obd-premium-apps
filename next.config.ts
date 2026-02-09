import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ocalabusinessdirectory.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/demo",
        destination: "/apps/demo",
        permanent: true,
      },
      {
        source: "/demo/exit",
        destination: "/apps/demo/exit",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
