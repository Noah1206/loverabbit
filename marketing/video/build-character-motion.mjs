import { existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// 표정 클립을 웹에 올릴 크기로 줄이고, 어떤 캐릭터가 어떤 표정을 갖고 있는지
// 목록(src/lib/character-motion.ts)을 다시 쓴다.
//
//   node marketing/video/build-character-motion.mjs
//
// 원본을 두 곳에서 읽는다.
//
//   marketing/video/emotions-raw/<캐릭터>__<표정>.mp4        -> public/characters/motion/
//   marketing/video/emotions-raw-adult/<캐릭터>__<표정>.mp4  -> public/characters/motion-adult/
//
// 직접 만든 파일을 넣을 때도 같은 이름 규칙만 지키면 된다. 힉스필드를 쓰든 다른
// 도구를 쓰든 상관없다 - 여기는 파일만 본다.
//
// 이미 압축해 둔 mp4 를 public/characters/motion-adult/<캐릭터>/<표정>.mp4 로
// 곧장 넣어도 된다. 그 경우 이 스크립트는 목록만 다시 쓴다.

const root = process.cwd();
const TIERS = [
  { raw: path.join(root, "marketing", "video", "emotions-raw"), out: path.join(root, "public", "characters", "motion") },
  { raw: path.join(root, "marketing", "video", "emotions-raw-adult"), out: path.join(root, "public", "characters", "motion-adult") },
];
const manifest = path.join(root, "src", "lib", "character-motion.ts");

// --tier safe | adult 로 한쪽만 압축할 수 있다. 목록은 어느 쪽을 돌리든 두 폴더를
// 다 훑어 다시 쓴다 - public 에 있는 것이 곧 나가는 것이라, 한쪽만 보고 쓰면
// 다른 쪽이 목록에서 사라진다.
const tierArg = process.argv.includes("--tier")
  ? process.argv[process.argv.indexOf("--tier") + 1]
  : null;

for (const [index, tier] of TIERS.entries()) {
  const name = index === 0 ? "safe" : "adult";
  if (tierArg && tierArg !== name) {
    await mkdir(tier.out, { recursive: true });
    continue;
  }
  await mkdir(tier.out, { recursive: true });
  if (!existsSync(tier.raw)) continue;

  const files = (await readdir(tier.raw)).filter((name) => name.endsWith(".mp4"));
  for (const file of files) {
    const [id, emotion] = file.replace(/\.mp4$/, "").split("__");
    if (!id || !emotion) {
      console.log(`[SKIP] ${file} - 이름이 <캐릭터>__<표정>.mp4 형식이 아님`);
      continue;
    }
    const dir = path.join(tier.out, id);
    await mkdir(dir, { recursive: true });
    const output = path.join(dir, `${emotion}.mp4`);

    // 소리를 뺀다(음소거로 재생되는데 트랙만큼 무겁다). 540x720 은 배경으로 깔릴
    // 크기로 충분하고, 표정 클립은 대사마다 갈아 끼우므로 가벼운 쪽이 이긴다.
    //
    // 실패해도 멈추지 않는다. 이 스크립트는 배포 빌드에서도 돌아서(prebuild),
    // ffmpeg 이 없는 곳에서는 압축을 건너뛰고 목록만 다시 쓰면 된다.
    try {
      await run("ffmpeg", [
        "-y", "-v", "error",
        "-i", path.join(tier.raw, file),
        "-an",
        "-vf", "scale=540:720:force_original_aspect_ratio=increase,crop=540:720,fps=24",
        "-c:v", "libx264",
        "-profile:v", "main",
        "-preset", "slow",
        "-crf", "29",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        output,
      ]);
      const size = (await stat(output)).size;
      console.log(`[OK] ${path.relative(root, output)} - ${(size / 1024).toFixed(0)}KB`);
    } catch (error) {
      console.log(`[SKIP] ${file} - 압축 실패 (${String(error.message).slice(0, 80)})`);
    }
  }
}

// ── 목록 ── public 폴더에 실제로 있는 것만 등록한다. 없는 것을 켜두면 404 를
// 부르고, 있는 것을 빼두면 영영 안 나온다.
async function scan(dir) {
  if (!existsSync(dir)) return {};
  const result = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const clips = (await readdir(path.join(dir, entry.name)))
      .filter((name) => name.endsWith(".mp4"))
      .map((name) => name.replace(/\.mp4$/, ""))
      .sort();
    if (clips.length > 0) result[entry.name] = clips;
  }
  return result;
}

const safe = await scan(TIERS[0].out);
const adult = await scan(TIERS[1].out);

const render = (name, data) => {
  const lines = [`export const ${name}: Record<string, string[]> = {`];
  for (const [id, clips] of Object.entries(data)) {
    lines.push(`  ${id}: [${clips.map((clip) => `"${clip}"`).join(", ")}],`);
  }
  lines.push("};");
  return lines.join("\r\n");
};

const body = [
  "// 이 파일은 marketing/video/build-character-motion.mjs 가 생성한다. 손으로 고치지 마라.",
  "//",
  "// 어떤 캐릭터가 어떤 표정 영상을 갖고 있는지의 목록이다. 두 등급이 따로 있다.",
  "//",
  "//   safe   public/characters/motion/<캐릭터>/<표정>.mp4         누구에게나",
  "//   adult  public/characters/motion-adult/<캐릭터>/<표정>.mp4   19금을 켠 사람에게만",
  "//",
  "// 파일을 폴더에 넣고 빌드 스크립트를 돌리면 여기에 등록된다. 등급별로 폴더가",
  "// 갈려 있어서, adult 폴더를 통째로 비워도 safe 쪽은 그대로 돈다.",
  "",
  render("CHARACTER_MOTION", safe),
  "",
  render("CHARACTER_MOTION_ADULT", adult),
  "",
  "/**",
  " * 이 캐릭터의 이 표정을 어디서 틀지. 없으면 null (= 정지 이미지 그대로).",
  " *",
  " * 19금을 켠 사람에게는 adult 를 먼저 찾고, 그 표정이 adult 에 없으면 safe 로",
  " * 내려온다 - 성인 등급을 한 표정만 만들어 넣어도 나머지가 빈칸이 되지 않는다.",
  " */",
  "export function characterMotionSrc(",
  "  characterId: string,",
  "  emotion: string,",
  "  adult: boolean",
  "): string | null {",
  "  if (adult && CHARACTER_MOTION_ADULT[characterId]?.includes(emotion)) {",
  "    return `/characters/motion-adult/${characterId}/${emotion}.mp4`;",
  "  }",
  "  if (CHARACTER_MOTION[characterId]?.includes(emotion)) {",
  "    return `/characters/motion/${characterId}/${emotion}.mp4`;",
  "  }",
  "  return null;",
  "}",
  "",
  "/** 표정을 못 찾았을 때 대신 틀 것 — 같은 캐릭터의 평온 클립. */",
  "export function characterMotionFallback(characterId: string, adult: boolean): string | null {",
  '  return characterMotionSrc(characterId, "idle", adult);',
  "}",
  "",
  "export function hasAnyCharacterMotion(characterId: string, adult: boolean): boolean {",
  "  if (adult && (CHARACTER_MOTION_ADULT[characterId]?.length ?? 0) > 0) return true;",
  "  return (CHARACTER_MOTION[characterId]?.length ?? 0) > 0;",
  "}",
  "",
].join("\r\n");

await writeFile(manifest, body, "utf8");
const count = (data) => Object.values(data).reduce((sum, clips) => sum + clips.length, 0);
console.log(`\n[OK] ${path.relative(root, manifest)} - safe ${count(safe)}편 / adult ${count(adult)}편`);
