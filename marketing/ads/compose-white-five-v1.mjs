import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// 화이트형 광고 6종.
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

// 헤드라인은 큰 활자 두 줄이라 따옴표를 못 쓴다 - 줄이 갈리면서 따옴표가 벌어져
// 디자인이 깨진다. 대신 조건문(-라면)과 1인칭 질문으로 같은 안전장치를 건다.
// 메타는 광고가 보는 사람의 연애 상태를 안다고 단정하는 것을 금지한다. "당신은
// 늘 여기서 틀어집니다" 는 거부 사유지만, "틀어진다면" 은 조건이라 걸리지 않는다.
//
// sub 는 그 랜딩이 파는 상품의 실제 목차에서 가져온다 (src/lib/products.ts).
// 광고가 약속한 것과 리포트가 주는 것이 다르면 환불로 돌아온다.
const campaigns = [
  {
    id: "01",
    slug: "compatibility",
    title: "궁합 사주",
    background: "compatibility-bg.png",
    badge: "궁합 사주",
    product: "속궁합 사주 (sokgunghap, 9,900)",
    headline: ["잘 맞다가도", "꼭 여기서 틀어진다면"],
    sub: "반드시 부딪히는 지점과 식는 구간을 짚습니다.",
    cta: "부딪히는 지점 보기  →",
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
    product: "속궁합 사주 (sokgunghap, 9,900)",
    // 속궁합은 성적 상성이다. 마음이 맞는지가 아니다. 그 뜻이 안 살면 이 광고는
    // 01(궁합)과 같은 말을 하게 되고, 두 광고가 서로 예산만 갉아먹는다.
    headline: ["겉궁합은 좋은데", "속궁합은 어떨까"],
    sub: "둘의 온도와 호흡, 주도권까지 일주로 읽습니다.",
    cta: "속궁합 지수 보기  →",
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
    product: "속궁합 사주 (sokgunghap, 9,900)",
    // "밤" 을 뺐다. 심의에서 걸리는 것은 그 낱말이 밀착 그림과 겹칠 때다.
    headline: ["가까워질수록", "어긋나는 느낌이라면"],
    sub: "두 사람의 속도와 완급이 어디서 갈리는지 봅니다.",
    cta: "속도 차이 보기  →",
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
    product: "올해의 연애운 (yeonae, 14,900)",  // 인연 타이밍이 합쳐진 상품 (2026-08-24)
    headline: ["올해도 그냥", "지나가는 걸까"],
    sub: "인연의 창이 열리는 달과 만날 경로까지 나옵니다.",
    cta: "인연 오는 달 보기  →",
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
    product: "이별 부검 리포트 (ibyeol, 29,900)",
    headline: ["내가 뭘", "그렇게 잘못했을까"],
    sub: "어디서부터 어긋났는지와 반복 패턴을 짚습니다.",
    cta: "끝난 이유 보기  →",
    accent: "#7b6bd6",
    tint: "#f4f2fe",
    ground: "#fdfdff",
  },
  {
    id: "06",
    slug: "jaehoe",
    title: "재회 사주",
    // AI 원화가 없어 상품 카드에서 뜬 배경이다 (derive-card-bg.mjs).
    background: "jaehoe-bg.png",
    // 이 그림만 attention 이 머리카락을 좇아 띠가 입 아래로 내려간다. 못박는다.
    artTop: 0.18,
    badge: "재회 사주",
    product: "재회 사주 (jaehoe, 14,900)",
    // 05(이별)와 방향이 반대다 - 저쪽은 끝난 이유, 여기는 다시 이어질 가능성.
    // 근거: "3장 01. 그 사람, 아직 너에게 마음이 남아 있을까",
    //       "5장 01. 연락이 다시 올 확률, 그리고 그 시기"
    headline: ["아직 연락", "올까 싶다면"],
    sub: "상대에게 남은 감정과 연락 올 시기를 짚습니다.",
    cta: "남은 마음 보기  →",
    accent: "#c2563f",
    tint: "#fff4ef",
    ground: "#fffdfb",
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

// 한글은 글자당 폭이 거의 일정해서 글자 수로 폭을 어림할 수 있다. 어림한 폭이
// 넘치면 글씨를 줄인다 - 나중에 문구를 늘렸을 때 조용히 잘려 나가는 것을 막는다.
// 잘린 것은 뽑아 봐야 알고, 그때는 이미 광고가 나간 뒤다.
function fitSize(text, baseSize, maxWidth, ratio) {
  const estimated = text.length * baseSize * ratio;
  return estimated <= maxWidth ? baseSize : Math.floor(baseSize * (maxWidth / estimated));
}

// 흰 바탕 위의 글자는 그림자를 안 쓴다. 흰 배경에 그림자를 얹으면 때가 탄 것처럼 보인다.
function whiteZone(c, spec) {
  const { width, imageTop, pad, badgeY, headLine, subGap, ctaY, ctaW, ctaH } = spec;
  const room = width - pad * 2;
  // 두 줄이 한 덩어리로 읽혀야 하므로 긴 줄에 맞춰 둘 다 줄인다.
  const headSize = Math.min(...c.headline.map((line) => fitSize(line, spec.headSize, room, 0.95)));
  const subSize = fitSize(c.sub, Math.round(spec.headSize * 0.44), room, 0.92);
  const ctaFont = fitSize(c.cta, Math.round(ctaH * 0.33), ctaW - 48, 0.95);
  const headY = spec.headY;
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
          font-size="${subSize}" font-weight="600">${xml(c.sub)}</text>

    <rect x="${pad}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="${ctaH / 2}" fill="${c.accent}"/>
    <text class="kr" x="${pad + ctaW / 2}" y="${ctaY + ctaH * 0.64}" fill="#fff"
          font-size="${ctaFont}" font-weight="900" text-anchor="middle">${xml(c.cta)}</text>
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

// 그림에서 가로 띠를 뜬다.
//
// 기본은 attention 이다. 941x1672 세로 그림에서 띠를 뜰 때 가운데 고정으로는
// 얼굴이 잘리는데, attention 은 정보가 몰린 쪽(대개 얼굴)을 남긴다.
//
// 다만 attention 이 얼굴을 못 찾는 그림이 있다. 재회 배경이 그랬다 - 머리카락
// 결이 화면을 가득 채워서 그쪽이 더 "정보가 많다" 고 읽혔고, 띠가 입 아래로
// 내려가 목 없는 그림이 나왔다. 그런 항목만 artTop 으로 자리를 못박는다.
// artTop 은 폭에 맞춰 늘린 그림에서 띠가 시작하는 자리(0~1)다.
async function cropBand(c, width, height) {
  const src = path.join(bgDir, c.background);
  if (c.artTop === undefined) {
    return sharp(src).resize(width, height, { fit: "cover", position: sharp.strategy.attention }).png().toBuffer();
  }
  const widened = await sharp(src).resize({ width, kernel: "lanczos3" }).toBuffer();
  const meta = await sharp(widened).metadata();
  const top = Math.max(0, Math.min(Math.round(meta.height * c.artTop), meta.height - height));
  return sharp(widened).extract({ left: 0, top, width, height }).png().toBuffer();
}

async function build(c, spec) {
  const { width, height, imageTop } = spec;
  const art = await cropBand(c, width, height - imageTop);

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
  <text class="kr" x="60" y="62" fill="#fff" font-size="38" font-weight="900">LOVERABBIT 화이트형 ${campaigns.length}종</text>
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

console.log(`Created ${campaigns.length} white-theme campaigns x 2 aspect ratios + contact sheet in marketing/ads/white-five-v1`);
