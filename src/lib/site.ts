// 서비스 정식 주소 — 메타데이터(og·canonical), OAuth 콜백, QR 링크가 같은 값을 쓴다.
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const SITE_URL = (configuredSiteUrl || "https://loverebbit.xyz").replace(/\/+$/, "");
