import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Instagram profile picture, composed locally from public/logo.png.
// No image generation, no credits spent. Output is 1080x1080; Instagram
// crops it to a circle, so every element stays inside a safe circle.

const SIZE = 1080;
const root = process.cwd();
const logoPath = path.join(root, "public", "logo.png");
const outputDir = path.join(root, "marketing", "instagram", "profile");

await mkdir(outputDir, { recursive: true });

// ── 1. 로고 아이콘에서 토끼만 오려낸다 ────────────────────────────────
// 배경은 (12,10,16) 단색, 외곽선은 (1,1,1) 순수 검정이라 색거리로 분리된다.
// HARD 이하 = 완전 투명, SOFT 이상 = 불투명. 그 사이는 경계 앤티앨리어싱.
const CROP = { left: 240, top: 140, width: 560, height: 800 };
const BG = [12, 10, 16];
const HARD = 6;
const SOFT = 16;

const { data, info } = await sharp(logoPath)
  .extract(CROP)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const distance = Math.hypot(data[i] - BG[0], data[i + 1] - BG[1], data[i + 2] - BG[2]);
  if (distance <= HARD) {
    data[i + 3] = 0;
  } else if (distance < SOFT) {
    data[i + 3] = Math.round((255 * (distance - HARD)) / (SOFT - HARD));
  }
}

const rabbit = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toBuffer();

// ── 2. 배경 ────────────────────────────────────────────────────────────
const sparkle = (cx, cy, r, fill, opacity = 1) => `
  <path d="M ${cx} ${cy - r} Q ${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy}
           Q ${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r}
           Q ${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy}
           Q ${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z"
        fill="${fill}" opacity="${opacity}"/>`;

const heart = (cx, cy, s, fill, opacity = 1) => `
  <path transform="translate(${cx} ${cy}) scale(${s / 32})"
        d="M0 12 C -14 0 -16 -10 -8 -14 C -3 -16 0 -12 0 -9 C 0 -12 3 -16 8 -14 C 16 -10 14 0 0 12 Z"
        fill="${fill}" opacity="${opacity}"/>`;

const background = (theme) => {
  const dark = theme === "dark";
  const stops = dark
    ? { c1: "#241a33", c2: "#120c1c", c3: "#07050c", glow: "#ff3d7f", glow2: "#8b5cf6" }
    : { c1: "#ff6f9c", c2: "#e0356f", c3: "#8c1140", glow: "#ffd28a", glow2: "#ff9ec4" };
  const sparkleFill = dark ? "#b9a4ff" : "#fff3c9";
  const heartFill = dark ? "#ff8ab2" : "#ffe0ec";

  return Buffer.from(`
    <svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="base" cx="0.5" cy="0.38" r="0.78">
          <stop offset="0" stop-color="${stops.c1}"/>
          <stop offset="0.58" stop-color="${stops.c2}"/>
          <stop offset="1" stop-color="${stops.c3}"/>
        </radialGradient>
        <radialGradient id="glowA" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="${stops.glow}" stop-opacity="${dark ? 0.46 : 0.5}"/>
          <stop offset="1" stop-color="${stops.glow}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowB" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="${stops.glow2}" stop-opacity="${dark ? 0.38 : 0.42}"/>
          <stop offset="1" stop-color="${stops.glow2}" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <rect width="${SIZE}" height="${SIZE}" fill="url(#base)"/>
      <circle cx="300" cy="250" r="430" fill="url(#glowA)"/>
      <circle cx="820" cy="880" r="470" fill="url(#glowB)"/>

      <!-- 원형 크롭 안쪽에 도는 얇은 링 -->
      <circle cx="540" cy="540" r="498" fill="none" stroke="#ffffff" stroke-opacity="${dark ? 0.13 : 0.26}" stroke-width="4"/>
      <circle cx="540" cy="540" r="470" fill="none" stroke="#ffffff" stroke-opacity="${dark ? 0.06 : 0.14}" stroke-width="2"/>

      ${sparkle(196, 392, 44, sparkleFill, 0.92)}
      ${sparkle(892, 706, 30, sparkleFill, 0.8)}
      ${heart(162, 592, 44, heartFill, 0.85)}
      ${heart(918, 398, 36, heartFill, 0.8)}
    </svg>
  `);
};

// ── 3. 합성 ────────────────────────────────────────────────────────────
const RABBIT_HEIGHT = 800;
const RABBIT_WIDTH = Math.round((CROP.width * RABBIT_HEIGHT) / CROP.height);

// 원본 아이콘은 몸통 아래가 프레임에 잘려 있어, 그대로 얹으면 직선 단면이 보인다.
// 아래 100px을 알파로 서서히 지워 배경에 녹인다.
const bottomFade = Buffer.from(`
  <svg width="${RABBIT_WIDTH}" height="${RABBIT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="1"/>
        <stop offset="${(RABBIT_HEIGHT - 110) / RABBIT_HEIGHT}" stop-color="#fff" stop-opacity="1"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${RABBIT_WIDTH}" height="${RABBIT_HEIGHT}" fill="url(#fade)"/>
  </svg>
`);

const rabbitLayer = await sharp(rabbit)
  .resize({ width: RABBIT_WIDTH, height: RABBIT_HEIGHT, fit: "inside" })
  .composite([{ input: bottomFade, blend: "dest-in" }])
  .png()
  .toBuffer();

const circleMask = Buffer.from(`
  <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="#fff"/>
  </svg>
`);

for (const theme of ["dark", "rose"]) {
  const composed = await sharp(background(theme))
    .composite([
      {
        input: rabbitLayer,
        left: Math.round((SIZE - RABBIT_WIDTH) / 2),
        top: 168,
      },
    ])
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
    .toBuffer();

  await sharp(composed).toFile(path.join(outputDir, `loverabbit-profile-${theme}.jpg`));

  // 인스타에서 실제로 보이는 원형 크롭 미리보기
  await sharp(composed)
    .ensureAlpha()
    .composite([{ input: circleMask, blend: "dest-in" }])
    .png()
    .toFile(path.join(outputDir, `preview-circle-${theme}.png`));

  console.log(`[OK] loverabbit-profile-${theme}.jpg + preview-circle-${theme}.png`);
}
