import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assetDir = path.join(root, "marketing", "ads", "meta-policy-v1");
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

const sharedDefs = `
  <defs>
    <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff3d7f"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.72"/>
    </filter>
  </defs>
`;

async function exportPair(base, outputBase, width, height, overlay, logoPlacement) {
  const background = path.join(assetDir, base);
  const outputPng = path.join(assetDir, `${outputBase}.png`);
  const outputJpg = path.join(assetDir, `${outputBase}.jpg`);
  const logo = await sharp(logoPath)
    .resize(logoPlacement.size, logoPlacement.size)
    .png()
    .toBuffer();

  const composed = await sharp(background)
    .resize(width, height, { fit: "cover", position: "center" })
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: logo, top: logoPlacement.top, left: logoPlacement.left },
    ])
    .png()
    .toBuffer();

  await sharp(composed).toFile(outputPng);
  await sharp(composed).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(outputJpg);
}

function relationshipDecisionPortrait() {
  const width = 1080;
  const height = 1920;
  const overlay = svg(width, height, `
    ${sharedDefs}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#08050e" stop-opacity="0.62"/>
        <stop offset="0.43" stop-color="#08050e" stop-opacity="0.10"/>
        <stop offset="0.78" stop-color="#08050e" stop-opacity="0"/>
        <stop offset="1" stop-color="#08050e" stop-opacity="0.46"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#veil)"/>

    <rect x="70" y="76" width="310" height="68" rx="34" fill="#ff3d7f"/>
    <text class="kr" x="225" y="122" fill="#fff" font-size="29" font-weight="900" text-anchor="middle">관계 결정 리포트</text>

    <text class="kr" x="70" y="260" fill="#fffaf7" font-size="70" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="70" dy="0">붙잡을지 정리할지,</tspan>
      <tspan x="70" dy="88">관계의 기준을</tspan>
      <tspan x="70" dy="88" fill="#ff4b88">정리해 보세요</tspan>
    </text>

    <text class="kr" x="74" y="566" fill="#f4eaf0" font-size="33" font-weight="650" letter-spacing="-1">
      <tspan x="74" dy="0">두 사람의 흐름과 대화 기준을</tspan>
      <tspan x="74" dy="50">개인화 리포트로 정리합니다</tspan>
    </text>
    <text class="kr" x="74" y="687" fill="#ff6d9d" font-size="40" font-weight="900">무료 관계 판정</text>

    <text class="kr" x="540" y="1794" fill="#fff" font-size="39" font-weight="900" text-anchor="middle" filter="url(#shadow)">무료 관계 판정 시작하기  →</text>

    <text class="kr" x="128" y="1890" fill="#fff" font-size="25" font-weight="900">LOVE<tspan fill="#ff6d9d">RABBIT</tspan></text>
    <text class="kr" x="360" y="1890" fill="#b9acbf" font-size="20" font-weight="550">오락 목적의 콘텐츠입니다.</text>
  `);

  return exportPair(
    "relationship-decision-vertical-bg.png",
    "relationship-decision-ad-vertical-1080x1920",
    width,
    height,
    overlay,
    { size: 46, top: 1854, left: 70 },
  );
}

function relationshipDecisionLandscape() {
  const width = 1200;
  const height = 628;
  const overlay = svg(width, height, `
    ${sharedDefs}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#08050e" stop-opacity="0.67"/>
        <stop offset="0.54" stop-color="#08050e" stop-opacity="0.12"/>
        <stop offset="0.76" stop-color="#08050e" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="628" fill="url(#veil)"/>

    <rect x="58" y="40" width="226" height="50" rx="25" fill="#ff3d7f"/>
    <text class="kr" x="171" y="74" fill="#fff" font-size="22" font-weight="900" text-anchor="middle">관계 결정 리포트</text>

    <text class="kr" x="58" y="166" fill="#fffaf7" font-size="48" font-weight="900" letter-spacing="-3" filter="url(#shadow)">
      <tspan x="58" dy="0">붙잡을지 정리할지,</tspan>
      <tspan x="58" dy="62" fill="#ff4b88">관계의 기준을 정리해 보세요</tspan>
    </text>

    <text class="kr" x="60" y="292" fill="#f4eaf0" font-size="24" font-weight="650">
      <tspan x="60" dy="0">두 사람의 흐름과 대화 기준을</tspan>
      <tspan x="60" dy="36">개인화 리포트로 정리합니다</tspan>
    </text>
    <text class="kr" x="60" y="372" fill="#ff6d9d" font-size="28" font-weight="900">무료 관계 판정</text>

    <rect x="58" y="402" width="410" height="78" rx="39" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="263" y="452" fill="#fff" font-size="28" font-weight="900" text-anchor="middle">무료 관계 판정 시작하기  →</text>

    <text class="kr" x="112" y="555" fill="#fff" font-size="23" font-weight="900">LOVE<tspan fill="#ff6d9d">RABBIT</tspan></text>
    <text class="kr" x="112" y="584" fill="#b9acbf" font-size="16" font-weight="550">loverebbit.xyz · 오락 목적의 콘텐츠입니다.</text>
  `);

  return exportPair(
    "relationship-decision-horizontal-bg.png",
    "relationship-decision-ad-horizontal-1200x628",
    width,
    height,
    overlay,
    { size: 42, top: 516, left: 58 },
  );
}

function innerMindPortrait() {
  const width = 1080;
  const height = 1920;
  const overlay = svg(width, height, `
    ${sharedDefs}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#07101f" stop-opacity="0.70"/>
        <stop offset="0.42" stop-color="#07101f" stop-opacity="0.12"/>
        <stop offset="0.70" stop-color="#07101f" stop-opacity="0"/>
        <stop offset="1" stop-color="#060a16" stop-opacity="0.84"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#veil)"/>

    <rect x="70" y="76" width="204" height="68" rx="34" fill="#7fc8f8"/>
    <text class="kr" x="172" y="122" fill="#08101f" font-size="29" font-weight="900" text-anchor="middle">해월신당</text>

    <text class="kr" x="70" y="262" fill="#f8fbff" font-size="73" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="70" dy="0">연락 없는 관계,</tspan>
      <tspan x="70" dy="94" fill="#9ad9ff">궁금한 마음의 흐름</tspan>
    </text>

    <text class="kr" x="74" y="480" fill="#e8f2ff" font-size="32" font-weight="650" letter-spacing="-1">
      <tspan x="74" dy="0">마음·연락의 문턱·관찰할 신호를</tspan>
      <tspan x="74" dy="50">사주 해석 리포트로 정리해 보세요</tspan>
    </text>
    <text class="kr" x="74" y="602" fill="#ff8ab2" font-size="40" font-weight="900">무료 속마음 미리보기</text>

    <rect x="70" y="1640" width="940" height="122" rx="61" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="540" y="1718" fill="#fff" font-size="39" font-weight="900" text-anchor="middle">속마음 미리보기 시작하기  →</text>

    <text class="kr" x="128" y="1878" fill="#fff" font-size="25" font-weight="900">LOVE<tspan fill="#ff6d9d">RABBIT</tspan></text>
    <text class="kr" x="360" y="1878" fill="#b9c8db" font-size="20" font-weight="550">오락 목적의 콘텐츠입니다.</text>
  `);

  return exportPair(
    "inner-mind-vertical-bg.png",
    "inner-mind-ad-vertical-1080x1920",
    width,
    height,
    overlay,
    { size: 46, top: 1842, left: 70 },
  );
}

function innerMindLandscape() {
  const width = 1200;
  const height = 628;
  const overlay = svg(width, height, `
    ${sharedDefs}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#07101f" stop-opacity="0.76"/>
        <stop offset="0.54" stop-color="#07101f" stop-opacity="0.12"/>
        <stop offset="0.76" stop-color="#07101f" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="628" fill="url(#veil)"/>

    <rect x="58" y="40" width="154" height="50" rx="25" fill="#7fc8f8"/>
    <text class="kr" x="135" y="74" fill="#08101f" font-size="22" font-weight="900" text-anchor="middle">해월신당</text>

    <text class="kr" x="58" y="166" fill="#f8fbff" font-size="50" font-weight="900" letter-spacing="-3" filter="url(#shadow)">
      <tspan x="58" dy="0">연락 없는 관계,</tspan>
      <tspan x="58" dy="64" fill="#9ad9ff">궁금한 마음의 흐름</tspan>
    </text>

    <text class="kr" x="60" y="292" fill="#e8f2ff" font-size="23" font-weight="650">
      <tspan x="60" dy="0">마음·연락의 문턱·관찰할 신호를</tspan>
      <tspan x="60" dy="35">사주 해석 리포트로 정리해 보세요</tspan>
    </text>
    <text class="kr" x="60" y="370" fill="#ff8ab2" font-size="28" font-weight="900">무료 속마음 미리보기</text>

    <rect x="58" y="402" width="430" height="78" rx="39" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="273" y="452" fill="#fff" font-size="27" font-weight="900" text-anchor="middle">속마음 미리보기 시작하기  →</text>

    <text class="kr" x="112" y="555" fill="#fff" font-size="23" font-weight="900">LOVE<tspan fill="#ff6d9d">RABBIT</tspan></text>
    <text class="kr" x="112" y="584" fill="#b9c8db" font-size="16" font-weight="550">loverebbit.xyz · 오락 목적의 콘텐츠입니다.</text>
  `);

  return exportPair(
    "inner-mind-horizontal-bg.png",
    "inner-mind-ad-horizontal-1200x628",
    width,
    height,
    overlay,
    { size: 42, top: 516, left: 58 },
  );
}

await Promise.all([
  relationshipDecisionPortrait(),
  relationshipDecisionLandscape(),
  innerMindPortrait(),
  innerMindLandscape(),
]);

console.log("Created Meta policy-friendly relationship-decision and inner-mind ads in marketing/ads/meta-policy-v1");
