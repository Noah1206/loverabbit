import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 사전 제작 삽화·부적·캐릭터 모션은 내용이 바뀌지 않는 파일이다.
        //
        // public/ 아래는 Next 가 기본으로 max-age=0 을 붙인다. 그러면 브라우저가
        // 갖고 있으면서도 볼 때마다 "안 바뀌었죠?" 를 묻는다. 느린 회선에서 재보니
        // 그림 여섯 장 재검증에만 330ms 가 들었다 - 이미 받아 둔 그림을 보여주려고
        // 왕복 여섯 번을 하는 셈이다.
        //
        // 한 달로 잡는다. 그림을 갈아 끼울 일이 아주 없지는 않아서 immutable 은
        // 피했고, stale-while-revalidate 로 교체분은 뒤에서 조용히 따라오게 둔다.
        // 급히 바꿔야 하면 파일 이름을 바꾸는 편이 확실하다.
        source: "/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
      {
        source: "/characters/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
      {
        source: "/cards-motion/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
      {
        source: "/cards-pastel/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
    ];
  },
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
