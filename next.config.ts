// next.config.ts
import type { NextConfig } from "next";

// 実機テスト用: LAN上のタブレット等から dev サーバーへアクセスする際のオリジン許可。
// dev限定・本番に影響なし。IPは .env.local の DEV_LAN_ORIGINS に置く（リポに残さない）。
const devLanOrigins =
  process.env.DEV_LAN_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  ...(devLanOrigins.length > 0 ? { allowedDevOrigins: devLanOrigins } : {}),
};

export default nextConfig;