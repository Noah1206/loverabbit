import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assetDir = path.join(root, "marketing", "ads", "hook-five-v1");
const logoPath = path.join(root, "public", "logo.png");

// 화이트형 · 스크린샷형과 같은 문구 기준을 쓴다.
//
//   1. 헤드라인은 조건문(-라면) 이거나 1인칭 질문이다. 메타는 광고가 보는 사람의
//      연애 상태를 안다고 단정하는 것을 금지한다 - "당신은 늘 여기서 틀어집니다"
//      는 거부 사유지만 "틀어진다면" 은 조건이라 걸리지 않는다.
//   2. CTA 는 그 랜딩이 파는 상품이 실제로 주는 것만 말한다 (src/lib/products.ts).
//      여기는 sub 자리가 없어서 CTA 가 그 몫까지 진다.
const campaigns = [
  {
    id: "01",
    slug: "general-compatibility",
    title: "궁합 사주",
    badge: "궁합 사주",
    product: "속궁합 사주 (sokgunghap, 9,900)",
    headline: ["잘 맞다가도", "꼭 여기서 틀어진다면"],
    cta: "부딪히는 지점 보기  →",
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
    product: "속궁합 사주 (sokgunghap, 9,900)",
    // 속궁합은 성적 상성이다. 마음이 맞는지가 아니다. 그 뜻이 안 살면 이 광고는
    // 01(궁합)과 같은 말을 하게 되고, 두 광고가 서로 예산만 갉아먹는다.
    headline: ["겉궁합은 좋은데", "속궁합은 어떨까"],
    cta: "속궁합 지수 보기  →",
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
    product: "속궁합 사주 (sokgunghap, 9,900)",
    // "밤" 을 뺐다. 심의에서 걸리는 것은 그 낱말이 밀착 그림과 겹칠 때인데,
    // 이 소재의 배경이 정확히 그 밀착 그림이다. 셋 중 위험이 가장 높다.
    headline: ["가까워질수록", "어긋나는 느낌이라면"],
    cta: "속도 차이 보기  →",
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
    product: "올해의 연애운 (yeonae, 14,900)",  // 인연 타이밍이 합쳐진 상품 (2026-08-24)
    headline: ["올해도 그냥", "지나가는 걸까"],
    cta: "인연 오는 달 보기  →",
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
    product: "이별 부검 리포트 (ibyeol, 29,900)",
    headline: ["내가 뭘", "그렇게 잘못했을까"],
    cta: "끝난 이유 보기  →",
    accent: "#ff3d7f",
    accent2: "#7355dd",
    highlight: "#ff7da8",
    veil: "#080712",
  },
  {
    id: "06",
    slug: "jaehoe",
    title: "재회 사주",
    badge: "재회 사주",
    product: "재회 사주 (jaehoe, 14,900)",
    // 05(이별)와 가장 가깝다. 갈라 두는 축은 방향이다 - 05 는 끝난 이유를
    // 부검하고 여기는 다시 이어질 가능성을 잰다. 이 축이 흐려지면 두 광고가
    // 같은 사람에게 같은 말을 하고 예산만 나눠 쓴다.
    // 근거: "3장 01. 그 사람, 아직 너에게 마음이 남아 있을까",
    //       "5장 01. 연락이 다시 올 확률, 그리고 그 시기"
    headline: ["아직 연락", "올까 싶다면"],
    cta: "남은 마음 보기  →",
    accent: "#e0664a",
    accent2: "#8b3f6a",
    highlight: "#ffb08a",
    veil: "#0c0708",
  },
  {
    id: "07",
    slug: "yeonae-year",
    title: "연애운 사주",
    badge: "연애운 사주",
    product: "올해의 연애운 (yeonae, 14,900)",
    // 04 와 같은 상품이다. 갈라 두는 축은 각도 - 04 는 혼자 기다리는 사람에게
    // "인연 들어오는 달", 여기는 올해 전체를 재는 사람에게 "기회의 달과
    // 고비의 달". 정사각 04/08 을 갈라 둔 것과 같은 축이고, 배경도 그와 같이
    // 그 상품이 실제로 쓰는 카드에서 떴다 (derive-card-bg.mjs).
    // 근거: "2장 02. 기회의 달 - 움직여야 할 때", "3장 01. 고비의 달 - 결정을 미뤄야 할 때"
    headline: ["올해는 좀", "다를까 싶다면"],
    cta: "기회의 달 보기  →",
    accent: "#e0a03c",
    accent2: "#8b4a6e",
    highlight: "#ffd08a",
    veil: "#0a0608",
  },
  {
    id: "08",
    slug: "ibyeol",
    title: "이별 사주",
    badge: "이별 사주",
    product: "이별 부검 리포트 (ibyeol, 29,900)",
    // 05 와 같은 상품이다. 05 는 자책하는 사람에게 "내가 뭘 그렇게
    // 잘못했을까", 여기는 같은 데서 반복해 끝나는 사람에게 "또 같은 데서".
    // 사는 사람이 다르다 - 문구가 같아지면 두 광고가 한 사람을 두고 서로
    // 예산만 갉아먹는다. 배경은 그 상품이 실제로 쓰는 카드에서 떴다.
    // 근거: "4장 01. 네 연애가 반복해서 걸려 넘어지는 지점"
    headline: ["또 같은 데서", "끝났다면"],
    cta: "반복되는 지점 보기  →",
    accent: "#c76a5a",
    accent2: "#5c4a7a",
    highlight: "#f0b7a4",
    veil: "#0f0a10",
  },
  {
    id: "09",
    slug: "sokgunghap",
    title: "속궁합 사주",
    badge: "속궁합 사주",
    product: "속궁합 사주 (sokgunghap, 9,900)",
    // 이 상품으로 도는 네 번째 소재다. 앞의 셋과 각도가 겹치면 안 된다 -
    // 01 은 부딪히는 지점, 02 는 속궁합 지수, 03 은 속도 차이. 여기는
    // 아직 아무도 안 쓴 주도권이다. 배경은 그 상품이 실제로 쓰는 카드에서 떴다.
    // 근거: "3장 02. 주도권은 누구에게 있는가", 키워드 "주도권 구조"
    headline: ["주도권은", "어느 쪽일까"],
    cta: "주도권 구조 보기  →",
    accent: "#b8324f",
    accent2: "#7a4a2e",
    highlight: "#f2c98a",
    veil: "#0d0705",
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

// 한글은 글자당 폭이 거의 일정해서 글자 수로 폭을 어림할 수 있다. 어림한 폭이
// 넘치면 글씨를 줄인다 - 문구를 늘렸을 때 조용히 잘려 나가는 것을 막는다.
// 잘린 것은 뽑아 봐야 알고, 그때는 이미 광고가 나간 뒤다.
function fitSize(text, baseSize, maxWidth, ratio = 0.95) {
  const estimated = text.length * baseSize * ratio;
  return estimated <= maxWidth ? baseSize : Math.floor(baseSize * (maxWidth / estimated));
}

// 두 줄이 한 덩어리로 읽혀야 하므로 긴 줄에 맞춰 둘 다 줄인다.
const headFit = (c, base, room) => Math.min(...c.headline.map((line) => fitSize(line, base, room)));

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
  const headSize = headFit(c, 80, 940);
  const ctaSize = fitSize(c.cta, 37, 650 - 44);
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

    <text class="kr" x="70" y="266" fill="#fffaf7" font-size="${headSize}" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="70" dy="0">${xml(c.headline[0])}</tspan>
      <tspan x="70" dy="98" fill="${c.highlight}">${xml(c.headline[1])}</tspan>
    </text>

    <rect x="70" y="1638" width="650" height="112" rx="56" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="395" y="1710" fill="#fff" font-size="${ctaSize}" font-weight="900" text-anchor="middle">${xml(c.cta)}</text>

    <text class="kr" x="128" y="1878" fill="#fff" font-size="25" font-weight="900">LOVE<tspan fill="${c.highlight}">RABBIT</tspan></text>
    <text class="kr" x="360" y="1878" fill="#c5b9ca" font-size="19" font-weight="550">오락 목적의 콘텐츠입니다.</text>
  `);
}

// 4:5 (1080x1350) - 모바일 피드용.
//
// 왜 따로 있는가. 9:16 을 피드에 올리면 메타가 "This image will be masked on
// Mobile News Feed" 를 띄운다. 링크 없는 이미지 광고의 피드 최대 세로비가
// 4:5 라서, 더 긴 그림은 위아래를 잘라 4:5 로 맞춰 보여준다. 그 자름은
// 가운데 기준이라 **배지와 헤드라인(위)과 CTA(아래)가 같이 날아간다** -
// 그림만 남고 파는 말이 사라진다.
//
// 그래서 피드에는 이 판을 올린다. 9:16 은 스토리·릴스 전용이다.
function feedOverlay(c) {
  const headSize = headFit(c, 76, 940);
  const ctaSize = fitSize(c.cta, 36, 650 - 44);
  return svg(1080, 1350, `
    ${commonDefs(c)}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.veil}" stop-opacity="0.80"/>
        <stop offset="0.40" stop-color="${c.veil}" stop-opacity="0.14"/>
        <stop offset="0.70" stop-color="${c.veil}" stop-opacity="0"/>
        <stop offset="1" stop-color="#07040b" stop-opacity="0.80"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="url(#veil)"/>

    <rect x="70" y="70" width="224" height="64" rx="32" fill="${c.accent}"/>
    <text class="kr" x="182" y="113" fill="#fff" font-size="28" font-weight="900" text-anchor="middle">${xml(c.badge)}</text>

    <text class="kr" x="70" y="248" fill="#fffaf7" font-size="${headSize}" font-weight="900" letter-spacing="-4" filter="url(#shadow)">
      <tspan x="70" dy="0">${xml(c.headline[0])}</tspan>
      <tspan x="70" dy="94" fill="${c.highlight}">${xml(c.headline[1])}</tspan>
    </text>

    <rect x="70" y="1086" width="650" height="108" rx="54" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="395" y="1156" fill="#fff" font-size="${ctaSize}" font-weight="900" text-anchor="middle">${xml(c.cta)}</text>

    <text class="kr" x="128" y="1312" fill="#fff" font-size="25" font-weight="900">LOVE<tspan fill="${c.highlight}">RABBIT</tspan></text>
    <text class="kr" x="360" y="1312" fill="#c5b9ca" font-size="19" font-weight="550">오락 목적의 콘텐츠입니다.</text>
  `);
}

function landscapeOverlay(c) {
  const headSize = headFit(c, 54, 1084);
  const ctaSize = fitSize(c.cta, 26, 350 - 30);
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

    <text class="kr" x="58" y="169" fill="#fffaf7" font-size="${headSize}" font-weight="900" letter-spacing="-3" filter="url(#shadow)">
      <tspan x="58" dy="0">${xml(c.headline[0])}</tspan>
      <tspan x="58" dy="68" fill="${c.highlight}">${xml(c.headline[1])}</tspan>
    </text>

    <rect x="58" y="350" width="350" height="74" rx="37" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="233" y="398" fill="#fff" font-size="${ctaSize}" font-weight="900" text-anchor="middle">${xml(c.cta)}</text>

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

  // 4:5 는 세로 배경에서 위쪽 기준으로 뜬다. 가운데로 뜨면 얼굴이 빠져나간다 -
  // 배경들이 인물을 위쪽에 두고 잘려 있기 때문이다.
  const feed = await sharp(path.join(assetDir, `${c.id}-${c.slug}-vertical-bg.png`))
    .resize(1080, 1350, { fit: "cover", position: "top" })
    .composite([
      { input: feedOverlay(c), top: 0, left: 0 },
      { input: logoPortrait, top: 1276, left: 70 },
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
    sharp(feed).toFile(path.join(assetDir, `${c.id}-${c.slug}-ad-feed-1080x1350.png`)),
    sharp(feed).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(assetDir, `${c.id}-${c.slug}-ad-feed-1080x1350.jpg`)),
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
    <text class="kr" x="58" y="70" fill="#fff" font-size="44" font-weight="900">LOVERABBIT 후킹 광고 ${campaigns.length}종</text>
    <text class="kr" x="60" y="120" fill="#ff6d9d" font-size="25" font-weight="800">${campaigns.length}개 주제 · ${campaigns.length * 2}개 고유 이미지 · PNG/JPG ${campaigns.length * 4}개 최종 파일</text>
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

console.log(`Created ${campaigns.length} campaigns x 3 aspect ratios (4:5 feed, 9:16 story, 1.91:1 link), PNG/JPG exports, and contact sheet in marketing/ads/hook-five-v1`);
