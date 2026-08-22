import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// 스크린샷형 1:1 광고. 참고로 받은 소재의 구성을 그대로 따랐다 -
// 인물 한 명이 화면을 채우고, 노란 박스에 주제, 그 아래 흰 글씨 두 줄,
// 맨 아래 주황 CTA.
//
//   node marketing/ads/compose-shrine-square-v1.mjs
//
// 성인 소재가 아니다. 신당 캐릭터 원화를 쓰고, 노출도 밀착도 없다.
//
// 인물은 위쪽을 남기고 자른다(position: top). 900x1200 세로 원화를 정사각으로
// 가운데 맞춰 자르면 얼굴이 위로 빠져나간다.
//
// 흰 글씨에 검은 테두리는 같은 글자를 두 번 그려서 낸다. paint-order 는
// SVG 렌더러에 따라 무시되는 일이 있어서, 아래에 굵은 획만 한 번 깔고
// 그 위에 채운 글자를 겹친다.

const root = process.cwd();
const charDir = path.join(root, "public", "characters");
const outDir = path.join(root, "marketing", "ads", "shrine-square-v1");
const logoPath = path.join(root, "public", "logo.png");

const S = 1080;

// 노란 박스와 주황 CTA 는 주제가 바뀌어도 그대로 둔다. 이 패턴이 시리즈로
// 읽히려면 색이 흔들리면 안 된다 - 바뀌는 것은 인물과 세 줄뿐이다.
const BOX = "#f2c230";
const BOX_INK = "#171013";
const CTA_COLOR = "#ff9a3c";
const CTA = "무료로 미리 알아보기";

// 두 번째 줄은 단정하지 않고 권한다. "사주가 이렇다" 로 쓰면 아직 보지도 않은
// 사람의 사주를 광고에서 못박는 셈이 된다.
//
// 세 줄은 그 랜딩이 파는 상품의 실제 목차에서 가져왔다 (src/lib/products.ts).
// 광고가 약속한 것과 리포트가 주는 것이 다르면 환불로 돌아온다 - 클릭은 늘고
// 전환은 남지 않는다. `product` 에 근거가 된 상품을 적어 둔다.
const items = [
  {
    id: "01",
    slug: "breakup",
    character: "maehwa.jpg",
    landing: "/saju/breakup-decision",
    product: "이별 부검 리포트 (ibyeol, 29,900)",
    // 근거: "2장 01. 이별의 진짜 사인 규명", "4장 01. 반복해서 걸려 넘어지는 지점"
    title: "사주로 보는 이별",
    lines: ['"내가 뭘 그렇게 잘못했을까"', "그 연애가 끝난 진짜 이유."],
  },
  {
    id: "02",
    slug: "compatibility",
    character: "yeonhwa.jpg",
    landing: "/saju/compatibility",
    product: "속궁합 사주 (sokgunghap, 9,900)",
    // 근거: "5장 02. 다투게 된다면 반드시 이 지점에서", "5장 01. 관계 온도가 식는 위험 구간"
    title: "사주로 보는 궁합",
    lines: ['"잘 만나다가 꼭 여기서 틀어져"', "둘이 반드시 부딪히는 지점."],
  },
  {
    id: "03",
    slug: "intimate",
    character: "hongryeon.jpg",
    landing: "/saju/intimate-compatibility",
    product: "속궁합 사주 (sokgunghap, 9,900)",
    // 근거: "3장 02. 주도권은 누구에게 있는가", "4장 01. 그 사람이 무너지는 순간"
    title: "사주로 보는 속궁합",
    lines: ['"이 사람 앞에서만 내가 약해져"', "누가 쥐고 있는지 다 나와요."],
  },
  {
    id: "04",
    slug: "romance-timing",
    character: "haewol.jpg",
    landing: "/saju/romance-timing",
    product: "인연 타이밍 (insun, 14,900)",
    // 근거: "2장 01. 인연의 창이 열리는 시기", "2장 02. 만나게 될 가능성이 높은 경로"
    title: "사주로 보는 연애운",
    lines: ['"올해도 그냥 지나가는 건가"', "인연 들어오는 달, 나옵니다."],
  },
  {
    id: "05",
    slug: "inner-mind",
    character: "bihwa.jpg",
    landing: "/saju/inner-mind",
    product: "썸 해부 사주 (sseom, 12,900)",
    // 근거: "1장 02. 브레이크를 밟고 있는 쪽은 누구인가", "2장 01. 밀당인가 진심인가"
    title: "사주로 보는 속마음",
    lines: ['"읽씹은 아닌데 진도가 안 나가"', "둘 중 누가 브레이크를 밟나."],
  },
  {
    id: "06",
    slug: "mature",
    character: "hwarin.jpg",
    landing: "/saju/mature-compatibility",
    product: "속궁합 사주 (sokgunghap, 9,900)",
    // 근거: "6장 01. 권태를 피하는 완급 조절법", "5장 01. 관계 온도가 식는 위험 구간"
    // "밤" 을 뺐다. 심의에서 걸리는 것은 그 낱말이 밀착 그림과 겹칠 때다.
    title: "사주로 보는 19금 궁합",
    lines: ['"가까워질수록 어긋나는 느낌"', "둘의 속도, 어디서 갈리나."],
    adult: true,
  },
];

const xml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

// 같은 글자를 두 번 그린다. 아래는 테두리, 위는 채움.
const outlined = (text, { x, y, size, fill, stroke, strokeWidth }) => `
  <text class="kr" x="${x}" y="${y}" font-size="${size}" font-weight="900" text-anchor="middle"
        fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round">${xml(text)}</text>
  <text class="kr" x="${x}" y="${y}" font-size="${size}" font-weight="900" text-anchor="middle"
        fill="${fill}">${xml(text)}</text>
`;

// 한글은 글자당 폭이 거의 일정해서 글자 수로 폭을 어림할 수 있다. 어림한 폭이
// 화면을 넘으면 글씨를 줄인다 - 나중에 문구를 늘렸을 때 조용히 잘려 나가는 것을
// 막는다. 잘린 것은 뽑아 봐야 알고, 그때는 이미 광고가 나간 뒤다.
function fitSize(text, baseSize, maxWidth, ratio) {
  const estimated = text.length * baseSize * ratio;
  return estimated <= maxWidth ? baseSize : Math.floor(baseSize * (maxWidth / estimated));
}

function overlay(c) {
  const cx = S / 2;
  const titleSize = fitSize(c.title, 66, S - 220, 0.98);
  const boxW = c.title.length * titleSize * 0.98 + 76;
  const boxH = 96;
  const boxY = 566;
  const lineSize = Math.min(...c.lines.map((line) => fitSize(line, 52, S - 90, 0.98)));

  return Buffer.from(`
    <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
      <style>.kr { font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif; }</style>
      <defs>
        <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0b0710" stop-opacity="0"/>
          <stop offset="0.34" stop-color="#0b0710" stop-opacity="0.52"/>
          <stop offset="0.62" stop-color="#0b0710" stop-opacity="0.80"/>
          <stop offset="1" stop-color="#0b0710" stop-opacity="0.93"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${S * 0.34}" width="${S}" height="${S * 0.66}" fill="url(#veil)"/>

      <rect x="${cx - boxW / 2}" y="${boxY}" width="${boxW}" height="${boxH}" fill="${BOX}"/>
      <text class="kr" x="${cx}" y="${boxY + boxH * 0.72}" font-size="${titleSize}" font-weight="900"
            fill="${BOX_INK}" text-anchor="middle">${xml(c.title)}</text>

      ${outlined(c.lines[0], { x: cx, y: 748, size: lineSize, fill: "#ffffff", stroke: "#0b0710", strokeWidth: 9 })}
      ${outlined(c.lines[1], { x: cx, y: 826, size: lineSize, fill: "#ffffff", stroke: "#0b0710", strokeWidth: 9 })}

      ${outlined(CTA, { x: cx, y: 946, size: 44, fill: CTA_COLOR, stroke: "#0b0710", strokeWidth: 8 })}

      <text class="kr" x="128" y="1042" fill="#fff" font-size="21" font-weight="900">LOVE<tspan fill="#ffb3cd">RABBIT</tspan></text>
      <text class="kr" x="330" y="1042" fill="#bdb3c6" font-size="17" font-weight="550">${
        c.adult ? "만 19세 이상 · 오락 목적의 콘텐츠입니다." : "오락 목적의 콘텐츠입니다."
      }</text>
    </svg>
  `);
}

await mkdir(outDir, { recursive: true });

for (const c of items) {
  const art = await sharp(path.join(charDir, c.character))
    .resize(S, S, { fit: "cover", position: "top" })
    .png()
    .toBuffer();

  const logo = await sharp(logoPath).resize(38, 38).png().toBuffer();

  const composed = await sharp(art)
    .composite([
      { input: overlay(c), top: 0, left: 0 },
      { input: logo, top: 1014, left: 74 },
    ])
    .png()
    .toBuffer();

  const base = path.join(outDir, `${c.id}-${c.slug}-square-1080x1080`);
  await Promise.all([
    sharp(composed).toFile(`${base}.png`),
    sharp(composed).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(`${base}.jpg`),
  ]);
}

// 대지 - 여섯 장을 한 줄에 놓고 보면 시리즈로 읽히는지가 바로 보인다.
const cardS = 300;
const gap = 22;
const headerH = 138;
const sheetW = 56 * 2 + cardS * items.length + gap * (items.length - 1);
const sheetH = headerH + cardS + 96;

const sheetLabels = items.map((c, i) => {
  const x = 56 + i * (cardS + gap);
  return `
    <text class="kr" x="${x}" y="${headerH - 16}" fill="#fff" font-size="22" font-weight="900">${c.id}. ${xml(c.title.replace("사주로 보는 ", ""))}</text>
    <text class="kr" x="${x}" y="${headerH + cardS + 40}" fill="#b9acc5" font-size="17">${xml(c.character.replace(".jpg", ""))} · ${xml(c.landing)}</text>
  `;
}).join("");

const sheetBase = Buffer.from(`
  <svg width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}" xmlns="http://www.w3.org/2000/svg">
    <style>.kr { font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif; }</style>
    <rect width="${sheetW}" height="${sheetH}" fill="#0d0a14"/>
    <text class="kr" x="56" y="60" fill="#fff" font-size="38" font-weight="900">LOVERABBIT 스크린샷형 ${items.length}종</text>
    <text class="kr" x="58" y="102" fill="#ffd166" font-size="22" font-weight="800">같은 틀 · 인물과 세 줄만 바뀐다 · 1:1 1080×1080</text>
    ${sheetLabels}
  </svg>
`);

const sheetComposites = [{ input: sheetBase, top: 0, left: 0 }];
for (let i = 0; i < items.length; i += 1) {
  const c = items[i];
  const card = await sharp(path.join(outDir, `${c.id}-${c.slug}-square-1080x1080.png`))
    .resize(cardS, cardS, { fit: "cover" }).png().toBuffer();
  sheetComposites.push({ input: card, top: headerH, left: 56 + i * (cardS + gap) });
}

const sheet = await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: "#0d0a14" } })
  .composite(sheetComposites).png().toBuffer();

await Promise.all([
  sharp(sheet).toFile(path.join(outDir, "shrine-square-preview.png")),
  sharp(sheet).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(path.join(outDir, "shrine-square-preview.jpg")),
]);

console.log(`Created ${items.length} square ads + contact sheet in marketing/ads/shrine-square-v1`);
