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
  const background = path.join(sourceDir, "character-chat-female-portrait-bg.png");
  const output = path.join(outputDir, "character-chat-female-ad-9x16.jpg");
  const publicOutput = path.join(publicDir, "character-chat-female-ad-9x16.jpg");
  const logo = await sharp(logoPath).resize(86, 86).png().toBuffer();

  const overlay = svg(width, height, `
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#060103" stop-opacity="0.54"/>
        <stop offset="0.32" stop-color="#090104" stop-opacity="0.07"/>
        <stop offset="0.76" stop-color="#090104" stop-opacity="0.02"/>
        <stop offset="1" stop-color="#060103" stop-opacity="0.88"/>
      </linearGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff315f"/>
        <stop offset="1" stop-color="#a40a3d"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.80"/>
      </filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#veil)"/>
    <rect x="70" y="84" width="288" height="56" rx="28" fill="#ff315f"/>
    <text class="kr" x="214" y="122" fill="#fff" font-size="27" font-weight="900" text-anchor="middle">무료 캐릭터챗 5번</text>
    <text class="kr" x="70" y="250" fill="#fff8f3" font-size="78" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="70" dy="0">그 사람이 다시</tspan>
      <tspan x="70" dy="98" fill="#ff5b83">돌아보는 이유</tspan>
      <tspan x="70" dy="98" fill="#fff8f3">너만 모르지?</tspan>
    </text>
    <rect x="70" y="590" width="340" height="54" rx="27" fill="#12070b" fill-opacity="0.76" stroke="#ff8aa8" stroke-opacity="0.54"/>
    <text class="kr" x="240" y="627" fill="#ffd5e0" font-size="26" font-weight="900" text-anchor="middle">홍련신녀 · 홍련신당</text>
    <rect x="70" y="1668" width="940" height="126" rx="63" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="540" y="1747" fill="#fff" font-size="41" font-weight="900" text-anchor="middle">홍련신녀와 무료로 대화하기  →</text>
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
  const background = path.join(sourceDir, "character-chat-female-landscape-bg.png");
  const output = path.join(outputDir, "character-chat-female-ad-16x9.jpg");
  const publicOutput = path.join(publicDir, "character-chat-female-ad-16x9.jpg");
  const logo = await sharp(logoPath).resize(76, 76).png().toBuffer();

  const overlay = svg(width, height, `
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#050102" stop-opacity="0.62"/>
        <stop offset="0.53" stop-color="#080103" stop-opacity="0.16"/>
        <stop offset="1" stop-color="#080103" stop-opacity="0.03"/>
      </linearGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff315f"/>
        <stop offset="1" stop-color="#a40a3d"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.80"/>
      </filter>
    </defs>
    <rect width="1920" height="1080" fill="url(#veil)"/>
    <rect x="96" y="82" width="292" height="56" rx="28" fill="#ff315f"/>
    <text class="kr" x="242" y="120" fill="#fff" font-size="27" font-weight="900" text-anchor="middle">홍련신당 무료 입장</text>
    <text class="kr" x="96" y="260" fill="#fff8f3" font-size="80" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="96" dy="0">그 사람이 다시</tspan>
      <tspan x="96" dy="100" fill="#ff5b83">돌아보는 이유</tspan>
      <tspan x="96" dy="100" fill="#fff8f3">너만 모르지?</tspan>
    </text>
    <rect x="96" y="538" width="760" height="114" rx="28" fill="#12070b" fill-opacity="0.72" stroke="#ff8aa8" stroke-opacity="0.50"/>
    <text class="kr" x="130" y="586" fill="#ffd5e0" font-size="29" font-weight="700">
      <tspan x="130" dy="0">“잊힌 사람이 되고 싶은 얼굴은 아니네.”</tspan>
      <tspan x="130" dy="42" fill="#fff">— 홍련신녀</tspan>
    </text>
    <text class="kr" x="100" y="714" fill="#f3d9df" font-size="30" font-weight="700">실제 캐릭터챗 5회 무료 · 이후 로그인/결제</text>
    <rect x="96" y="758" width="570" height="106" rx="53" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="381" y="826" fill="#fff" font-size="38" font-weight="900" text-anchor="middle">지금 대화 시작  →</text>
    <text class="kr" x="182" y="980" fill="#fff" font-size="30" font-weight="900">LOVERABBIT</text>
    <text class="kr" x="406" y="980" fill="#d8b9bd" font-size="24" font-weight="600">캐릭터챗 · 오락 목적</text>
  `);

  await sharp(background)
    .resize(width, height, { fit: "cover" })
    .composite([{ input: overlay }, { input: logo, top: 938, left: 96 }])
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
    .toFile(output);
  await copyFile(output, publicOutput);
}

await Promise.all([makePortrait(), makeLandscape()]);

console.log("Created marketing/ads/character-chat-female-ad-9x16.jpg");
console.log("Created marketing/ads/character-chat-female-ad-16x9.jpg");
