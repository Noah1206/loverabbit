import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // 구 A/B 경로 정리: 파스텔이 기본이 되면서 /pastel은 홈으로
      { source: "/pastel", destination: "/", permanent: false },
      // 정식 주소는 apex — www로 들어온 요청은 같은 경로로 넘긴다 (OAuth 쿠키/중복 색인 방지)
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.loverebbit.xyz" }],
        destination: "https://loverebbit.xyz/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
