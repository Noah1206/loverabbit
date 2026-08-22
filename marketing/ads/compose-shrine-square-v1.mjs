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

const items = [
  {
    id: "01",
    slug: "breakup",
    character: "maehwa.jpg",
    title: "사주로 보는 이별",
    lines: ['밤마다 "헤어질까 말까" 반복', "답은 두 사람 사주에 있어요."],
    cta: "무료로 미리 알아보기",
    box: "#f2c230",
    boxInk: "#171013",
    ctaColor: "#ff9a3c",
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

function overlay(c) {
  const cx = S / 2;
  const titleSize = 66;
  const boxW = c.title.length * titleSize * 0.98 + 76;
  const boxH = 96;
  const boxY = 566;
  const lineSize = 52;

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

      <rect x="${cx - boxW / 2}" y="${boxY}" width="${boxW}" height="${boxH}" fill="${c.box}"/>
      <text class="kr" x="${cx}" y="${boxY + boxH * 0.72}" font-size="${titleSize}" font-weight="900"
            fill="${c.boxInk}" text-anchor="middle">${xml(c.title)}</text>

      ${outlined(c.lines[0], { x: cx, y: 748, size: lineSize, fill: "#ffffff", stroke: "#0b0710", strokeWidth: 9 })}
      ${outlined(c.lines[1], { x: cx, y: 826, size: lineSize, fill: "#ffffff", stroke: "#0b0710", strokeWidth: 9 })}

      ${outlined(c.cta, { x: cx, y: 946, size: 44, fill: c.ctaColor, stroke: "#0b0710", strokeWidth: 8 })}

      <text class="kr" x="128" y="1042" fill="#fff" font-size="21" font-weight="900">LOVE<tspan fill="#ffb3cd">RABBIT</tspan></text>
      <text class="kr" x="330" y="1042" fill="#bdb3c6" font-size="17" font-weight="550">오락 목적의 콘텐츠입니다.</text>
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

console.log(`Created ${items.length} square ad(s) in marketing/ads/shrine-square-v1`);
