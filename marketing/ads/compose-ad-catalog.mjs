import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const adsDir = path.join(root, "marketing", "ads");

const items = [
  {
    id: "01",
    title: "무료 속궁합 · 앱 UI형",
    hook: "무료 10문장으로 관계 온도를 먼저 확인",
    vertical: "free-saju-imagegen-v5/free-saju-ad-vertical-1080x1920.png",
    horizontal: "free-saju-imagegen-v5/free-saju-ad-horizontal-1200x628.png",
  },
  {
    id: "02",
    title: "관계 결정 리포트",
    hook: "붙잡을지 정리할지, 관계의 기준",
    vertical: "meta-policy-v1/relationship-decision-ad-vertical-1080x1920.png",
    horizontal: "meta-policy-v1/relationship-decision-ad-horizontal-1200x628.png",
  },
  {
    id: "03",
    title: "상대 속마음 · 해월신당",
    hook: "연락 없는 관계, 궁금한 마음의 흐름",
    vertical: "meta-policy-v1/inner-mind-ad-vertical-1080x1920.png",
    horizontal: "meta-policy-v1/inner-mind-ad-horizontal-1200x628.png",
  },
  {
    id: "04",
    title: "속궁합 · 관능 커플형",
    hook: "말보다 먼저 닿는 두 사람의 온도",
    vertical: "product-campaigns-v1/compatibility-ad-vertical-1080x1920.png",
    horizontal: "product-campaigns-v1/compatibility-ad-horizontal-1200x628.png",
  },
  {
    id: "05",
    title: "재회 흐름 리포트",
    hook: "다시 이어질 가능성을 정리해 보는 시간",
    vertical: "product-campaigns-v1/reunion-ad-vertical-1080x1920.png",
    horizontal: "product-campaigns-v1/reunion-ad-horizontal-1200x628.png",
  },
  {
    id: "06",
    title: "평생 연애운",
    hook: "연애의 큰 흐름, 어떤 모양일까?",
    vertical: "product-campaigns-v1/lifetime-romance-ad-vertical-1080x1920.png",
    horizontal: "product-campaigns-v1/lifetime-romance-ad-horizontal-1200x628.png",
  },
  {
    id: "07",
    title: "궁합 사주 · 후킹 커플형",
    hook: "우리 둘, 잘 맞을까?",
    vertical: "hook-five-v1/01-general-compatibility-ad-vertical-1080x1920.png",
    horizontal: "hook-five-v1/01-general-compatibility-ad-horizontal-1200x628.png",
  },
  {
    id: "08",
    title: "속궁합 사주 · 레드 라운지형",
    hook: "말보다 먼저 맞는 온도",
    vertical: "hook-five-v1/02-intimate-compatibility-ad-vertical-1080x1920.png",
    horizontal: "hook-five-v1/02-intimate-compatibility-ad-horizontal-1200x628.png",
  },
  {
    id: "09",
    title: "19금 사주 · 향수 광고형",
    hook: "밤이 되면 달라지는 궁합",
    vertical: "hook-five-v1/03-mature-night-ad-vertical-1080x1920.png",
    horizontal: "hook-five-v1/03-mature-night-ad-horizontal-1200x628.png",
  },
  {
    id: "10",
    title: "연애운 사주 · 봄밤 타이밍형",
    hook: "이번 사랑, 언제 시작될까?",
    vertical: "hook-five-v1/04-romance-fortune-ad-vertical-1080x1920.png",
    horizontal: "hook-five-v1/04-romance-fortune-ad-horizontal-1200x628.png",
  },
  {
    id: "11",
    title: "이별 사주 · 갈림길형",
    hook: "끝낼까, 붙잡을까?",
    vertical: "hook-five-v1/05-breakup-ad-vertical-1080x1920.png",
    horizontal: "hook-five-v1/05-breakup-ad-horizontal-1200x628.png",
  },
];

const width = 1800;
const headerHeight = 190;
const rowHeight = 620;
const height = headerHeight + rowHeight * items.length + 70;

const escapeXml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const rowLabels = items.map((item, index) => {
  const y = headerHeight + index * rowHeight;
  return `
    <rect x="35" y="${y + 20}" width="1730" height="580" rx="28" fill="${index % 2 ? "#17121f" : "#130f1a"}" stroke="#2c2338" stroke-width="2"/>
    <rect x="64" y="${y + 48}" width="76" height="42" rx="21" fill="#ff3d7f"/>
    <text class="kr" x="102" y="${y + 78}" fill="#fff" font-size="22" font-weight="900" text-anchor="middle">${item.id}</text>
    <text class="kr" x="158" y="${y + 78}" fill="#fff" font-size="30" font-weight="900">${escapeXml(item.title)}</text>
    <text class="kr" x="1260" y="${y + 170}" fill="#ff8ab2" font-size="25" font-weight="900">핵심 훅</text>
    <text class="kr" x="1260" y="${y + 212}" fill="#efe9f5" font-size="25" font-weight="700">${escapeXml(item.hook)}</text>
    <text class="kr" x="1260" y="${y + 286}" fill="#a99cbb" font-size="21">세로 1080×1920</text>
    <text class="kr" x="1260" y="${y + 322}" fill="#a99cbb" font-size="21">가로 1200×628</text>
    <text class="kr" x="1260" y="${y + 382}" fill="#e8b84b" font-size="21" font-weight="800">PNG + JPG 제공</text>
  `;
}).join("");

const base = Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>.kr { font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif; }</style>
    <rect width="${width}" height="${height}" fill="#0d0a14"/>
    <text class="kr" x="60" y="78" fill="#fff" font-size="48" font-weight="900">LOVERABBIT 광고 이미지 카탈로그</text>
    <text class="kr" x="62" y="130" fill="#ff6d9d" font-size="27" font-weight="800">11개 콘셉트 · 22개 고유 이미지 · PNG/JPG 44개 최종 파일</text>
    <text class="kr" x="62" y="168" fill="#a99cbb" font-size="20">왼쪽: 세로형 9:16 · 가운데: 가로형 1.91:1 · 오른쪽: 용도 구분</text>
    ${rowLabels}
  </svg>
`);

const composites = [{ input: base, top: 0, left: 0 }];

for (let index = 0; index < items.length; index += 1) {
  const item = items[index];
  const y = headerHeight + index * rowHeight;
  const vertical = await sharp(path.join(adsDir, item.vertical))
    .resize(252, 448, { fit: "cover" })
    .png()
    .toBuffer();
  const horizontal = await sharp(path.join(adsDir, item.horizontal))
    .resize(820, 429, { fit: "cover" })
    .png()
    .toBuffer();
  composites.push({ input: vertical, top: y + 112, left: 64 });
  composites.push({ input: horizontal, top: y + 122, left: 370 });
}

const outputPng = path.join(adsDir, "ad-catalog-preview.png");
const outputJpg = path.join(adsDir, "ad-catalog-preview.jpg");
const composed = await sharp({
  create: { width, height, channels: 4, background: "#0d0a14" },
})
  .composite(composites)
  .png()
  .toBuffer();

await sharp(composed).toFile(outputPng);
await sharp(composed).jpeg({ quality: 91, chromaSubsampling: "4:4:4" }).toFile(outputJpg);

console.log(`Created ${path.relative(root, outputPng)}`);
console.log(`Created ${path.relative(root, outputJpg)}`);
