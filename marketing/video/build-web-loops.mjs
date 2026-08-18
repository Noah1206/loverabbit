import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// 신당 배경용 웹 루프 만들기.
// 3초 클립을 정방향 + 역방향으로 이어붙여(부메랑) 6초 무한 반복해도 이음매가 안 보이게 하고,
// 모바일 데이터 부담을 줄이도록 540x960 / crf 30 으로 다시 인코딩한다.
//
//   node marketing/video/build-web-loops.mjs

const root = process.cwd();
const sourceDir = path.join(root, "marketing", "video");
const outputDir = path.join(root, "public", "characters", "video");

// 실제 인물이 움직이는 클립만 웹에 싣는다 (local-*.mp4 는 카메라만 움직여서 제외)
const SOURCES = [
  { id: "hwarin", file: "test-hwarin-3s.mp4" },
  { id: "hongryeon", file: "test-hongryeon-3s.mp4" },
];

await mkdir(outputDir, { recursive: true });

for (const { id, file } of SOURCES) {
  const input = path.join(sourceDir, file);
  if (!existsSync(input)) {
    console.log(`[SKIP] ${id} - ${file} 없음`);
    continue;
  }
  const out = path.join(outputDir, `${id}.mp4`);
  await run("ffmpeg", [
    "-y", "-v", "error",
    "-i", input,
    "-filter_complex",
    "[0:v]scale=540:-2,setsar=1,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]",
    "-map", "[v]",
    "-an",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "30",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    out,
  ]);
  console.log(`[OK] ${path.relative(root, out)}`);
}
