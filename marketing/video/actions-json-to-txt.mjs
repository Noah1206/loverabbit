import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";

// actions.json 을 actions.txt 로 옮긴다.
//
//   node marketing/video/actions-json-to-txt.mjs
//   node marketing/video/actions-json-to-txt.mjs --in <json> --out <txt>
//
// JSON.parse 를 쓰지 않고 줄 단위로 읽는다. 손으로 편집한 JSON 은 거의 항상
// 깨져 있기 때문이다 - 값 안에 줄바꿈이 들어가거나, 주석 열쇠의 여는 따옴표가
// 빠지거나, 마지막 쉼표가 남는다. 그런 파일도 내용은 멀쩡하므로, 문법을 탓하며
// 멈추는 대신 읽어낼 수 있는 것을 읽어낸다.
//
// 내용은 손대지 않는다. 여러 줄이면 한 줄로 합치기만 한다.

const CHARACTERS = [
  "hwarin", "hongryeon", "mukyeon", "jawol", "geumya", "maehwa",
  "cheongsa", "bihwa", "haewol", "yeonhwa", "jeokya",
];
const EMOTIONS = ["idle", "shy", "laugh", "tease", "disgust", "sulk", "surprise", "sad"];

const args = process.argv.slice(2);
const readValue = (flag) => {
  const found = args.find((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (!found) return null;
  return (found.includes("=") ? found.split("=").slice(1).join("=") : args[args.indexOf(found) + 1] ?? "").trim();
};

const inFile = readValue("--in") ?? "marketing/video/actions.json";
const outFile = readValue("--out") ?? "marketing/video/actions.txt";

const source = readFileSync(inFile, "utf8");
const lines = source.split(/\r?\n/);

// 열쇠 줄 찾기. 여는 따옴표가 빠진 것( // sulk": ), 주석 열쇠( "// sulk": )도 알아본다.
const KEY = /^\s*"?\s*(\/\/)?\s*([A-Za-z_]+)"?\s*:\s*(.*)$/;
const CHAR_BLOCK = /^\s*"([a-z_]+)"\s*:\s*\{/;

let currentCharacter = null;
const collected = [];          // [{ character, emotion, text }]
let pending = null;            // 여러 줄에 걸친 값을 모으는 중

// 문자열 값이 이 줄에서 닫혔는지. 이스케이프된 따옴표는 세지 않는다.
function closesHere(fragment) {
  let escaped = false;
  for (let i = 0; i < fragment.length; i += 1) {
    const ch = fragment[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') return i;
  }
  return -1;
}

for (const line of lines) {
  if (pending) {
    const end = closesHere(line);
    if (end === -1) {
      pending.parts.push(line.trim());
      continue;
    }
    pending.parts.push(line.slice(0, end).trim());
    collected.push({ ...pending, text: pending.parts.join(" ").replace(/\s+/g, " ").trim() });
    pending = null;
    continue;
  }

  const block = line.match(CHAR_BLOCK);
  if (block && CHARACTERS.includes(block[1])) {
    currentCharacter = block[1];
    continue;
  }

  const match = line.match(KEY);
  if (!match) continue;
  const [, isComment, key, rest] = match;
  if (isComment) continue;                       // 설명 줄은 옮기지 않는다
  if (!currentCharacter || !EMOTIONS.includes(key)) continue;

  const quote = rest.indexOf('"');
  if (quote === -1) continue;
  const body = rest.slice(quote + 1);
  const end = closesHere(body);
  if (end === -1) {
    pending = { character: currentCharacter, emotion: key, parts: [body.trim()] };
    continue;
  }
  const text = body.slice(0, end).trim();
  collected.push({ character: currentCharacter, emotion: key, text });
}

const filled = collected.filter((entry) => entry.text.length > 0);
if (filled.length === 0) {
  console.error("옮길 내용이 없습니다. 값이 전부 비어 있습니다.");
  process.exit(1);
}

// txt 로 쓴다. 채워진 칸만 옮긴다 - 빈 칸은 어차피 건너뛰므로 파일만 길어진다.
const out = [
  "# actions.json 에서 옮겨온 파일입니다.",
  "# [캐릭터.표정] 아래에 자유롭게 쓰면 됩니다. 줄바꿈·따옴표 신경 쓰지 않아도 됩니다.",
  "#",
  "# 완성: node marketing/video/make-prompts.mjs --actions marketing/video/actions.txt --out marketing/video/adult-prompts.json",
  "",
];
for (const character of CHARACTERS) {
  const mine = filled.filter((entry) => entry.character === character);
  if (mine.length === 0) continue;
  out.push(`# ─────────── ${character} ───────────`, "");
  for (const emotion of EMOTIONS) {
    const entry = mine.find((item) => item.emotion === emotion);
    if (!entry) continue;
    out.push(`[${character}.${emotion}]`, entry.text, "");
  }
}

await writeFile(outFile, out.join("\r\n") + "\r\n", "utf8");

console.log(`[OK] ${outFile} - ${filled.length}칸 옮김`);
const byCharacter = filled.reduce((acc, entry) => {
  (acc[entry.character] ??= []).push(entry.emotion);
  return acc;
}, {});
for (const [character, list] of Object.entries(byCharacter)) {
  console.log(`  ${character.padEnd(11)} ${list.join(", ")}`);
}

// 설명 문구가 값 안에 남아 있으면 알려준다. 프롬프트에 "이 칸에는 무엇을 써야 한다"
// 는 지시문이 섞이면 모델이 그것까지 연기하려 든다.
const spec = filled.filter((entry) => /^\[(평온|부끄러움|웃음|유혹|극혐|삐짐|놀람|슬픔)\]/.test(entry.text));
if (spec.length > 0) {
  console.log(`\n[!] ${spec.length}칸의 값이 설명 문구( [표정] ... )로 시작합니다.`);
  console.log("    그 부분은 지우는 편이 좋습니다 - 프롬프트에 섞이면 모델이 지시문까지 연기하려 합니다.");
}
