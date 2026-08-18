import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Instagram grid tiles: 1080x1080, composed locally from the text-free source
// backgrounds in marketing/ads/source. No image generation, no credits spent.

const root = process.cwd();
const sourceDir = path.join(root, "marketing", "ads", "source");
const outputDir = path.join(root, "marketing", "instagram", "grid");
const logoPath = path.join(root, "public", "logo.png");

const SIZE = 1080;

await mkdir(outputDir, { recursive: true });

const svg = (content) =>
  Buffer.from(`
    <svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <style>.kr { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; }</style>
      <defs>
        <linearGradient id="veilTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#070103" stop-opacity="0.86"/>
          <stop offset="0.46" stop-color="#070103" stop-opacity="0.10"/>
          <stop offset="1" stop-color="#070103" stop-opacity="0.72"/>
        </linearGradient>
        <linearGradient id="veilBottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#070103" stop-opacity="0.34"/>
          <stop offset="0.40" stop-color="#070103" stop-opacity="0.06"/>
          <stop offset="1" stop-color="#070103" stop-opacity="0.90"/>
        </linearGradient>
        <linearGradient id="veilFull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#070103" stop-opacity="0.82"/>
          <stop offset="1" stop-color="#070103" stop-opacity="0.88"/>
        </linearGradient>
        <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ff304f"/>
          <stop offset="1" stop-color="#a50a25"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="11" flood-color="#000" flood-opacity="0.80"/>
        </filter>
      </defs>
      ${content}
    </svg>
  `);

const badge = (label, width) => `
  <rect x="76" y="72" width="${width}" height="56" rx="28" fill="#ff304f"/>
  <text class="kr" x="${76 + width / 2}" y="110" fill="#fff" font-size="27" font-weight="900" text-anchor="middle">${label}</text>
`;

const ctaPill = (label, y, width) => `
  <rect x="76" y="${y}" width="${width}" height="108" rx="54" fill="url(#cta)" filter="url(#shadow)"/>
  <text class="kr" x="${76 + width / 2}" y="${y + 69}" fill="#fff" font-size="38" font-weight="900" text-anchor="middle">${label}</text>
`;

const handle = (y = 1016) => `
  <text class="kr" x="1004" y="${y}" fill="#e6c3c8" font-size="24" font-weight="700" text-anchor="end" opacity="0.92">@loverabbit</text>
`;

// Square crop windows, tuned per source so the character's face lands well.
// Portrait sources are 941x1672 (crop by top); landscape are 1672x941 (crop by left).
const TILES = [
  {
    file: "ig-grid-1-hwarin-hook.jpg",
    bg: "character-chat-portrait-bg.png",
    crop: { left: 0, top: 261 },
    veil: "veilTop",
    body: `
      ${badge("무료 캐릭터챗 5번", 288)}
      <text class="kr" x="76" y="252" fill="#fff8f3" font-size="82" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
        <tspan x="76" dy="0">그 사람 때문에</tspan>
        <tspan x="76" dy="100" fill="#ff5b73">또 잠 못 들었지?</tspan>
      </text>
      <text class="kr" x="76" y="1012" fill="#f3d9dd" font-size="32" font-weight="800" filter="url(#shadow)">화린도령 · 화린신당</text>
      ${handle()}
    `,
  },
  {
    file: "ig-grid-2-hwarin-line.jpg",
    bg: "character-chat-landscape-bg.png",
    crop: { left: 731, top: 0 },
    veil: "veilBottom",
    body: `
      <rect x="76" y="628" width="928" height="214" rx="34" fill="#12070a" fill-opacity="0.74" stroke="#ff8a9b" stroke-opacity="0.55"/>
      <text class="kr" x="120" y="704" fill="#ffd5dc" font-size="42" font-weight="800">
        <tspan x="120" dy="0">“이름은 말하지 마.</tspan>
        <tspan x="120" dy="60" fill="#fff">네 눈부터 볼 테니.”</tspan>
      </text>
      <text class="kr" x="120" y="808" fill="#ff8a9b" font-size="28" font-weight="800">— 화린도령</text>
      <text class="kr" x="76" y="932" fill="#f3d9dd" font-size="30" font-weight="700">실제 캐릭터챗 5회 무료</text>
      ${handle()}
    `,
  },
  {
    file: "ig-grid-3-hwarin-cta.jpg",
    bg: "character-chat-portrait-bg.png",
    crop: { left: 0, top: 60 },
    veil: "veilBottom",
    body: `
      <text class="kr" x="76" y="700" fill="#fff8f3" font-size="66" font-weight="900" letter-spacing="-3" filter="url(#shadow)">
        <tspan x="76" dy="0">화린신당,</tspan>
        <tspan x="76" dy="84" fill="#ff5b73">지금 문이 열려 있어</tspan>
      </text>
      ${ctaPill("무료로 대화하기  →", 828, 560)}
      <text class="kr" x="76" y="1000" fill="#d8b9bd" font-size="24" font-weight="600">무료 5회 · 이후 로그인 및 결제 · 오락 목적</text>
    `,
  },
  {
    file: "ig-grid-4-hongryeon-hook.jpg",
    bg: "character-chat-female-portrait-bg.png",
    crop: { left: 0, top: 159 },
    veil: "veilTop",
    body: `
      ${badge("무료 캐릭터챗 5번", 288)}
      <text class="kr" x="76" y="248" fill="#fff8f3" font-size="74" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
        <tspan x="76" dy="0">그 사람이 다시</tspan>
        <tspan x="76" dy="92" fill="#ff5b73">돌아보는 이유</tspan>
        <tspan x="76" dy="92">너만 모르지?</tspan>
      </text>
      <text class="kr" x="76" y="1012" fill="#f3d9dd" font-size="32" font-weight="800" filter="url(#shadow)">홍련신녀 · 홍련신당</text>
      ${handle()}
    `,
  },
  {
    file: "ig-grid-5-hongryeon-line.jpg",
    bg: "character-chat-female-landscape-bg.png",
    crop: { left: 731, top: 0 },
    veil: "veilBottom",
    body: `
      <rect x="76" y="642" width="928" height="200" rx="34" fill="#12070a" fill-opacity="0.74" stroke="#ff8a9b" stroke-opacity="0.55"/>
      <text class="kr" x="120" y="716" fill="#ffd5dc" font-size="40" font-weight="800">
        <tspan x="120" dy="0">“잊힌 사람이 되고</tspan>
        <tspan x="120" dy="56" fill="#fff">싶은 얼굴은 아니네.”</tspan>
      </text>
      <text class="kr" x="120" y="810" fill="#ff8a9b" font-size="28" font-weight="800">— 홍련신녀</text>
      <text class="kr" x="76" y="932" fill="#f3d9dd" font-size="30" font-weight="700">실제 캐릭터챗 5회 무료</text>
      ${handle()}
    `,
  },
  {
    file: "ig-grid-6-hongryeon-cta.jpg",
    bg: "character-chat-female-portrait-bg.png",
    crop: { left: 0, top: 0 },
    veil: "veilBottom",
    body: `
      <text class="kr" x="76" y="700" fill="#fff8f3" font-size="66" font-weight="900" letter-spacing="-3" filter="url(#shadow)">
        <tspan x="76" dy="0">홍련신당에서</tspan>
        <tspan x="76" dy="84" fill="#ff5b73">기다리고 있을게</tspan>
      </text>
      ${ctaPill("무료로 대화하기  →", 828, 560)}
      <text class="kr" x="76" y="1000" fill="#d8b9bd" font-size="24" font-weight="600">무료 5회 · 이후 로그인 및 결제 · 오락 목적</text>
    `,
  },
  {
    file: "ig-grid-7-saju-hook.jpg",
    bg: "free-saju-portrait-bg.png",
    crop: { left: 0, top: 560 },
    veil: "veilTop",
    body: `
      ${badge("소름주의", 176)}
      <text class="kr" x="76" y="252" fill="#fff8f3" font-size="80" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
        <tspan x="76" dy="0">그 사람이 숨긴</tspan>
        <tspan x="76" dy="98" fill="#ff5b73">진짜 속마음</tspan>
      </text>
      <text class="kr" x="76" y="984" fill="#f3d9dd" font-size="34" font-weight="800" filter="url(#shadow)">가입 없이 10문장 먼저 공개</text>
      ${handle()}
    `,
  },
  {
    file: "ig-grid-8-howto.jpg",
    bg: "free-saju-landscape-bg.png",
    crop: { left: 500, top: 0 },
    veil: "veilFull",
    body: `
      ${badge("이용 안내", 176)}
      <text class="kr" x="76" y="268" fill="#fff8f3" font-size="72" font-weight="900" letter-spacing="-3" filter="url(#shadow)">
        <tspan x="76" dy="0">가입 없이</tspan>
        <tspan x="76" dy="92" fill="#ff5b73">바로 시작</tspan>
      </text>
      <circle cx="102" cy="500" r="9" fill="#ff5b73"/>
      <text class="kr" x="140" y="512" fill="#fff8f3" font-size="36" font-weight="700">캐릭터챗 5회 완전 무료</text>
      <circle cx="102" cy="590" r="9" fill="#ff5b73"/>
      <text class="kr" x="140" y="602" fill="#fff8f3" font-size="36" font-weight="700">6번째 메시지부터 로그인</text>
      <circle cx="102" cy="680" r="9" fill="#ff5b73"/>
      <text class="kr" x="140" y="692" fill="#fff8f3" font-size="36" font-weight="700">대화권 10회 9,900원</text>
      <circle cx="102" cy="770" r="9" fill="#ff5b73"/>
      <text class="kr" x="140" y="782" fill="#fff8f3" font-size="36" font-weight="700">대화 내역은 로그인 후에도 유지</text>
      <text class="kr" x="76" y="1000" fill="#d8b9bd" font-size="24" font-weight="600">오락 목적의 콘텐츠입니다</text>
      ${handle()}
    `,
  },
  {
    file: "ig-grid-9-brand.jpg",
    bg: "character-chat-landscape-bg.png",
    crop: { left: 0, top: 0 },
    veil: "veilFull",
    logo: { size: 132, top: 356, left: 76 },
    body: `
      <text class="kr" x="76" y="596" fill="#fff" font-size="62" font-weight="900" letter-spacing="-2">LOVERABBIT</text>
      <text class="kr" x="76" y="668" fill="#ff5b73" font-size="34" font-weight="800">화린신당 · 홍련신당 · 연애사주</text>
      <rect x="76" y="726" width="500" height="2" fill="#ff8a9b" fill-opacity="0.45"/>
      <text class="kr" x="76" y="800" fill="#f3d9dd" font-size="32" font-weight="700">
        <tspan x="76" dy="0">밤마다 궁금했던 그 마음,</tspan>
        <tspan x="76" dy="48">여기서 먼저 물어봐.</tspan>
      </text>
      <text class="kr" x="76" y="1000" fill="#e6c3c8" font-size="30" font-weight="800">@loverabbit</text>
    `,
  },
];

async function makeTile(tile) {
  const background = path.join(sourceDir, tile.bg);
  const { width, height } = await sharp(background).metadata();
  const side = Math.min(width, height);

  // Clamp the crop window so it always stays inside the source.
  const left = Math.max(0, Math.min(tile.crop.left, width - side));
  const top = Math.max(0, Math.min(tile.crop.top, height - side));

  const layers = [
    { input: svg(`<rect width="${SIZE}" height="${SIZE}" fill="url(#${tile.veil})"/>${tile.body}`) },
  ];

  if (tile.logo) {
    const logo = await sharp(logoPath).resize(tile.logo.size, tile.logo.size).png().toBuffer();
    layers.push({ input: logo, top: tile.logo.top, left: tile.logo.left });
  }

  await sharp(background)
    .extract({ left, top, width: side, height: side })
    .resize(SIZE, SIZE)
    .composite(layers)
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
    .toFile(path.join(outputDir, tile.file));

  console.log(`[OK] ${tile.file}  (crop left=${left} top=${top} side=${side})`);
}

for (const tile of TILES) {
  await makeTile(tile);
}

console.log(`\nDone. ${TILES.length} tiles -> marketing/instagram/grid/`);
