import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// 로컬 합성본과 AI 생성본을 나란히 놓는다. 셋 중 무엇을 쓸지는 눈으로 봐야 정해진다.
//
//   node marketing/ads/adult-hook-v1/ai-version/build-compare-sheet.mjs

const here = path.dirname(fileURLToPath(import.meta.url));
const localDir = path.resolve(here, "..");

const rows = [
  { id: "01", title: "속궁합 강조형", local: "01-intimate-hook-feed-1080x1350.png", ai: "ai-01-intimate-finished-1080x1350.png" },
  { id: "02", title: "캐릭터 동반 몰입형", local: "02-character-night-feed-1080x1350.png", ai: "ai-02-character-night-finished-1080x1350.png" },
  { id: "03", title: "궁합 타이밍형", local: "03-timing-hook-feed-1080x1350.png", ai: "ai-03-timing-finished-1080x1350.png" },
];

const cardW = 384;
const cardH = 480;
const gap = 40;
const headerH = 150;
const rowH = cardH + 96;
const width = 120 + cardW * 2 + gap + 420;
const height = headerH + rowH * rows.length + 40;

const xml = (v) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const leftX = 60;
const rightX = leftX + cardW + gap;
const noteX = rightX + cardW + 44;

const labels = rows.map((r, i) => {
  const y = headerH + i * rowH;
  return `
    <text class="kr" x="${leftX}" y="${y + 30}" fill="#fff" font-size="26" font-weight="900">${r.id}. ${xml(r.title)}</text>
    <text class="kr" x="${leftX}" y="${y + cardH + 78}" fill="#8ee6b0" font-size="21" font-weight="800">로컬 합성 · 배경 원본 그대로</text>
    <text class="kr" x="${rightX}" y="${y + cardH + 78}" fill="#f2b066" font-size="21" font-weight="800">AI 생성 · 배경 다시 그려짐</text>
    <text class="kr" x="${noteX}" y="${y + 96}" fill="#b9acc5" font-size="19" font-weight="600">${xml(rows[i].note ?? "")}</text>
  `;
}).join("");

const base = Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>.kr { font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif; }</style>
    <rect width="${width}" height="${height}" fill="#0d0a14"/>
    <text class="kr" x="58" y="66" fill="#fff" font-size="40" font-weight="900">로컬 합성 vs AI 생성</text>
    <text class="kr" x="60" y="112" fill="#ff6d9d" font-size="23" font-weight="800">같은 배경 · 같은 카피 · 같은 4:5 (1080×1350)</text>
    ${labels}
  </svg>
`);

const composites = [{ input: base, top: 0, left: 0 }];
for (let i = 0; i < rows.length; i += 1) {
  const r = rows[i];
  const y = headerH + i * rowH;
  const local = await sharp(path.join(localDir, r.local)).resize(cardW, cardH, { fit: "cover" }).png().toBuffer();
  const ai = await sharp(path.join(here, r.ai)).resize(cardW, cardH, { fit: "cover" }).png().toBuffer();
  composites.push({ input: local, top: y + 46, left: leftX });
  composites.push({ input: ai, top: y + 46, left: rightX });
}

const sheet = await sharp({ create: { width, height, channels: 4, background: "#0d0a14" } })
  .composite(composites)
  .png()
  .toBuffer();

await Promise.all([
  sharp(sheet).toFile(path.join(here, "compare-local-vs-ai.png")),
  sharp(sheet).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(path.join(here, "compare-local-vs-ai.jpg")),
]);

console.log("Wrote compare-local-vs-ai.{png,jpg}");
