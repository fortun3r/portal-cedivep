import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mysql2 is not in Next's default server-external list.
  serverExternalPackages: ["mysql2"],
  poweredByHeader: false,
  // Keep `next dev` from writing its own block into our CLAUDE.md.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
