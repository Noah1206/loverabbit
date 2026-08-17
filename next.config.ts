import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // 구 A/B 경로 정리: 파스텔이 기본이 되면서 /pastel은 홈으로
    return [{ source: "/pastel", destination: "/", permanent: false }];
  },
};

export default nextConfig;
