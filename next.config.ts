import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 【試作/実機テスト用】LAN上のタブレットから dev サーバーへアクセスするとき、
  // Next が /_next/ 等の dev リソースをクロスオリジンでブロックし、
  // クライアントJSが動かず Server Action(サインイン等)が無反応になる。
  // dev サーバーのLAN IPを許可する。(dev限定設定・本番に影響なし)
  allowedDevOrigins: ['192.168.2.105'],
};

export default nextConfig;
