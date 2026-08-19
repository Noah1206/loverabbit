import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assetDir = path.join(root, "marketing", "ads", "hook-five-v1");
const logoPath = path.join(root, "public", "logo.png");

const campaigns = [
  {
    id: "01",
    slug: "general-compatibility",
    title: "궁합 사주",
    badge: "궁합 사주",
    headline: ["우리 둘,", "잘 맞을까?"],
    cta: "무료 궁합 보기  →",
    accent: "#ff3d7f",
    accent2: "#8b5cf6",
    highlight: "#ff8ab2",
    veil: "#0d0712",
  },
  {
    id: "02",
    slug: "intimate-compatibility",
    title: "속궁합 사주",
    badge: "속궁합 사주",
    headline: ["말보다 먼저", "맞는 온도"],
    cta: "속궁합 보기  →",
    accent: "#ff315f",
    accent2: "#8b2f6f",
    highlight: "#ff758f",
    veil: "#120307",
  },
  {
    id: "03",
    slug: "mature-night",
    title: "19금 사주",
    badge: "19금 사주",
    headline: ["밤이 되면", "달라지는 궁합"],
    cta: "19금 사주 보기  →",
    accent: "#d92758",
    accent2: "#6f214f",
    highlight: "#ff5c72",
    veil: "#100205",
  },
  {
    id: "04",
    slug: "romance-fortune",
    title: "연애운 사주",
    badge: "연애운 사주",
    headline: ["이번 사랑,", "언제 시작될까?"],
    cta: "연애운 보기  →",
    accent: "#d94d77",
    accent2: "#8b5cf6",
    highlight: "#f2b066",
    veil: "#080b18",
  },
  {
    id: "05",
    slug: "breakup",
    title: "이별 사주",
    badge: "이별 사주",
    headline: ["끝낼까,", "붙잡을까?"],
    cta: "이별 흐름 보기  →",
    accent: "#ff3d7f",
    accent2: "#7355dd",
    highlight: "#ff7da8",
    veil: "#080712",
  },
];

const xml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const svg = (width, height, content) => Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>.kr { font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif; }</style>
    ${content}
  </svg>
`);

function commonDefs(c) {
  return `
    <defs>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${c.accent}"/>
        <stop offset="1" stop-color="${c.accent2}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="8" stdDeviation="11" flood-color="#000" flood-opacity="0.78"/>
      </filter>
    </defs>
  `;
}

function portraitOverlay(c) {
  return svg(1080, 1920, `
    ${commonDefs(c)}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.veil}" stop-opacity="0.80"/>
        <stop offset="0.42" stop-color="${c.veil}" stop-opacity="0.14"/>
        <stop offset="0.76" stop-color="${c.veil}" stop-opacity="0"/>
        <stop offset="1" stop-color="#07040b" stop-opacity="0.78"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#veil)"/>

    <rect x="70" y="78" width="224" height="64" rx="32" fill="${c.accent}"/>
    <text class="kr" x="182" y="121" fill="#fff" font-size="28" font-weight="900" text-anchor="middle">${xml(c.badge)}</text>

    <text class="kr" x="70" y="266" fill="#fffaf7" font-size="80" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="70" dy="0">${xml(c.headline[0])}</tspan>
      <tspan x="70" dy="98" fill="${c.highlight}">${xml(c.headline[1])}</tspan>
    </text>

    <rect x="70" y="1638" width="650" height="112" rx="56" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="395" y="1710" fill="#fff" font-size="37" font-weight="900" text-anchor="middle">${xml(c.cta)}</text>

    <text class="kr" x="128" y="1878" fill="#fff" font-size="25" font-weight="900">LOVE<tspan fill="${c.highlight}">RABBIT</tspan></text>
    <text class="kr" x="360" y="1878" fill="#c5b9ca" font-size="19" font-weight="550">오락 목적의 콘텐츠입니다.</text>
  `);
}

function landscapeOverlay(c) {
  return svg(1200, 628, `
    ${commonDefs(c)}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${c.veil}" stop-opacity="0.88"/>
        <stop offset="0.50" stop-color="${c.veil}" stop-opacity="0.24"/>
        <stop offset="0.72" stop-color="${c.veil}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="628" fill="url(#veil)"/>

    <rect x="58" y="40" width="170" height="48" rx="24" fill="${c.accent}"/>
    <text class="kr" x="143" y="73" fill="#fff" font-size="21" font-weight="900" text-anchor="middle">${xml(c.badge)}</text>

    <text class="kr" x="58" y="169" fill="#fffaf7" font-size="54" font-weight="900" letter-spacing="-3" filter="url(#shadow)">
      <tspan x="58" dy="0">${xml(c.headline[0])}</tspan>
      <tspan x="58" dy="68" fill="${c.highlight}">${xml(c.headline[1])}</tspan>
    </text>

    <rect x="58" y="350" width="350" height="74" rx="37" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="233" y="398" fill="#fff" font-size="26" font-weight="900" text-anchor="middle">${xml(c.cta)}</text>

    <text class="kr" x="112" y="548" fill="#fff" font-size="22" font-weight="900">LOVE<tspan fill="${c.highlight}">RABBIT</tspan></text>
    <text class="kr" x="112" y="579" fill="#c5b9ca" font-size="16" font-weight="550">오락 목적의 콘텐츠입니다.</text>
  `);
}

async function exportCampaign(c) {
  const logoPortrait = await sharp(logoPath).resize(46, 46).png().toBuffer();
  const logoLandscape = await sharp(logoPath).resize(42, 42).png().toBuffer();

  const portrait = await sharp(path.join(assetDir, `${c.id}-${c.slug}-vertical-bg.png`))
    .resize(1080, 1920, { fit: "cover", position: "center" })
    .composite([
      { input: portraitOverlay(c), top: 0, left: 0 },
      { input: logoPortrait, top: 1842, left: 70 },
    ])
    .png()
    .toBuffer();

  const landscape = await sharp(path.join(assetDir, `${c.id}-${c.slug}-horizontal-bg.png`))
    .resize(1200, 628, { fit: "cover", position: "center" })
    .composite([
      { input: landscapeOverlay(c), top: 0, left: 0 },
      { input: logoLandscape, top: 510, left: 58 },
    ])
    .png()
    .toBuffer();

  await Promise.all([
    sharp(portrait).toFile(path.join(assetDir, `${c.id}-${c.slug}-ad-vertical-1080x1920.png`)),
    sharp(portrait).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(assetDir, `${c.id}-${c.slug}-ad-vertical-1080x1920.jpg`)),
    sharp(landscape).toFile(path.join(assetDir, `${c.id}-${c.slug}-ad-horizontal-1200x628.png`)),
    sharp(landscape).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(assetDir, `${c.id}-${c.slug}-ad-horizontal-1200x628.jpg`)),
  ]);
}

async function buildContactSheet() {
  const width = 1800;
  const headerHeight = 170;
  const rowHeight = 500;
  const height = headerHeight + rowHeight * campaigns.length + 40;
  const labels = campaigns.map((c, index) => {
    const y = headerHeight + index * rowHeight;
    return `
      <rect x="34" y="${y + 18}" width="1732" height="464" rx="28" fill="${index % 2 ? "#17121f" : "#130f1a"}" stroke="#30263b" stroke-width="2"/>
      <rect x="60" y="${y + 42}" width="70" height="38" rx="19" fill="${c.accent}"/>
      <text class="kr" x="95" y="${y + 69}" fill="#fff" font-size="20" font-weight="900" text-anchor="middle">${c.id}</text>
      <text class="kr" x="150" y="${y + 70}" fill="#fff" font-size="28" font-weight="900">${xml(c.title)}</text>
      <text class="kr" x="1100" y="${y + 150}" fill="${c.highlight}" font-size="24" font-weight="900">후킹 문구</text>
      <text class="kr" x="1100" y="${y + 194}" fill="#f4edf8" font-size="28" font-weight="850">${xml(c.headline.join(" "))}</text>
      <text class="kr" x="1100" y="${y + 260}" fill="#b9acc5" font-size="20">세로 1080×1920 · 가로 1200×628</text>
      <text class="kr" x="1100" y="${y + 300}" fill="#e8b84b" font-size="20" font-weight="850">PNG + JPG 제공</text>
    `;
  }).join("");

  const base = svg(width, height, `
    <rect width="${width}" height="${height}" fill="#0d0a14"/>
    <text class="kr" x="58" y="70" fill="#fff" font-size="44" font-weight="900">LOVERABBIT 후킹 광고 5종</text>
    <text class="kr" x="60" y="120" fill="#ff6d9d" font-size="25" font-weight="800">5개 주제 · 10개 고유 이미지 · PNG/JPG 20개 최종 파일</text>
    ${labels}
  `);

  const composites = [{ input: base, top: 0, left: 0 }];
  for (let index = 0; index < campaigns.length; index += 1) {
    const c = campaigns[index];
    const y = headerHeight + index * rowHeight;
    const portrait = await sharp(path.join(assetDir, `${c.id}-${c.slug}-ad-vertical-1080x1920.png`))
      .resize(207, 368, { fit: "cover" }).png().toBuffer();
    const landscape = await sharp(path.join(assetDir, `${c.id}-${c.slug}-ad-horizontal-1200x628.png`))
      .resize(720, 377, { fit: "cover" }).png().toBuffer();
    composites.push({ input: portrait, top: y + 92, left: 60 });
    composites.push({ input: landscape, top: y + 88, left: 310 });
  }

  const sheet = await sharp({
    create: { width, height, channels: 4, background: "#0d0a14" },
  }).composite(composites).png().toBuffer();

  await Promise.all([
    sharp(sheet).toFile(path.join(assetDir, "hook-five-preview.png")),
    sharp(sheet).jpeg({ quality: 91, chromaSubsampling: "4:4:4" }).toFile(path.join(assetDir, "hook-five-preview.jpg")),
  ]);
}

await Promise.all(campaigns.map(exportCampaign));
await buildContactSheet();

console.log("Created 5 campaigns × 2 aspect ratios, PNG/JPG exports, and contact sheet in marketing/ads/hook-five-v1");
