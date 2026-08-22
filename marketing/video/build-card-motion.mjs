import { existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// 힉스필드 원본(marketing/video/cards-raw/*.mp4)을 웹에 올릴 크기로 줄이고,
// 어떤 카드에 클립이 있는지 목록(src/lib/card-motion.ts)을 다시 쓴다.
//
//   node marketing/video/build-card-motion.mjs
//   node marketing/video/build-card-motion.mjs --only sokgunghap
//
// 하는 일 세 가지:
//  1. 소리를 뺀다. 카드는 어차피 음소거로 재생되는데 오디오 트랙만큼 용량이 는다.
//     (wan2.7 은 시키지 않아도 소리를 만든다)
//  2. 720x960(3:4) / 24fps / crf 28 로 줄인다. 카드 한 장이 수 MB면 그림 하나
//     보자고 데이터를 태우는 셈이라, 400KB 언저리를 목표로 한다.
//  3. faststart - 앞부분만 받아도 재생이 시작된다. 이게 없으면 파일을 다 받을
//     때까지 첫 프레임도 안 나온다.

const root = process.cwd();
const rawDir = path.join(root, "marketing", "video", "cards-raw");
const outDir = path.join(root, "public", "cards-motion");
const manifest = path.join(root, "src", "lib", "card-motion.ts");

const args = process.argv.slice(2);
const onlyArg = args.find((arg) => arg.startsWith("--only"));
const only = onlyArg
  ? (onlyArg.includes("=") ? onlyArg.split("=")[1] : args[args.indexOf(onlyArg) + 1] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  : null;

await mkdir(outDir, { recursive: true });

const raws = existsSync(rawDir)
  ? (await readdir(rawDir)).filter((name) => name.endsWith(".mp4")).map((name) => name.replace(/\.mp4$/, ""))
  : [];

for (const id of raws) {
  if (only && !only.includes(id)) continue;
  const input = path.join(rawDir, `${id}.mp4`);
  const output = path.join(outDir, `${id}.mp4`);
  await run("ffmpeg", [
    "-y", "-v", "error",
    "-i", input,
    "-an",
    "-vf", "scale=720:960:force_original_aspect_ratio=increase,crop=720:960,fps=24",
    "-c:v", "libx264",
    "-profile:v", "main",
    "-preset", "slow",
    "-crf", "28",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    output,
  ]);
  const size = (await stat(output)).size;
  console.log(`[OK] ${path.relative(root, output)} - ${(size / 1024).toFixed(0)}KB`);
}

// 목록을 다시 쓴다. 화면 쪽이 이 목록을 보고 "이 카드는 클립이 있다" 를 판단하기
// 때문에, 없는 파일을 켜두면 404 를 부르고 있는 파일을 빼두면 영영 안 나온다.
const shipped = (await readdir(outDir))
  .filter((name) => name.endsWith(".mp4"))
  .map((name) => name.replace(/\.mp4$/, ""))
  .sort();

const body = [
  "// 이 파일은 marketing/video/build-card-motion.mjs 가 생성한다. 손으로 고치지 마라.",
  "//",
  "// public/cards-motion/<id>.mp4 가 실제로 있는 카드만 들어 있다. 여기 이름이",
  "// 있으면 화면이 그 카드에서 영상을 틀려 하고, 없으면 정지 그림 그대로 간다.",
  "",
  "export const CARD_MOTION: readonly string[] = [",
  ...shipped.map((id) => `  "${id}",`),
  "];",
  "",
  "export function hasCardMotion(category: string | undefined | null): boolean {",
  "  return !!category && CARD_MOTION.includes(category);",
  "}",
  "",
].join("\r\n");

await writeFile(manifest, body, "utf8");
console.log(`\n[OK] ${path.relative(root, manifest)} - ${shipped.length}편 등록`);
