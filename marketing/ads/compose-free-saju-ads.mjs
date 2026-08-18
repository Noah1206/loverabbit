import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "marketing", "ads", "source");
const outputDir = path.join(root, "marketing", "ads");
const publicDir = path.join(root, "public", "ads");
const logoPath = path.join(root, "public", "logo.png");

await mkdir(sourceDir, { recursive: true });
await mkdir(publicDir, { recursive: true });

const svg = (width, height, content) =>
  Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .kr { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; }
      </style>
      ${content}
    </svg>
  `);

async function makePortrait() {
  const width = 1080;
  const height = 1920;
  const background = path.join(sourceDir, "free-saju-portrait-bg.png");
  const output = path.join(outputDir, "free-saju-ad-9x16.jpg");
  const publicOutput = path.join(publicDir, "free-saju-ad-9x16.jpg");
  const logo = await sharp(logoPath).resize(92, 92).png().toBuffer();

  const overlay = svg(width, height, `
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#090305" stop-opacity="0.86"/>
        <stop offset="0.48" stop-color="#120407" stop-opacity="0.42"/>
        <stop offset="1" stop-color="#080204" stop-opacity="0.68"/>
      </linearGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff315f"/>
        <stop offset="1" stop-color="#d71142"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.72"/>
      </filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#veil)"/>
    <rect x="70" y="88" width="156" height="54" rx="27" fill="#ff315f"/>
    <text class="kr" x="148" y="125" fill="#fff" font-size="27" font-weight="900" text-anchor="middle" letter-spacing="2">소름주의</text>
    <text class="kr" x="70" y="270" fill="#fff8f3" font-size="80" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="70" dy="0">그 사람이 숨긴</tspan>
      <tspan x="70" dy="100" fill="#ff547c">진짜 속마음</tspan>
    </text>
    <text class="kr" x="72" y="520" fill="#f7d9db" font-size="39" font-weight="700" letter-spacing="-1">
      <tspan x="72" dy="0">사주에는 다 찍혀 있습니다</tspan>
      <tspan x="72" dy="60" fill="#fff">가입 없이 10문장 먼저 공개</tspan>
    </text>
    <rect x="70" y="1682" width="940" height="126" rx="63" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="540" y="1761" fill="#fff" font-size="43" font-weight="900" text-anchor="middle">지금 무료로 확인하기  →</text>
    <text class="kr" x="178" y="1856" fill="#fff" font-size="31" font-weight="900">LOVERABBIT</text>
    <text class="kr" x="403" y="1856" fill="#d7b8ba" font-size="26" font-weight="600">무료 연애 사주 · 오락 목적</text>
  `);

  await sharp(background)
    .resize(width, height, { fit: "cover" })
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: logo, top: 1810, left: 70 },
    ])
    .jpeg({ quality: 93, chromaSubsampling: "4:4:4" })
    .toFile(output);
  await copyFile(output, publicOutput);
}

async function makeLandscape() {
  const width = 1920;
  const height = 1080;
  const background = path.join(sourceDir, "free-saju-landscape-bg.png");
  const output = path.join(outputDir, "free-saju-ad-16x9.jpg");
  const publicOutput = path.join(publicDir, "free-saju-ad-16x9.jpg");
  const logo = await sharp(logoPath).resize(78, 78).png().toBuffer();

  const overlay = svg(width, height, `
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#070203" stop-opacity="0.94"/>
        <stop offset="0.54" stop-color="#0e0305" stop-opacity="0.50"/>
        <stop offset="1" stop-color="#090204" stop-opacity="0.18"/>
      </linearGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff315f"/>
        <stop offset="1" stop-color="#d71142"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.76"/>
      </filter>
    </defs>
    <rect width="1920" height="1080" fill="url(#veil)"/>
    <rect x="96" y="88" width="164" height="56" rx="28" fill="#ff315f"/>
    <text class="kr" x="178" y="126" fill="#fff" font-size="28" font-weight="900" text-anchor="middle" letter-spacing="2">소름주의</text>
    <text class="kr" x="96" y="280" fill="#fff8f3" font-size="82" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="96" dy="0">그 사람의 속마음,</tspan>
      <tspan x="96" dy="104" fill="#ff547c">사주에는 숨지 못합니다</tspan>
    </text>
    <text class="kr" x="100" y="526" fill="#f4d7d9" font-size="38" font-weight="700">
      <tspan x="100" dy="0">회원가입 전에 무료 10문장 공개</tspan>
      <tspan x="100" dy="58" fill="#fff">결론 · 정확한 시기 · 행동 가이드는 전문에서</tspan>
    </text>
    <rect x="96" y="700" width="660" height="112" rx="56" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="426" y="771" fill="#fff" font-size="39" font-weight="900" text-anchor="middle">무료 사주 먼저 보기  →</text>
    <text class="kr" x="188" y="954" fill="#fff" font-size="31" font-weight="900">LOVERABBIT</text>
    <text class="kr" x="413" y="954" fill="#d7b8ba" font-size="25" font-weight="600">무료 연애 사주 · 오락 목적</text>
  `);

  await sharp(background)
    .resize(width, height, { fit: "cover" })
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: logo, top: 910, left: 96 },
    ])
    .jpeg({ quality: 93, chromaSubsampling: "4:4:4" })
    .toFile(output);
  await copyFile(output, publicOutput);
}

await Promise.all([makePortrait(), makeLandscape()]);

console.log("Created marketing/ads/free-saju-ad-9x16.jpg");
console.log("Created marketing/ads/free-saju-ad-16x9.jpg");
