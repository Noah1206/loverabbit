import { readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

// 사전 제작 에셋을 웹에 낼 무게로 줄인다.
//
// 원본 PNG 는 장당 1MB 에 가깝다. 리딩 한 건이 장면 5장 + 부적 1장을 띄우므로
// 그대로 내보내면 6MB 다. 모바일에서 그림 여섯 장 보자고 데이터를 통째로 태우는 셈이다.
//
// 원본은 지우지 않는다. 지시문의 완료 기준이 "브라우저에서 PNG 를 직접 열 수 있다"
// 이고, 나중에 다시 뽑을 때 기준이 되는 것도 원본이다. 화면에 나가는 것만 webp 로 둔다.
//
//   node scripts/optimize-love-rabbit-assets.mjs

const root = process.cwd();
const base = path.join(root, "public", "assets", "love-rabbit");
const report = [];

for (const kind of ["scenes", "talismans"]) {
  const dir = path.join(base, kind);
  if (!existsSync(dir)) continue;
  for (const name of (await readdir(dir)).filter((f) => f.endsWith(".png"))) {
    const input = path.join(dir, name);
    const output = input.replace(/\.png$/, ".webp");
    // quality 82 는 이 화풍(평면 셀 채색)에서 눈에 띄는 손실 없이 8~10배가 준다.
    await sharp(input).webp({ quality: 82, effort: 5 }).toFile(output);
    const before = (await stat(input)).size;
    const after = (await stat(output)).size;
    report.push({ name, before, after });
  }
}

const sum = (key) => report.reduce((total, row) => total + row[key], 0);
console.log(`${report.length}장 변환`);
console.log(`원본 ${(sum("before") / 1024 / 1024).toFixed(1)}MB -> webp ${(sum("after") / 1024 / 1024).toFixed(1)}MB`);
const worst = [...report].sort((a, b) => b.after - a.after)[0];
if (worst) console.log(`가장 큰 것: ${worst.name} ${(worst.after / 1024).toFixed(0)}KB`);

await writeFile(
  path.join(base, "OPTIMIZED.txt"),
  [
    "원본 PNG 와 화면용 WebP 가 같이 있습니다.",
    "",
    "  scenes/<이름>.png   원본 (1024x1024) - 다시 뽑을 때의 기준",
    "  scenes/<이름>.webp  화면에 나가는 것",
    "",
    "매니페스트의 path 는 .png 를 가리키고, 선택기가 화면에 낼 때 .webp 로 바꿉니다.",
    "새 에셋을 넣은 뒤에는 다시 돌리세요:",
    "  node scripts/optimize-love-rabbit-assets.mjs",
    "",
  ].join("\r\n"),
  "utf8"
);
