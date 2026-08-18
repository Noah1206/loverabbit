import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// Windows의 npm 전역 설치본은 .cmd 래퍼라 node가 직접 spawn하지 못한다.
// 래퍼가 감싸고 있는 실제 진입 스크립트를 찾아 node로 실행한다.
const CLI_ENTRY = [
  path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@higgsfield", "cli", "bin", "higgsfield.js"),
  path.join(process.env.HOME ?? "", ".npm-global", "lib", "node_modules", "@higgsfield", "cli", "bin", "higgsfield.js"),
  "/usr/local/lib/node_modules/@higgsfield/cli/bin/higgsfield.js",
].find((candidate) => candidate && existsSync(candidate));

const cli = (argv, options = {}) =>
  CLI_ENTRY
    ? run(process.execPath, [CLI_ENTRY, ...argv], options)
    : run("higgsfield", argv, options);

// 신당 캐릭터 정지 이미지를 "살아 있는 초상" 3초 클립으로 만든다.
// marketing/video/test-*.mp4 를 만든 것과 같은 설정: Wan 2.7 image-to-video, 3s, 9:16, 720p.
//
//   node marketing/video/animate-characters.mjs --dry-run          비용만 확인
//   node marketing/video/animate-characters.mjs                    아직 없는 캐릭터 전부
//   node marketing/video/animate-characters.mjs --only mukyeon,jawol
//   node marketing/video/animate-characters.mjs --force            이미 있어도 다시 생성
//
// 크레딧이 모자라면 CLI가 그대로 실패하므로, 먼저 --dry-run 으로 총액을 확인하세요.

const MODEL = "wan2_7";
const DURATION = 3;
const RESOLUTION = "720p";
const ASPECT = "9:16";

const root = process.cwd();
const imageDir = path.join(root, "public", "characters");
const outputDir = path.join(root, "marketing", "video");

// 여성(신녀·아씨) / 남성(도령) 구분만 다르고 나머지 지시는 동일하게 간다.
const CHARACTERS = [
  { id: "hwarin", subject: "young man", motif: "burning peony in his hands, golden bells and red drapes behind him" },
  { id: "hongryeon", subject: "young woman", motif: "glowing red lotus on her raised hand, lotus lanterns floating on dark water behind her" },
  { id: "mukyeon", subject: "young man", motif: "ink-dark robes and drifting incense smoke around him" },
  { id: "jawol", subject: "young woman", motif: "violet moonlight and silk sleeves around her" },
  { id: "geumya", subject: "young man", motif: "golden lamplight and hanging talismans behind him" },
  { id: "maehwa", subject: "young woman", motif: "plum blossom petals drifting past her" },
  { id: "cheongsa", subject: "young man", motif: "blue-green serpentine embroidery and candle smoke around him" },
  { id: "bihwa", subject: "young woman", motif: "veiled lanterns and falling petals behind her" },
  { id: "haewol", subject: "young man", motif: "pale dawn light and thin mist around him" },
  { id: "yeonhwa", subject: "young woman", motif: "warm lotus light cupped near her" },
  { id: "jeokya", subject: "young man", motif: "deep red night lanterns glowing behind him" },
];

// 정지 이미지의 인물·의상·구도를 그대로 두고 "숨결"만 넣는 프롬프트.
// 시선을 카메라에 고정시키지 않으면 모델이 고개를 돌려 다른 사람처럼 보인다.
const promptFor = ({ subject, motif }) =>
  [
    "Subtle cinematic motion, minimal movement.",
    `The ${subject} keeps ${subject.includes("woman") ? "her" : "his"} gaze locked directly on the camera for the entire shot`,
    "- never looks away, never turns the head, never changes pose.",
    `Soft breathing and one slow blink. The ${motif} shimmer and sway very slightly.`,
    "Hair and silk fabric drift a few millimetres. Extremely slow camera push-in.",
    "Preserve the face, hairstyle, ornaments and costume exactly as in the source image.",
    "No cuts, no text, no new characters, no camera shake.",
  ].join(" ");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const onlyArg = args.find((arg) => arg.startsWith("--only"));
const only = onlyArg
  ? (onlyArg.includes("=") ? onlyArg.split("=")[1] : args[args.indexOf(onlyArg) + 1] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  : null;

await mkdir(outputDir, { recursive: true });

const targets = CHARACTERS.filter((character) => {
  if (only && !only.includes(character.id)) return false;
  if (!existsSync(path.join(imageDir, `${character.id}.jpg`))) {
    console.log(`[SKIP] ${character.id} - public/characters/${character.id}.jpg 없음`);
    return false;
  }
  const done = path.join(outputDir, `${character.id}-3s.mp4`);
  const sample = path.join(outputDir, `test-${character.id}-3s.mp4`);
  if (!force && (existsSync(done) || existsSync(sample))) {
    console.log(`[SKIP] ${character.id} - 이미 클립이 있음 (--force 로 재생성)`);
    return false;
  }
  return true;
});

if (targets.length === 0) {
  console.log("만들 대상이 없습니다.");
  process.exit(0);
}

const baseFlags = (character) => [
  MODEL,
  "--prompt",
  promptFor(character),
  "--start-image",
  path.join(imageDir, `${character.id}.jpg`),
  "--duration",
  String(DURATION),
  "--resolution",
  RESOLUTION,
  "--aspect_ratio",
  ASPECT,
];

if (dryRun) {
  const { stdout } = await cli(["generate", "cost", ...baseFlags(targets[0])]);
  const per = Number.parseFloat(stdout.trim());
  console.log(`대상 ${targets.length}편: ${targets.map((c) => c.id).join(", ")}`);
  console.log(`1편당 ${stdout.trim()} → 합계 약 ${(per * targets.length).toFixed(1)} 크레딧`);
  process.exit(0);
}

for (const character of targets) {
  console.log(`[RUN] ${character.id} 생성 중…`);
  try {
    const { stdout } = await cli(["generate", "create", ...baseFlags(character), "--wait", "--json"], {
      maxBuffer: 1024 * 1024 * 8,
    });
    const jobs = JSON.parse(stdout);
    const url = jobs?.[0]?.result_url;
    if (!url) throw new Error("result_url 없음");

    const response = await fetch(url);
    if (!response.ok) throw new Error(`다운로드 실패 ${response.status}`);
    const file = path.join(outputDir, `${character.id}-3s.mp4`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    console.log(`[OK] ${path.relative(root, file)}`);
  } catch (error) {
    console.error(`[FAIL] ${character.id} - ${error.message}`);
  }
}
