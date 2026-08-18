import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "marketing", "ads", "source");
const outputDir = path.join(root, "marketing", "ads");
const publicDir = path.join(root, "public", "ads");
const logoPath = path.join(root, "public", "logo.png");

await mkdir(publicDir, { recursive: true });

const svg = (width, height, content) =>
  Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>.kr { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; }</style>
      ${content}
    </svg>
  `);

async function makePortrait() {
  const width = 1080;
  const height = 1920;
  const background = path.join(sourceDir, "character-chat-portrait-bg.png");
  const output = path.join(outputDir, "character-chat-ad-9x16.jpg");
  const publicOutput = path.join(publicDir, "character-chat-ad-9x16.jpg");
  const logo = await sharp(logoPath).resize(86, 86).png().toBuffer();

  const overlay = svg(width, height, `
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#070103" stop-opacity="0.50"/>
        <stop offset="0.32" stop-color="#070103" stop-opacity="0.08"/>
        <stop offset="0.72" stop-color="#070103" stop-opacity="0.02"/>
        <stop offset="1" stop-color="#070103" stop-opacity="0.86"/>
      </linearGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff304f"/>
        <stop offset="1" stop-color="#a50a25"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.78"/>
      </filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#veil)"/>
    <rect x="70" y="84" width="288" height="56" rx="28" fill="#ff304f"/>
    <text class="kr" x="214" y="122" fill="#fff" font-size="27" font-weight="900" text-anchor="middle">무료 캐릭터챗 5번</text>
    <text class="kr" x="70" y="254" fill="#fff8f3" font-size="82" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="70" dy="0">그 사람 때문에</tspan>
      <tspan x="70" dy="102" fill="#ff5b73">또 잠 못 들었지?</tspan>
    </text>
    <rect x="70" y="452" width="880" height="138" rx="30" fill="#12070a" fill-opacity="0.72" stroke="#ff8a9b" stroke-opacity="0.55"/>
    <text class="kr" x="108" y="508" fill="#ffd5dc" font-size="31" font-weight="700">
      <tspan x="108" dy="0">화린도령  “이름은 말하지 마.</tspan>
      <tspan x="108" dy="46" fill="#fff">네 눈부터 볼 테니.”</tspan>
    </text>
    <rect x="70" y="1668" width="940" height="126" rx="63" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="540" y="1747" fill="#fff" font-size="41" font-weight="900" text-anchor="middle">화린도령과 무료로 대화하기  →</text>
    <text class="kr" x="168" y="1848" fill="#fff" font-size="30" font-weight="900">LOVERABBIT</text>
    <text class="kr" x="392" y="1848" fill="#d8b9bd" font-size="23" font-weight="600">무료 5회 · 이후 로그인 및 결제 · 오락 목적</text>
  `);

  await sharp(background)
    .resize(width, height, { fit: "cover" })
    .composite([{ input: overlay }, { input: logo, top: 1804, left: 70 }])
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
    .toFile(output);
  await copyFile(output, publicOutput);
}

async function makeLandscape() {
  const width = 1920;
  const height = 1080;
  const background = path.join(sourceDir, "character-chat-landscape-bg.png");
  const output = path.join(outputDir, "character-chat-ad-16x9.jpg");
  const publicOutput = path.join(publicDir, "character-chat-ad-16x9.jpg");
  const logo = await sharp(logoPath).resize(76, 76).png().toBuffer();

  const overlay = svg(width, height, `
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#050102" stop-opacity="0.60"/>
        <stop offset="0.52" stop-color="#070103" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#070103" stop-opacity="0.04"/>
      </linearGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff304f"/>
        <stop offset="1" stop-color="#a50a25"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.78"/>
      </filter>
    </defs>
    <rect width="1920" height="1080" fill="url(#veil)"/>
    <rect x="96" y="82" width="292" height="56" rx="28" fill="#ff304f"/>
    <text class="kr" x="242" y="120" fill="#fff" font-size="27" font-weight="900" text-anchor="middle">화린신당 무료 입장</text>
    <text class="kr" x="96" y="264" fill="#fff8f3" font-size="84" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="96" dy="0">그 사람 때문에</tspan>
      <tspan x="96" dy="104" fill="#ff5b73">또 잠 못 들었지?</tspan>
    </text>
    <rect x="96" y="442" width="772" height="126" rx="28" fill="#12070a" fill-opacity="0.70" stroke="#ff8a9b" stroke-opacity="0.50"/>
    <text class="kr" x="130" y="493" fill="#ffd5dc" font-size="30" font-weight="700">
      <tspan x="130" dy="0">“이름은 말하지 마.</tspan>
      <tspan x="130" dy="44" fill="#fff">네 눈부터 볼 테니.” — 화린도령</tspan>
    </text>
    <text class="kr" x="100" y="638" fill="#f3d9dd" font-size="31" font-weight="700">실제 캐릭터챗 5회 무료 · 이후 로그인/결제</text>
    <rect x="96" y="694" width="570" height="106" rx="53" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="381" y="762" fill="#fff" font-size="38" font-weight="900" text-anchor="middle">지금 대화 시작  →</text>
    <text class="kr" x="182" y="962" fill="#fff" font-size="30" font-weight="900">LOVERABBIT</text>
    <text class="kr" x="406" y="962" fill="#d8b9bd" font-size="24" font-weight="600">캐릭터챗 · 오락 목적</text>
  `);

  await sharp(background)
    .resize(width, height, { fit: "cover" })
    .composite([{ input: overlay }, { input: logo, top: 920, left: 96 }])
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
    .toFile(output);
  await copyFile(output, publicOutput);
}

await Promise.all([makePortrait(), makeLandscape()]);

console.log("Created marketing/ads/character-chat-ad-9x16.jpg");
console.log("Created marketing/ads/character-chat-ad-16x9.jpg");
