import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// 프롬프트 조립기.
//
// i2v 프롬프트는 대부분이 늘 같은 뼈대다 - 누가 나오는지, 무엇을 유지해야 하는지,
// 카메라는 어떻게 두는지, 몇 초짜리인지. 매번 다시 쓰면 빠뜨리고, 빠뜨리면 얼굴이
// 바뀌거나 카메라가 밀고 들어가서 다시 뽑아야 한다. 다시 뽑는 것은 곧 다시 결제다.
//
// 그래서 뼈대는 이 스크립트가 갖고, 사람은 "무슨 일이 일어나는가" 한 줄만 쓴다.
//
//   node marketing/video/make-prompts.mjs --skeleton
//       -> actions.example.json 을 만든다. 칸마다 무엇을 써야 하는지 적혀 있다.
//
//   node marketing/video/make-prompts.mjs --actions <파일> --out <파일>
//       -> 채운 동작 줄에 뼈대를 붙여 완성된 프롬프트 JSON 을 만든다.
//
//   node marketing/video/make-prompts.mjs --actions <파일> --print hongryeon.tease
//       -> 조립 결과 한 개를 눈으로 확인한다 (파일 안 씀).
//
// 만들어진 JSON 은 그대로 animate-emotions.mjs 에 넣는다.
//
//   node marketing/video/animate-emotions.mjs --tier adult --prompts <그 파일> --yes

const root = process.cwd();

// ── 인물 ── 대명사와 배경 소품. 동작 줄에서 이걸 다시 쓸 필요가 없게 한다.
const CAST = {
  hwarin:    { name: "화린도령", female: false, motif: "burning peony blossoms and golden bells", setting: "a shrine full of firelight and red drapes" },
  hongryeon: { name: "홍련신녀", female: true,  motif: "red lotus flowers and floating lanterns", setting: "a dark pond shrine lit by lantern light" },
  mukyeon:   { name: "묵연도령", female: false, motif: "ink-dark robes and drifting incense smoke", setting: "a black shrine under a dark moon" },
  jawol:     { name: "자월신녀", female: true,  motif: "violet moonlight, mirror shards and silk sleeves", setting: "a shrine under a huge violet crescent moon" },
  geumya:    { name: "금야도령", female: false, motif: "golden lamplight and cracked gold mirrors", setting: "a black shrine hung with golden talismans" },
  maehwa:    { name: "매화아씨", female: true,  motif: "snow and red plum blossoms", setting: "a snow-covered shrine" },
  cheongsa:  { name: "청사도령", female: false, motif: "jade beads and bamboo shadows", setting: "a jade-green shrine" },
  bihwa:     { name: "비화신녀", female: true,  motif: "indigo lanterns and sealed letters", setting: "a long indigo-lit shrine" },
  haewol:    { name: "해월도령", female: false, motif: "moonlit water and pale blue silk curtains", setting: "a shrine at the water's edge under the moon" },
  yeonhwa:   { name: "연화아씨", female: true,  motif: "lotus flowers and the glowing red thread", setting: "a lotus pavilion after rain, under a rose moon" },
  jeokya:    { name: "적야도령", female: false, motif: "candles, incense smoke and camellia", setting: "a red-lit shrine full of candles" },
};

// ── 표정 ── 각 칸에 "무슨 내용을 써야 하는지". 묘사가 아니라 요구사항이다.
//
// 여기 적힌 것은 이 칸이 채워졌다고 말할 수 있는 조건이고, 실제 문장은 사람이 쓴다.
const EMOTION_SPEC = {
  idle: {
    ko: "평온",
    need: "아무 일도 일어나지 않는 상태. 숨쉬기·눈 깜빡임처럼 되돌아오는 동작 하나만. 대사 사이에 계속 깔리는 기본 클립이라 여기서 사건이 일어나면 안 된다.",
  },
  shy: {
    ko: "부끄러움",
    need: "부끄러움이 얼굴에 드러나고 시선이 카메라에서 떨어지는 흐름. 끝에 한 번 다시 쳐다보면 3초가 꽉 찬다.",
  },
  laugh: {
    ko: "웃음",
    need: "참지 못하고 터지는 웃음. 눈·어깨·손 중 최소 둘이 같이 움직여야 진짜로 보인다.",
  },
  tease: {
    ko: "유혹",
    need: "카메라를 붙잡는 쪽. 시선의 방향과 거리 변화(가까워지는지)를 반드시 명시할 것. 이 칸이 가장 세게 쓰이는 자리다.",
  },
  disgust: {
    ko: "극혐",
    need: "거부가 얼굴과 몸 양쪽에 나오는 흐름. 끝에 시선을 돌려 다시 안 보는 것으로 닫으면 명확하다.",
  },
  sulk: {
    ko: "삐짐",
    need: "화가 아니라 삐짐. 대놓고 외면하되 몰래 한 번 곁눈질하는 동작이 있어야 화와 구분된다.",
  },
  surprise: {
    ko: "놀람",
    need: "짧고 급한 반응 하나. 놀란 뒤 그대로 굳어 카메라를 보는 것으로 끝내면 다음 대사로 잇기 좋다.",
  },
  sad: {
    ko: "슬픔",
    need: "무너지지 않는 슬픔. 눈물이 흐르는지 고이기만 하는지 명시할 것 - 안 정하면 모델이 매번 다르게 만든다.",
  },
};

// ── 뼈대 ── 사람이 쓴 동작 줄 앞뒤에 항상 붙는 것들.
//
// 이 세 덩어리가 프롬프트의 대부분이고, 빠지면 결과가 무너진다.
// 카드 작업(2026-08-22)에서 실제로 겪은 것들만 남겼다.
const FRAME = {
  // 누가 나오는지. 원본 이미지를 가리켜 주지 않으면 다른 사람을 그린다.
  subject: (person) =>
    `The ${person.female ? "young woman" : "young man"} from the source image, in ${person.setting}.`,

  // 배경이 죽으면 같은 신당으로 안 보인다. 아주 조금만 움직이게 둔다.
  ambience: (person) => `The ${person.motif} around ${person.female ? "her" : "him"} shift very slightly.`,

  // 정체성 유지. 이게 없으면 얼굴·머리색·옷이 바뀐다.
  identity:
    "Preserve the exact face, hairstyle, hair colour, ornaments, costume and background of the source image. Anime illustration style, same art style and colour grading as the source.",

  // 카메라 고정. 표정 클립은 대사마다 갈아 끼우므로 프레이밍이 흔들리면 컷이 튄다.
  // 결혼 카드가 이걸 안 걸어서 얼굴 이마가 잘렸다.
  camera:
    "Keep the exact framing and shot size of the source image. The camera does not move: no zoom, no push-in, no pan, no crop, no camera shake.",

  // 금지 목록.
  negative: "No cuts, no new characters, no text, no subtitles, no watermark.",

  // 길이. 3초 안에 시작과 끝이 있어야 반복 재생될 때 어색하지 않다.
  timing: "The whole action begins and completes within three seconds.",
};

function compose(characterId, emotion, action) {
  const person = CAST[characterId];
  if (!person) throw new Error(`모르는 캐릭터: ${characterId}`);
  return [
    FRAME.subject(person),
    action.trim(),
    FRAME.ambience(person),
    FRAME.identity,
    FRAME.camera,
    FRAME.negative,
    FRAME.timing,
  ].join(" ");
}

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const readValue = (flag) => {
  const found = args.find((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (!found) return null;
  return (found.includes("=") ? found.split("=").slice(1).join("=") : args[args.indexOf(found) + 1] ?? "").trim();
};

// ── --skeleton ── 채울 틀을 만든다. 칸마다 무엇을 써야 하는지 같이 적는다.
if (has("--skeleton")) {
  const out = readValue("--out") ?? path.join("marketing", "video", "actions.example.json");
  const data = {
    "//": [
      "각 칸에 '무슨 일이 일어나는가' 를 한두 문장으로 쓴다. 영어로 쓰는 편이 결과가 안정적이다.",
      "인물·배경·그림체·카메라·길이 지시는 쓰지 않는다 - make-prompts.mjs 가 알아서 붙인다.",
      "빈 문자열로 두면 그 칸은 건너뛴다. 필요한 것만 채우면 된다.",
      "완성: node marketing/video/make-prompts.mjs --actions <이 파일> --out marketing/video/adult-prompts.json",
    ],
  };
  for (const [id, person] of Object.entries(CAST)) {
    data[id] = { "//": `${person.name} — ${person.female ? "여성" : "남성"}` };
    for (const [emotion, spec] of Object.entries(EMOTION_SPEC)) {
      data[id][`// ${emotion}`] = `[${spec.ko}] ${spec.need}`;
      data[id][emotion] = "";
    }
  }
  await writeFile(out, JSON.stringify(data, null, 2).replace(/\n/g, "\r\n") + "\r\n", "utf8");
  console.log(`[OK] ${out}`);
  console.log("칸마다 무엇을 써야 하는지 '// 표정' 줄에 적어 두었습니다. 채운 뒤 --actions 로 넘기세요.");
  process.exit(0);
}

// ── 조립 ──
const actionsFile = readValue("--actions");
if (!actionsFile) {
  console.log("사용법:");
  console.log("  node marketing/video/make-prompts.mjs --skeleton");
  console.log("  node marketing/video/make-prompts.mjs --actions <파일> --out <파일>");
  console.log("  node marketing/video/make-prompts.mjs --actions <파일> --print hongryeon.tease");
  process.exit(0);
}
if (!existsSync(actionsFile)) {
  console.error(`파일이 없습니다: ${actionsFile}`);
  console.error("먼저 --skeleton 으로 틀을 만드세요.");
  process.exit(1);
}

const actions = JSON.parse(readFileSync(actionsFile, "utf8"));

// --print 로 하나만 눈으로 확인
const printTarget = readValue("--print");
if (printTarget) {
  const [id, emotion] = printTarget.split(".");
  const action = actions?.[id]?.[emotion];
  if (!action) {
    console.error(`${printTarget} 이 비어 있습니다.`);
    process.exit(1);
  }
  console.log(compose(id, emotion, action));
  process.exit(0);
}

const out = readValue("--out") ?? path.join("marketing", "video", "adult-prompts.json");
const result = {};
const warnings = [];
let count = 0;

for (const [id, slots] of Object.entries(actions)) {
  if (id.startsWith("/")) continue;
  if (!CAST[id]) {
    warnings.push(`모르는 캐릭터라 건너뜀: ${id}`);
    continue;
  }
  for (const [emotion, action] of Object.entries(slots)) {
    if (emotion.startsWith("/")) continue;
    if (typeof action !== "string" || !action.trim()) continue;
    if (!EMOTION_SPEC[emotion]) {
      warnings.push(`모르는 표정이라 건너뜀: ${id}.${emotion}`);
      continue;
    }
    // 사람이 쓴 줄이 너무 길면 뼈대 지시가 묻힌다. 모델이 앞쪽만 보고 만든다.
    if (action.trim().length > 400) {
      warnings.push(`${id}.${emotion} - 동작 줄이 깁니다(${action.trim().length}자). 한두 문장으로 줄이면 결과가 안정적입니다.`);
    }
    (result[id] ??= {})[emotion] = compose(id, emotion, action);
    count += 1;
  }
}

if (count === 0) {
  console.error("채워진 칸이 없습니다. 동작 줄을 하나 이상 적어주세요.");
  process.exit(1);
}

await writeFile(out, JSON.stringify(result, null, 2).replace(/\n/g, "\r\n") + "\r\n", "utf8");
for (const warning of warnings) console.log(`[!] ${warning}`);
console.log(`[OK] ${out} - ${count}칸 조립`);
for (const [id, slots] of Object.entries(result)) {
  console.log(`  ${id.padEnd(11)} ${Object.keys(slots).join(", ")}`);
}
console.log(`\n다음: node marketing/video/animate-emotions.mjs --tier adult --prompts ${out}`);
console.log("      (견적만 나옵니다. 실제로 만들려면 --yes)");
