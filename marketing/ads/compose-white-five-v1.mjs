import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// 화이트형 광고 5종.
//
// 기존 소재는 전부 어둡다. 밤 신당 그림 위에 어두운 베일을 덮으니 피드에서
// 다른 어두운 게시물에 묻힌다. 그래서 반대로 간다 - 위쪽 절반을 흰 여백으로
// 비우고, 그림은 아래로 내려 꽉 채운다. 그림을 밝히는 게 아니라 그림을 줄인다.
// 원본을 밝히면 색이 죽고 인물이 뿌옇게 뜬다.
//
//   node marketing/ads/compose-white-five-v1.mjs
//
// 잘라내기는 attention 을 쓴다. 941x1672 세로 그림에서 가로 띠를 뜨면 중앙
// 고정으로는 얼굴이 잘린다. attention 은 정보가 몰린 쪽(대개 얼굴)을 남긴다.

const root = process.cwd();
const bgDir = path.join(root, "public", "ads", "saju");
const outDir = path.join(root, "marketing", "ads", "white-five-v1");
const logoPath = path.join(root, "public", "logo.png");

const campaigns = [
  {
    id: "01",
    slug: "compatibility",
    title: "궁합 사주",
    background: "compatibility-bg.png",
    badge: "궁합 사주",
    headline: ["우리 둘,", "잘 맞을까?"],
    sub: "두 사람의 성향과 관계 온도를 사주 흐름으로 함께 봅니다.",
    cta: "무료 궁합 보기  →",
    accent: "#ff4d84",
    tint: "#fff3f7",
    ground: "#fffdfc",
  },
  {
    id: "02",
    slug: "intimate",
    title: "속궁합 사주",
    background: "intimate-compatibility-bg.png",
    badge: "속궁합 사주",
    headline: ["말보다 먼저", "맞는 온도"],
    sub: "가까워질수록 드러나는 끌림과 두 사람만의 상성을 읽습니다.",
    cta: "속궁합 보기  →",
    accent: "#e5486d",
    tint: "#fff2f4",
    ground: "#fffdfc",
  },
  {
    id: "03",
    slug: "mature",
    title: "19금 사주",
    background: "mature-compatibility-bg.png",
    badge: "19금 사주",
    headline: ["밤이 되면", "달라지는 궁합"],
    sub: "두 사람의 끌림과 관계의 완급을 성인 대상 해석으로 살펴봅니다.",
    cta: "19금 사주 보기  →",
    accent: "#c9385f",
    tint: "#fff1f3",
    ground: "#fffdfc",
    adult: true,
  },
  {
    id: "04",
    slug: "romance-timing",
    title: "연애운 사주",
    background: "romance-timing-bg.png",
    badge: "연애운 사주",
    headline: ["이번 사랑,", "언제 시작될까?"],
    sub: "인연의 창이 열리는 시기와 만남의 경로를 확인합니다.",
    cta: "연애운 보기  →",
    accent: "#ef7c3c",
    tint: "#fff6ed",
    ground: "#fffdfa",
  },
  {
    id: "05",
    slug: "breakup",
    title: "이별 사주",
    background: "breakup-decision-bg.png",
    badge: "이별 사주",
    headline: ["끝낼까,", "붙잡을까?"],
    sub: "반복되는 갈등의 원인과 다음 선택의 기준을 정리합니다.",
    cta: "이별 흐름 보기  →",
    accent: "#7b6bd6",
    tint: "#f4f2fe",
    ground: "#fdfdff",
  },
];

const INK = "#1b1520";
const MUTE = "#6f6678";

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

// 흰 바탕 위의 글자는 그림자를 안 쓴다. 흰 배경에 그림자를 얹으면 때가 탄 것처럼 보인다.
function whiteZone(c, { width, imageTop, pad, badgeY, headY, headSize, headLine, subGap, ctaY, ctaW, ctaH }) {
  const badgeW = c.badge.length * (headSize * 0.42) + 68;
  const headBottom = headY + headLine * (c.headline.length - 1);
  // 장식 원은 흰 영역 안에서만 산다. 안 자르면 아래 그림 위로 흰 덩어리가 얹힌다.
  return `
    <defs>
      <clipPath id="whiteZone"><rect x="0" y="0" width="${width}" height="${imageTop}"/></clipPath>
    </defs>
    <rect width="${width}" height="${imageTop}" fill="${c.ground}"/>
    <g clip-path="url(#whiteZone)">
      <circle cx="${width - 40}" cy="${badgeY - 90}" r="290" fill="${c.tint}"/>
      <circle cx="${width - 210}" cy="${imageTop - 40}" r="150" fill="${c.tint}"/>
    </g>

    <rect x="${pad}" y="${badgeY}" width="${badgeW}" height="${headSize * 0.86}" rx="${headSize * 0.43}" fill="${c.accent}"/>
    <text class="kr" x="${pad + badgeW / 2}" y="${badgeY + headSize * 0.6}" fill="#fff"
          font-size="${headSize * 0.4}" font-weight="900" text-anchor="middle">${xml(c.badge)}</text>

    <text class="kr" x="${pad}" y="${headY}" font-size="${headSize}" font-weight="900" letter-spacing="-3">
      ${c.headline.map((line, i) =>
        `<tspan x="${pad}" dy="${i === 0 ? 0 : headLine}" fill="${i === c.headline.length - 1 ? c.accent : INK}">${xml(line)}</tspan>`
      ).join("")}
    </text>

    <text class="kr" x="${pad}" y="${headBottom + subGap}" fill="${MUTE}"
          font-size="${headSize * 0.44}" font-weight="600">${xml(c.sub)}</text>

    <rect x="${pad}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="${ctaH / 2}" fill="${c.accent}"/>
    <text class="kr" x="${pad + ctaW / 2}" y="${ctaY + ctaH * 0.64}" fill="#fff"
          font-size="${ctaH * 0.33}" font-weight="900" text-anchor="middle">${xml(c.cta)}</text>
  `;
}

// 하단 고지는 그림 위에 올라간다. 그림이 밝을 수도 있어서 어두운 페이드를 깐다.
function footer(c, { width, height, barTop, logoY }) {
  return `
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0d0a12" stop-opacity="0"/>
        <stop offset="1" stop-color="#0d0a12" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${barTop}" width="${width}" height="${height - barTop}" fill="url(#fade)"/>
    <text class="kr" x="${logoY.textX}" y="${logoY.baseline}" fill="#fff" font-size="24" font-weight="900">LOVE<tspan fill="#ffb3cd">RABBIT</tspan></text>
    <text class="kr" x="${logoY.noteX}" y="${logoY.baseline}" fill="#cfc6d6" font-size="18" font-weight="550">${
      c.adult ? "만 19세 이상 · 오락 목적의 콘텐츠입니다." : "오락 목적의 콘텐츠입니다."
    }</text>
  `;
}

async function build(c, spec) {
  const { width, height, imageTop } = spec;
  const art = await sharp(path.join(bgDir, c.background))
    .resize(width, height - imageTop, { fit: "cover", position: sharp.strategy.attention })
    .png()
    .toBuffer();

  const logo = await sharp(logoPath).resize(42, 42).png().toBuffer();

  const overlay = svg(width, height, `
    ${whiteZone(c, spec)}
    ${footer(c, spec)}
  `);

  return sharp({ create: { width, height, channels: 4, background: c.ground } })
    .composite([
      { input: art, top: imageTop, left: 0 },
      { input: overlay, top: 0, left: 0 },
      { input: logo, top: spec.logoY.logoTop, left: spec.pad },
    ])
    .png()
    .toBuffer();
}

const FEED = {
  width: 1080, height: 1350, imageTop: 700, pad: 72,
  badgeY: 92, headY: 300, headSize: 74, headLine: 96, subGap: 64,
  ctaY: 540, ctaW: 700, ctaH: 108,
  barTop: 1210,
  logoY: { logoTop: 1284, textX: 128, noteX: 356, baseline: 1312 },
};

const STORY = {
  width: 1080, height: 1920, imageTop: 940, pad: 72,
  badgeY: 150, headY: 420, headSize: 80, headLine: 104, subGap: 76,
  ctaY: 700, ctaW: 740, ctaH: 116,
  barTop: 1770,
  logoY: { logoTop: 1848, textX: 128, noteX: 356, baseline: 1876 },
};

await mkdir(outDir, { recursive: true });

for (const c of campaigns) {
  const base = `${c.id}-${c.slug}`;
  const feed = await build(c, FEED);
  const story = await build(c, STORY);
  await Promise.all([
    sharp(feed).toFile(path.join(outDir, `${base}-feed-1080x1350.png`)),
    sharp(feed).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(outDir, `${base}-feed-1080x1350.jpg`)),
    sharp(story).toFile(path.join(outDir, `${base}-story-1080x1920.png`)),
    sharp(story).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(outDir, `${base}-story-1080x1920.jpg`)),
  ]);
}

// 대지
const cardW = 300, cardH = 375, gap = 24, headerH = 140;
const sheetW = 60 * 2 + cardW * 5 + gap * 4;
const sheetH = headerH + cardH + 96;
const sheetLabels = campaigns.map((c, i) => {
  const x = 60 + i * (cardW + gap);
  return `
    <text class="kr" x="${x}" y="${headerH - 16}" fill="#fff" font-size="22" font-weight="900">${c.id}. ${xml(c.title)}</text>
    <text class="kr" x="${x}" y="${headerH + cardH + 40}" fill="#b9acc5" font-size="18">${xml(c.headline.join(" "))}</text>
  `;
}).join("");

const sheetBase = svg(sheetW, sheetH, `
  <rect width="${sheetW}" height="${sheetH}" fill="#0d0a14"/>
  <text class="kr" x="60" y="62" fill="#fff" font-size="38" font-weight="900">LOVERABBIT 화이트형 5종</text>
  <text class="kr" x="62" y="104" fill="#ff6d9d" font-size="22" font-weight="800">위는 비우고 그림은 내린다 · 피드 1080×1350 · 스토리 1080×1920</text>
  ${sheetLabels}
`);

const sheetComposites = [{ input: sheetBase, top: 0, left: 0 }];
for (let i = 0; i < campaigns.length; i += 1) {
  const c = campaigns[i];
  const card = await sharp(path.join(outDir, `${c.id}-${c.slug}-feed-1080x1350.png`))
    .resize(cardW, cardH, { fit: "cover" }).png().toBuffer();
  sheetComposites.push({ input: card, top: headerH, left: 60 + i * (cardW + gap) });
}

const sheet = await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: "#0d0a14" } })
  .composite(sheetComposites).png().toBuffer();

await Promise.all([
  sharp(sheet).toFile(path.join(outDir, "white-five-preview.png")),
  sharp(sheet).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(path.join(outDir, "white-five-preview.jpg")),
]);

console.log("Created 5 white-theme campaigns x 2 aspect ratios + contact sheet in marketing/ads/white-five-v1");
