import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// 성인 타겟 후킹 광고 3종 (Manus 명세 기반).
//
// 명세의 첫 번째 요구는 "원본 배경을 훼손하지 않는다" 였다. 그래서 이미지 모델을
// 쓰지 않는다 - 모델은 배경을 다시 그리고, 한글 받침을 흘린다. 여기서는 배경 픽셀을
// 그대로 두고 그 위에 SVG 를 합성한다. 배경은 한 픽셀도 안 바뀌고, 문구는 나중에
// 이 파일 한 줄만 고쳐 다시 뽑을 수 있다.
//
//   node marketing/ads/compose-adult-hook-v1.mjs
//
// 4:5(1080x1350) 는 피드용, 9:16(1080x1920) 은 릴스/스토리용이다. 메타는 같은
// 소재라도 배치마다 잘라내는 위치가 달라서, 한 벌만 올리면 문구가 잘린다.

const root = process.cwd();
const bgDir = path.join(root, "public", "ads", "saju");
const outDir = path.join(root, "marketing", "ads", "adult-hook-v1");
const logoPath = path.join(root, "public", "logo.png");

const campaigns = [
  {
    id: "01",
    slug: "intimate-hook",
    title: "속궁합 강조형",
    background: "intimate-compatibility-bg.png",
    badge: "속궁합 사주",
    headline: ["겉으로 보이는 궁합이", "전부는 아니니까요."],
    highlightLine: 1,
    sub: "남들에게 말 못 할 두 사람만의 진짜 궁합",
    cta: "무료로 속궁합 확인하기  →",
    decor: "grid",
    accent: "#ff315f",
    accent2: "#8b2f6f",
    highlight: "#ff758f",
    veil: "#120307",
  },
  {
    id: "02",
    slug: "character-night",
    title: "캐릭터 동반 몰입형",
    background: "mature-compatibility-bg.png",
    badge: "19금 사주",
    headline: ["당신의 밤을 위한", "특별한 사주풀이"],
    highlightLine: 1,
    sub: "매력적인 캐릭터가 직접 들려주는 당신의 운명 이야기",
    cta: "캐릭터 만나고 무료 사주 보기  →",
    decor: "chat",
    accent: "#d92758",
    accent2: "#6f214f",
    highlight: "#ff5c72",
    veil: "#100205",
    adult: true,
  },
  {
    id: "03",
    slug: "timing-hook",
    title: "궁합 타이밍형",
    background: "romance-timing-bg.png",
    badge: "연애운 사주",
    headline: ["우리의 인연이 깊어지는", "진짜 타이밍"],
    highlightLine: 1,
    sub: "스쳐 갈 인연인지, 오래 갈 인연인지",
    cta: "무료로 연애 타이밍 확인하기  →",
    decor: "timeline",
    accent: "#d94d77",
    accent2: "#8b5cf6",
    highlight: "#f2b066",
    veil: "#080b18",
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

function defs(c) {
  return `
    <defs>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${c.accent}"/>
        <stop offset="1" stop-color="${c.accent2}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="8" stdDeviation="11" flood-color="#000" flood-opacity="0.78"/>
      </filter>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#000" flood-opacity="0.62"/>
      </filter>
    </defs>
  `;
}

// 헤드라인 줄 수가 달라도 아래 요소가 밀리도록, 블록 높이를 돌려준다.
function headlineBlock(c, { x, y, size, lineHeight }) {
  const lines = c.headline.map((line, index) => {
    const fill = index === c.highlightLine ? c.highlight : "#fffaf7";
    const dy = index === 0 ? 0 : lineHeight;
    return `<tspan x="${x}" dy="${dy}" fill="${fill}">${xml(line)}</tspan>`;
  }).join("");
  return {
    markup: `
      <text class="kr" x="${x}" y="${y}" font-size="${size}" font-weight="900" letter-spacing="-3" filter="url(#shadow)">
        ${lines}
      </text>
    `,
    bottom: y + lineHeight * (c.headline.length - 1),
  };
}

// 명세의 "사주 그리드 UI" - 값은 적지 않는다. 광고 이미지에 수치를 박으면
// 그건 아직 보지도 않은 사람의 사주를 단정한 셈이 된다.
function gridDecor(c, { x, y, scale }) {
  const labels = ["성향", "온도", "타이밍", "거리감"];
  const w = Math.round(150 * scale);
  const h = Math.round(74 * scale);
  const gap = Math.round(16 * scale);
  const font = Math.round(24 * scale);
  return labels.map((label, index) => {
    const cx = x + index * (w + gap);
    return `
      <rect x="${cx}" y="${y}" width="${w}" height="${h}" rx="${Math.round(18 * scale)}"
            fill="#ffffff" fill-opacity="0.10" stroke="${c.highlight}" stroke-opacity="0.55" stroke-width="2"/>
      <text class="kr" x="${cx + w / 2}" y="${y + h / 2 + font * 0.36}" fill="#f7eef4"
            font-size="${font}" font-weight="800" text-anchor="middle">${xml(label)}</text>
    `;
  }).join("");
}

// 명세의 "chat-bubble UI" - 대화형이라는 것만 보이면 된다.
function chatDecor(c, { x, y, scale }) {
  const font = Math.round(26 * scale);
  const padX = Math.round(30 * scale);
  const padY = Math.round(20 * scale);
  const h = font + padY * 2;
  const gap = Math.round(18 * scale);
  const left = { text: "오늘 밤, 그 사람 마음이 궁금해요", incoming: false };
  const right = { text: "그 흐름부터 같이 볼까요", incoming: true };
  const widthOf = (t) => Math.round(t.length * font * 0.95) + padX * 2;
  const w1 = widthOf(left.text);
  const w2 = widthOf(right.text);
  return `
    <rect x="${x}" y="${y}" width="${w1}" height="${h}" rx="${Math.round(h / 2)}"
          fill="#ffffff" fill-opacity="0.14" filter="url(#soft)"/>
    <text class="kr" x="${x + padX}" y="${y + padY + font * 0.82}" fill="#f6edf3"
          font-size="${font}" font-weight="700">${xml(left.text)}</text>
    <rect x="${x + Math.round(48 * scale)}" y="${y + h + gap}" width="${w2}" height="${h}" rx="${Math.round(h / 2)}"
          fill="${c.accent}" fill-opacity="0.92" filter="url(#soft)"/>
    <text class="kr" x="${x + Math.round(48 * scale) + padX}" y="${y + h + gap + padY + font * 0.82}" fill="#fff"
          font-size="${font}" font-weight="800">${xml(right.text)}</text>
  `;
}

// 타이밍형 - 눈금만 있고 날짜는 없다. 날짜를 박으면 지어낸 값이 된다.
function timelineDecor(c, { x, y, scale }) {
  const width = Math.round(660 * scale);
  const dots = 5;
  const step = width / (dots - 1);
  const r = Math.round(9 * scale);
  const marks = Array.from({ length: dots }, (_, index) => {
    const cx = x + index * step;
    const active = index === 3;
    return `<circle cx="${cx}" cy="${y}" r="${active ? r * 1.9 : r}"
              fill="${active ? c.highlight : "#ffffff"}" fill-opacity="${active ? 1 : 0.45}"/>`;
  }).join("");
  return `
    <rect x="${x}" y="${y - Math.round(2 * scale)}" width="${width}" height="${Math.round(4 * scale)}"
          rx="${Math.round(2 * scale)}" fill="#ffffff" fill-opacity="0.28"/>
    ${marks}
    <text class="kr" x="${x + step * 3}" y="${y + Math.round(56 * scale)}" fill="${c.highlight}"
          font-size="${Math.round(25 * scale)}" font-weight="900" text-anchor="middle">여기쯤</text>
  `;
}

function decorFor(c, placement) {
  if (c.decor === "grid") return gridDecor(c, placement);
  if (c.decor === "chat") return chatDecor(c, placement);
  return timelineDecor(c, placement);
}

function portraitOverlay(c) {
  const head = headlineBlock(c, { x: 70, y: 300, size: 70, lineHeight: 92 });
  return svg(1080, 1920, `
    ${defs(c)}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.veil}" stop-opacity="0.84"/>
        <stop offset="0.40" stop-color="${c.veil}" stop-opacity="0.16"/>
        <stop offset="0.70" stop-color="${c.veil}" stop-opacity="0.06"/>
        <stop offset="1" stop-color="#07040b" stop-opacity="0.86"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#veil)"/>

    <rect x="70" y="88" width="${c.badge.length * 30 + 68}" height="64" rx="32" fill="${c.accent}"/>
    <text class="kr" x="${70 + (c.badge.length * 30 + 68) / 2}" y="131" fill="#fff" font-size="28"
          font-weight="900" text-anchor="middle">${xml(c.badge)}</text>

    ${head.markup}

    <text class="kr" x="70" y="${head.bottom + 78}" fill="#e6d9e8" font-size="34" font-weight="650">${xml(c.sub)}</text>

    ${decorFor(c, { x: 70, y: head.bottom + 140, scale: 1 })}

    <rect x="70" y="1622" width="770" height="116" rx="58" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="455" y="1697" fill="#fff" font-size="38" font-weight="900" text-anchor="middle">${xml(c.cta)}</text>

    <text class="kr" x="128" y="1874" fill="#fff" font-size="25" font-weight="900">LOVE<tspan fill="${c.highlight}">RABBIT</tspan></text>
    <text class="kr" x="360" y="1874" fill="#c5b9ca" font-size="19" font-weight="550">${c.adult ? "만 19세 이상 · 오락 목적의 콘텐츠입니다." : "오락 목적의 콘텐츠입니다."}</text>
  `);
}

function squareishOverlay(c) {
  const head = headlineBlock(c, { x: 64, y: 268, size: 64, lineHeight: 84 });
  return svg(1080, 1350, `
    ${defs(c)}
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.veil}" stop-opacity="0.86"/>
        <stop offset="0.44" stop-color="${c.veil}" stop-opacity="0.18"/>
        <stop offset="0.68" stop-color="${c.veil}" stop-opacity="0.08"/>
        <stop offset="1" stop-color="#07040b" stop-opacity="0.88"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="url(#veil)"/>

    <rect x="64" y="76" width="${c.badge.length * 30 + 68}" height="62" rx="31" fill="${c.accent}"/>
    <text class="kr" x="${64 + (c.badge.length * 30 + 68) / 2}" y="118" fill="#fff" font-size="27"
          font-weight="900" text-anchor="middle">${xml(c.badge)}</text>

    ${head.markup}

    <text class="kr" x="64" y="${head.bottom + 70}" fill="#e6d9e8" font-size="32" font-weight="650">${xml(c.sub)}</text>

    ${decorFor(c, { x: 64, y: head.bottom + 128, scale: 0.92 })}

    <rect x="64" y="1082" width="740" height="110" rx="55" fill="url(#cta)" filter="url(#shadow)"/>
    <text class="kr" x="434" y="1153" fill="#fff" font-size="36" font-weight="900" text-anchor="middle">${xml(c.cta)}</text>

    <text class="kr" x="120" y="1300" fill="#fff" font-size="24" font-weight="900">LOVE<tspan fill="${c.highlight}">RABBIT</tspan></text>
    <text class="kr" x="344" y="1300" fill="#c5b9ca" font-size="18" font-weight="550">${c.adult ? "만 19세 이상 · 오락 목적의 콘텐츠입니다." : "오락 목적의 콘텐츠입니다."}</text>
  `);
}

async function exportCampaign(c) {
  const background = path.join(bgDir, c.background);
  const logoFeed = await sharp(logoPath).resize(44, 44).png().toBuffer();
  const logoStory = await sharp(logoPath).resize(46, 46).png().toBuffer();

  const feed = await sharp(background)
    .resize(1080, 1350, { fit: "cover", position: "center" })
    .composite([
      { input: squareishOverlay(c), top: 0, left: 0 },
      { input: logoFeed, top: 1266, left: 64 },
    ])
    .png()
    .toBuffer();

  const story = await sharp(background)
    .resize(1080, 1920, { fit: "cover", position: "center" })
    .composite([
      { input: portraitOverlay(c), top: 0, left: 0 },
      { input: logoStory, top: 1838, left: 70 },
    ])
    .png()
    .toBuffer();

  const base = `${c.id}-${c.slug}`;
  await Promise.all([
    sharp(feed).toFile(path.join(outDir, `${base}-feed-1080x1350.png`)),
    sharp(feed).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(outDir, `${base}-feed-1080x1350.jpg`)),
    sharp(story).toFile(path.join(outDir, `${base}-story-1080x1920.png`)),
    sharp(story).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(outDir, `${base}-story-1080x1920.jpg`)),
  ]);
}

async function buildContactSheet() {
  const width = 1560;
  const headerHeight = 160;
  const rowHeight = 520;
  const height = headerHeight + rowHeight * campaigns.length + 40;

  const labels = campaigns.map((c, index) => {
    const y = headerHeight + index * rowHeight;
    return `
      <rect x="34" y="${y + 18}" width="1492" height="484" rx="28" fill="${index % 2 ? "#17121f" : "#130f1a"}" stroke="#30263b" stroke-width="2"/>
      <rect x="60" y="${y + 42}" width="70" height="38" rx="19" fill="${c.accent}"/>
      <text class="kr" x="95" y="${y + 69}" fill="#fff" font-size="20" font-weight="900" text-anchor="middle">${c.id}</text>
      <text class="kr" x="150" y="${y + 70}" fill="#fff" font-size="28" font-weight="900">${xml(c.title)}</text>
      <text class="kr" x="940" y="${y + 150}" fill="${c.highlight}" font-size="23" font-weight="900">메인 카피</text>
      <text class="kr" x="940" y="${y + 192}" fill="#f4edf8" font-size="26" font-weight="850">${xml(c.headline.join(" "))}</text>
      <text class="kr" x="940" y="${y + 252}" fill="${c.highlight}" font-size="23" font-weight="900">CTA</text>
      <text class="kr" x="940" y="${y + 292}" fill="#f4edf8" font-size="24" font-weight="750">${xml(c.cta)}</text>
      <text class="kr" x="940" y="${y + 352}" fill="#b9acc5" font-size="20">피드 1080×1350 · 스토리 1080×1920</text>
      <text class="kr" x="940" y="${y + 392}" fill="#e8b84b" font-size="20" font-weight="850">배경 원본 유지 · PNG + JPG</text>
    `;
  }).join("");

  const base = svg(width, height, `
    <rect width="${width}" height="${height}" fill="#0d0a14"/>
    <text class="kr" x="58" y="68" fill="#fff" font-size="42" font-weight="900">LOVERABBIT 성인 타겟 후킹 3종</text>
    <text class="kr" x="60" y="116" fill="#ff6d9d" font-size="24" font-weight="800">3개 시안 · 2개 비율 · PNG/JPG 12개 최종 파일</text>
    ${labels}
  `);

  const composites = [{ input: base, top: 0, left: 0 }];
  for (let index = 0; index < campaigns.length; index += 1) {
    const c = campaigns[index];
    const y = headerHeight + index * rowHeight;
    const feed = await sharp(path.join(outDir, `${c.id}-${c.slug}-feed-1080x1350.png`))
      .resize(342, 428, { fit: "cover" }).png().toBuffer();
    const story = await sharp(path.join(outDir, `${c.id}-${c.slug}-story-1080x1920.png`))
      .resize(241, 428, { fit: "cover" }).png().toBuffer();
    composites.push({ input: feed, top: y + 46, left: 150 });
    composites.push({ input: story, top: y + 46, left: 520 });
  }

  const sheet = await sharp({
    create: { width, height, channels: 4, background: "#0d0a14" },
  }).composite(composites).png().toBuffer();

  await Promise.all([
    sharp(sheet).toFile(path.join(outDir, "adult-hook-preview.png")),
    sharp(sheet).jpeg({ quality: 91, chromaSubsampling: "4:4:4" }).toFile(path.join(outDir, "adult-hook-preview.jpg")),
  ]);
}

await mkdir(outDir, { recursive: true });
for (const c of campaigns) await exportCampaign(c);
await buildContactSheet();

console.log("Created 3 concepts x 2 aspect ratios (PNG/JPG) + contact sheet in marketing/ads/adult-hook-v1");
