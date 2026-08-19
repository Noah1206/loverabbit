import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assetDir = path.join(root, "marketing", "ads", "free-saju-imagegen-v5");
const logoPath = path.join(root, "public", "logo.png");

await mkdir(assetDir, { recursive: true });

const svg = (width, height, content) =>
  Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .kr { font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif; }
      </style>
      ${content}
    </svg>
  `);

async function buildPortrait() {
  const width = 1080;
  const height = 1920;
  const background = path.join(assetDir, "free-saju-vertical-bg.png");
  const outputPng = path.join(assetDir, "free-saju-ad-vertical-1080x1920.png");
  const outputJpg = path.join(assetDir, "free-saju-ad-vertical-1080x1920.jpg");
  const logo = await sharp(logoPath).resize(68, 68).png().toBuffer();

  const overlay = svg(width, height, `
    <defs>
      <linearGradient id="topVeil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#09060f" stop-opacity="0.58"/>
        <stop offset="0.32" stop-color="#09060f" stop-opacity="0.22"/>
        <stop offset="0.56" stop-color="#09060f" stop-opacity="0"/>
        <stop offset="1" stop-color="#09060f" stop-opacity="0.44"/>
      </linearGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff3d7f"/>
        <stop offset="1" stop-color="#8b5cf6"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.68"/>
      </filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#topVeil)"/>

    <rect x="70" y="78" width="250" height="72" rx="36" fill="#ff3d7f"/>
    <text class="kr" x="195" y="126" fill="#fff" font-size="31" font-weight="900" text-anchor="middle">무료 속궁합 사주</text>

    <text class="kr" x="70" y="272" fill="#fffaf7" font-size="79" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="70" dy="0">그 사람과 나는</tspan>
      <tspan x="70" dy="102" fill="#ff4b88">왜 자꾸 어긋날까?</tspan>
    </text>

    <text class="kr" x="72" y="468" fill="#f5eaf0" font-size="36" font-weight="650" letter-spacing="-1">
      <tspan x="72" dy="0">두 사람의 온도를 사주로 읽어보세요</tspan>
      <tspan x="72" dy="62" fill="#ff6d9d" font-size="42" font-weight="900">무료 10문장 먼저 공개</tspan>
    </text>

    <rect x="70" y="1632" width="940" height="124" rx="62" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="540" y="1710" fill="#fff" font-size="43" font-weight="900" text-anchor="middle">무료로 확인하기  →</text>

    <text class="kr" x="158" y="1830" fill="#fff" font-size="31" font-weight="900">LOVE<tspan fill="#ff6d9d">RABBIT</tspan></text>
    <text class="kr" x="158" y="1869" fill="#b9acbf" font-size="24" font-weight="550">loverebbit.xyz · 오락 목적의 콘텐츠입니다.</text>
  `);

  const composed = await sharp(background)
    .resize(width, height, { fit: "cover", position: "center" })
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: logo, top: 1782, left: 70 },
    ])
    .png()
    .toBuffer();

  await sharp(composed).toFile(outputPng);
  await sharp(composed).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(outputJpg);
}

async function buildLandscape() {
  const width = 1200;
  const height = 628;
  const background = path.join(assetDir, "free-saju-horizontal-bg.png");
  const outputPng = path.join(assetDir, "free-saju-ad-horizontal-1200x628.png");
  const outputJpg = path.join(assetDir, "free-saju-ad-horizontal-1200x628.jpg");
  const logo = await sharp(logoPath).resize(46, 46).png().toBuffer();

  const overlay = svg(width, height, `
    <defs>
      <linearGradient id="sideVeil" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#09060f" stop-opacity="0.62"/>
        <stop offset="0.48" stop-color="#09060f" stop-opacity="0.12"/>
        <stop offset="0.74" stop-color="#09060f" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff3d7f"/>
        <stop offset="1" stop-color="#8b5cf6"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.72"/>
      </filter>
    </defs>
    <rect width="1200" height="628" fill="url(#sideVeil)"/>

    <rect x="58" y="42" width="212" height="52" rx="26" fill="#ff3d7f"/>
    <text class="kr" x="164" y="77" fill="#fff" font-size="23" font-weight="900" text-anchor="middle">무료 속궁합 사주</text>

    <text class="kr" x="58" y="174" fill="#fffaf7" font-size="55" font-weight="900" letter-spacing="-3" filter="url(#shadow)">
      <tspan x="58" dy="0">그 사람과 나는</tspan>
      <tspan x="58" dy="70" fill="#ff4b88">왜 자꾸 어긋날까?</tspan>
    </text>

    <text class="kr" x="60" y="306" fill="#f5eaf0" font-size="25" font-weight="650">
      <tspan x="60" dy="0">두 사람의 온도를 사주로 읽어보세요</tspan>
      <tspan x="60" dy="42" fill="#ff6d9d" font-size="29" font-weight="900">무료 10문장 먼저 공개</tspan>
    </text>

    <rect x="58" y="388" width="356" height="78" rx="39" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="236" y="438" fill="#fff" font-size="29" font-weight="900" text-anchor="middle">무료로 확인하기  →</text>

    <text class="kr" x="118" y="546" fill="#fff" font-size="24" font-weight="900">LOVE<tspan fill="#ff6d9d">RABBIT</tspan></text>
    <text class="kr" x="118" y="577" fill="#b9acbf" font-size="17" font-weight="550">loverebbit.xyz · 오락 목적의 콘텐츠입니다.</text>
  `);

  const composed = await sharp(background)
    .resize(width, height, { fit: "cover", position: "center" })
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: logo, top: 511, left: 58 },
    ])
    .png()
    .toBuffer();

  await sharp(composed).toFile(outputPng);
  await sharp(composed).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(outputJpg);
}

await Promise.all([buildPortrait(), buildLandscape()]);

console.log("Created marketing/ads/free-saju-imagegen-v5/free-saju-ad-vertical-1080x1920.{png,jpg}");
console.log("Created marketing/ads/free-saju-imagegen-v5/free-saju-ad-horizontal-1200x628.{png,jpg}");
