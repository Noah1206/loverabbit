import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assetDir = path.join(root, "marketing", "ads", "product-campaigns-v1");
const logoPath = path.join(root, "public", "logo.png");

await mkdir(assetDir, { recursive: true });

const campaigns = [
  {
    slug: "compatibility",
    badge: "속궁합 리포트",
    badgeWidth: 244,
    headline: ["말보다 먼저 닿는", "두 사람의 온도"],
    sub: ["끌림 구조·주도권·관계의 완급을", "일주 단위로 분석합니다"],
    highlight: "무료 10문장 미리보기",
    cta: "두 사람의 상성 확인하기  →",
    accent: "#ff3d7f",
    accentSoft: "#ff6d9d",
    accent2: "#8b5cf6",
    veil: "#10030a",
  },
  {
    slug: "reunion",
    badge: "재회 흐름 리포트",
    badgeWidth: 282,
    headline: ["다시 이어질 가능성을", "정리해 보는 시간"],
    sub: ["남은 감정·연락 흐름·다음 행동의 기준을", "개인화 리포트로 정리합니다"],
    highlight: "무료 재회 흐름 미리보기",
    cta: "재회 흐름 확인하기  →",
    accent: "#ff4f87",
    accentSoft: "#ff8ab2",
    accent2: "#8b5cf6",
    veil: "#10050d",
  },
  {
    slug: "lifetime-romance",
    badge: "평생 연애운",
    badgeWidth: 214,
    headline: ["연애의 큰 흐름,", "어떤 모양일까?"],
    sub: ["인연이 열리는 시기와 반복되는 패턴을", "한 장의 리포트로 펼쳐봅니다"],
    highlight: "무료 핵심 미리보기 · 전체 990원",
    cta: "평생 흐름 미리보기  →",
    accent: "#d7436b",
    accentSoft: "#e8b84b",
    accent2: "#8b5cf6",
    veil: "#110508",
  },
];

const svg = (width, height, content) =>
  Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .kr { font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif; }
      </style>
      ${content}
    </svg>
  `);

function defs(c) {
  return `
    <defs>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${c.accent}"/>
        <stop offset="1" stop-color="${c.accent2}"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.74"/>
      </filter>
    </defs>
  `;
}

function portraitOverlay(c) {
  const width = 1080;
  const height = 1920;
  const headline = c.headline
    .map((line, index) => `<tspan x="70" dy="${index === 0 ? 0 : 92}"${index === 1 ? ` fill="${c.accentSoft}"` : ""}>${line}</tspan>`)
    .join("");
  const sub = c.sub
    .map((line, index) => `<tspan x="74" dy="${index === 0 ? 0 : 50}">${line}</tspan>`)
    .join("");

  return svg(width, height, `
    ${defs(c)}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.veil}" stop-opacity="0.72"/>
        <stop offset="0.42" stop-color="${c.veil}" stop-opacity="0.12"/>
        <stop offset="0.72" stop-color="${c.veil}" stop-opacity="0"/>
        <stop offset="1" stop-color="#07040b" stop-opacity="0.84"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#veil)"/>
    <rect x="70" y="76" width="${c.badgeWidth}" height="68" rx="34" fill="${c.accent}"/>
    <text class="kr" x="${70 + c.badgeWidth / 2}" y="122" fill="#fff" font-size="29" font-weight="900" text-anchor="middle">${c.badge}</text>

    <text class="kr" x="70" y="264" fill="#fffaf7" font-size="73" font-weight="900" letter-spacing="-4" filter="url(#shadow)">${headline}</text>
    <text class="kr" x="74" y="492" fill="#f5edf2" font-size="32" font-weight="650" letter-spacing="-1">${sub}</text>
    <text class="kr" x="74" y="614" fill="${c.accentSoft}" font-size="39" font-weight="900">${c.highlight}</text>

    <rect x="70" y="1640" width="940" height="122" rx="61" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="540" y="1718" fill="#fff" font-size="38" font-weight="900" text-anchor="middle">${c.cta}</text>

    <text class="kr" x="128" y="1878" fill="#fff" font-size="25" font-weight="900">LOVE<tspan fill="${c.accentSoft}">RABBIT</tspan></text>
    <text class="kr" x="360" y="1878" fill="#c1b5c6" font-size="20" font-weight="550">오락 목적의 콘텐츠입니다.</text>
  `);
}

function landscapeOverlay(c) {
  const width = 1200;
  const height = 628;
  const headline = c.headline
    .map((line, index) => `<tspan x="58" dy="${index === 0 ? 0 : 64}"${index === 1 ? ` fill="${c.accentSoft}"` : ""}>${line}</tspan>`)
    .join("");
  const sub = c.sub
    .map((line, index) => `<tspan x="60" dy="${index === 0 ? 0 : 35}">${line}</tspan>`)
    .join("");

  return svg(width, height, `
    ${defs(c)}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${c.veil}" stop-opacity="0.80"/>
        <stop offset="0.52" stop-color="${c.veil}" stop-opacity="0.16"/>
        <stop offset="0.74" stop-color="${c.veil}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="628" fill="url(#veil)"/>
    <rect x="58" y="40" width="${Math.round(c.badgeWidth * 0.78)}" height="50" rx="25" fill="${c.accent}"/>
    <text class="kr" x="${58 + Math.round(c.badgeWidth * 0.78) / 2}" y="74" fill="#fff" font-size="22" font-weight="900" text-anchor="middle">${c.badge}</text>

    <text class="kr" x="58" y="166" fill="#fffaf7" font-size="50" font-weight="900" letter-spacing="-3" filter="url(#shadow)">${headline}</text>
    <text class="kr" x="60" y="294" fill="#f5edf2" font-size="23" font-weight="650">${sub}</text>
    <text class="kr" x="60" y="372" fill="${c.accentSoft}" font-size="28" font-weight="900">${c.highlight}</text>

    <rect x="58" y="402" width="430" height="78" rx="39" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="273" y="452" fill="#fff" font-size="27" font-weight="900" text-anchor="middle">${c.cta}</text>

    <text class="kr" x="112" y="555" fill="#fff" font-size="23" font-weight="900">LOVE<tspan fill="${c.accentSoft}">RABBIT</tspan></text>
    <text class="kr" x="112" y="584" fill="#c1b5c6" font-size="16" font-weight="550">loverebbit.xyz · 오락 목적의 콘텐츠입니다.</text>
  `);
}

async function exportCampaign(c) {
  const logoPortrait = await sharp(logoPath).resize(46, 46).png().toBuffer();
  const logoLandscape = await sharp(logoPath).resize(42, 42).png().toBuffer();

  const portrait = await sharp(path.join(assetDir, `${c.slug}-vertical-bg.png`))
    .resize(1080, 1920, { fit: "cover", position: "center" })
    .composite([
      { input: portraitOverlay(c), top: 0, left: 0 },
      { input: logoPortrait, top: 1842, left: 70 },
    ])
    .png()
    .toBuffer();

  const landscape = await sharp(path.join(assetDir, `${c.slug}-horizontal-bg.png`))
    .resize(1200, 628, { fit: "cover", position: "center" })
    .composite([
      { input: landscapeOverlay(c), top: 0, left: 0 },
      { input: logoLandscape, top: 516, left: 58 },
    ])
    .png()
    .toBuffer();

  await Promise.all([
    sharp(portrait).toFile(path.join(assetDir, `${c.slug}-ad-vertical-1080x1920.png`)),
    sharp(portrait).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(assetDir, `${c.slug}-ad-vertical-1080x1920.jpg`)),
    sharp(landscape).toFile(path.join(assetDir, `${c.slug}-ad-horizontal-1200x628.png`)),
    sharp(landscape).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(assetDir, `${c.slug}-ad-horizontal-1200x628.jpg`)),
  ]);
}

await Promise.all(campaigns.map(exportCampaign));

console.log("Created 3 product campaigns x 2 aspect ratios in marketing/ads/product-campaigns-v1");
