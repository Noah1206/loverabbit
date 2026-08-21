import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // 구 A/B 경로 정리: 파스텔이 기본이 되면서 /pastel은 홈으로
      { source: "/pastel", destination: "/", permanent: false },
      // 내린 상품. 광고 소재 06(평생 연애운)이 이 주소를 랜딩으로 갖고 있어서,
      // 그 소재가 아직 돌고 있으면 유료 클릭이 그대로 404 를 맞는다.
      // 홈으로 보낸다 — 값을 약속하지 않으면서 다른 상품을 고를 수 있는 유일한 자리다.
      // 비슷한 상품으로 넘기지 않는 것은 의도다. 소재는 "990원"을 말하는데
      // 도착지가 14,900원이면 광고가 거짓말이 된다.
      { source: "/product/pyeongsaeng", destination: "/", permanent: false },
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
