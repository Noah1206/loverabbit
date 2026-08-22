import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Higgsfield marketing_studio_image 결과물 마감.
//
// 모델이 내놓은 것은 928x1152 이고 브랜드도 고지도 없다. 그대로는 못 올린다 -
// 메타 피드 4:5 권장은 1080x1350 이고, 이 계정의 다른 소재는 전부 "오락 목적의
// 콘텐츠입니다" 를 달고 나간다. 19금 소재는 연령 고지도 있어야 한다.
//
// 잘라내지 않고 세로를 맞춘다. 모델이 CTA 를 아래쪽 끝에 붙여 놔서, cover 로
// 채우면 그 버튼이 잘린다. 좌우에 얇은 여백이 생기는 편이 낫다.
//
//   node marketing/ads/adult-hook-v1/ai-version/finish-ai-version.mjs

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..", "..");
const logoPath = path.join(root, "public", "logo.png");

const W = 1080;
const H = 1350;
const BAR = 78;

const items = [
  { file: "ai-01-intimate", highlight: "#ff758f", adult: false },
  { file: "ai-02-character-night", highlight: "#ff5c72", adult: true },
  { file: "ai-03-timing", highlight: "#f2b066", adult: false },
];

const bar = (c) => Buffer.from(`
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <style>.kr { font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif; }</style>
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#07040b" stop-opacity="0"/>
        <stop offset="1" stop-color="#07040b" stop-opacity="0.94"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${H - BAR - 46}" width="${W}" height="${BAR + 46}" fill="url(#fade)"/>
    <text class="kr" x="118" y="${H - 28}" fill="#fff" font-size="24" font-weight="900">LOVE<tspan fill="${c.highlight}">RABBIT</tspan></text>
    <text class="kr" x="344" y="${H - 28}" fill="#c5b9ca" font-size="18" font-weight="550">${
      c.adult ? "만 19세 이상 · 오락 목적의 콘텐츠입니다." : "오락 목적의 콘텐츠입니다."
    }</text>
  </svg>
`);

const logo = await sharp(logoPath).resize(44, 44).png().toBuffer();

for (const c of items) {
  const src = path.join(here, `${c.file}.png`);
  const out = path.join(here, `${c.file}-finished-1080x1350`);

  const fitted = await sharp(src)
    .resize(W, H, { fit: "contain", background: "#07040b" })
    .composite([
      { input: bar(c), top: 0, left: 0 },
      { input: logo, top: H - 62, left: 62 },
    ])
    .png()
    .toBuffer();

  await Promise.all([
    sharp(fitted).toFile(`${out}.png`),
    sharp(fitted).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(`${out}.jpg`),
  ]);
}

console.log(`Finished ${items.length} AI images to ${W}x${H} with brand bar`);
