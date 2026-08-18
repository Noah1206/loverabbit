import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// 크레딧 없이 만드는 "가벼운 움직임" 버전 — ffmpeg만 사용.
// AI 생성이 아니라서 눈 깜빡임·옷 흔들림은 없고, 아주 느린 푸시인 + 좌우 드리프트 +
// 등불 밝기 호흡만 들어간다. 신당 입장 화면 배경처럼 "정지 사진이 아니다" 정도의 인상용.
//
//   node marketing/video/animate-local.mjs                 전체
//   node marketing/video/animate-local.mjs mukyeon jawol   일부만

const IDS = [
  "hwarin", "hongryeon", "mukyeon", "jawol", "geumya", "maehwa",
  "cheongsa", "bihwa", "haewol", "yeonhwa", "jeokya",
];

const SECONDS = 3;
const FPS = 30;
const FRAMES = SECONDS * FPS;
const OUT_W = 720;
const OUT_H = 1280;

const root = process.cwd();
const imageDir = path.join(root, "public", "characters");
const outputDir = path.join(root, "marketing", "video");

await mkdir(outputDir, { recursive: true });

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const targets = (requested.length > 0 ? requested : IDS).filter((id) => {
  if (existsSync(path.join(imageDir, `${id}.jpg`))) return true;
  console.log(`[SKIP] ${id} - 이미지 없음`);
  return false;
});

// 9:16으로 잘라 넉넉히 키운 뒤 zoompan으로 천천히 밀고 들어간다.
// 흔들림(지터)을 줄이려고 원본을 먼저 2배 가까이 확대한다.
const filter = [
  `scale=${OUT_W * 2}:-2`,
  // 원본은 3:4라 9:16으로 만들려면 좌우를 잘라야 한다. 비율을 여기서 맞추지 않으면
  // zoompan의 s= 가 세로로 늘려버려 인물이 홀쭉해진다.
  `crop=w='min(iw\\,ih*${OUT_W}/${OUT_H})':h=ih`,
  [
    `zoompan=z='1.015+0.055*on/${FRAMES - 1}'`,
    `x='iw/2-(iw/zoom/2)+10*sin(2*PI*on/${FRAMES - 1})'`,
    `y='ih/2-(ih/zoom/2)-6*on/${FRAMES - 1}'`,
    `d=${FRAMES}`,
    `s=${OUT_W}x${OUT_H}`,
    `fps=${FPS}`,
  ].join(":"),
  `eq=brightness='0.016*sin(2*PI*t/${SECONDS})':saturation='1.02+0.03*sin(2*PI*t/${SECONDS})':eval=frame`,
  "format=yuv420p",
].join(",");

for (const id of targets) {
  const out = path.join(outputDir, `local-${id}-3s.mp4`);
  await run("ffmpeg", [
    "-y", "-v", "error",
    "-loop", "1",
    "-t", String(SECONDS),
    "-i", path.join(imageDir, `${id}.jpg`),
    "-vf", filter,
    "-frames:v", String(FRAMES),
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    out,
  ]);
  console.log(`[OK] ${path.relative(root, out)}`);
}
