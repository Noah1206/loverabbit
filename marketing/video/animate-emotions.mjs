import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// 신당 캐릭터의 표정 클립을 만든다. 정지 초상 하나에서 여덟 얼굴이 나온다.
//
//   node marketing/video/animate-emotions.mjs                                견적만
//   node marketing/video/animate-emotions.mjs --only hongryeon --yes
//   node marketing/video/animate-emotions.mjs --emotions idle,shy,tease --yes
//   node marketing/video/animate-emotions.mjs --resume                       회수만
//
// 등급이 둘이다.
//
//   safe   기본. public/characters/motion/<캐릭터>/<표정>.mp4 로 간다.
//   adult  --tier adult --prompts <파일> 로 돌린다. 프롬프트를 이 스크립트가
//          갖고 있지 않고 지정한 JSON 파일에서 읽는다. 결과는
//          public/characters/motion-adult/ 로 간다.
//
// adult 프롬프트 파일 형식 (원하는 캐릭터·표정만 넣으면 된다):
//
//   {
//     "hongryeon": { "tease": "...프롬프트...", "shy": "..." },
//     "jawol":     { "idle": "..." }
//   }
//
// 등급별로 폴더가 갈려 있어서, adult 를 하나도 안 만들어도 safe 는 그대로 돈다.
// 반대로 adult 만 채워 넣어도 19금을 켠 사람에게만 그게 나간다.
//
// 크레딧은 돈이다. --yes 없이는 아무것도 만들지 않고 총액만 찍는다.

const CLI_ENTRY = [
  path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@higgsfield", "cli", "bin", "higgsfield.js"),
  path.join(process.env.HOME ?? "", ".npm-global", "lib", "node_modules", "@higgsfield", "cli", "bin", "higgsfield.js"),
  "/usr/local/lib/node_modules/@higgsfield/cli/bin/higgsfield.js",
].find((candidate) => candidate && existsSync(candidate));

const cli = (argv, options = {}) =>
  CLI_ENTRY
    ? run(process.execPath, [CLI_ENTRY, ...argv], { maxBuffer: 1024 * 1024 * 16, ...options })
    : run("higgsfield", argv, { maxBuffer: 1024 * 1024 * 16, ...options });

// 값을 바꾸지 않는 호출(견적·잔액)만 다시 시도한다. 힉스필드가 가끔 응답을
// 통째로 흘리는데, 그때마다 편 하나를 포기할 이유가 없다.
//
// generate create 는 절대 여기 태우지 않는다. "응답이 없다" 는 주문이 실패했다는
// 뜻이 아니라 결과를 못 받았다는 뜻이라, 다시 부르면 두 번 결제된다.
const cliRetry = async (argv, tries = 3) => {
  let last;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      return await cli(argv);
    } catch (error) {
      last = error;
      if (attempt < tries) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw last;
};

const MODEL = "wan2_7";
const RESOLUTION = "720p";
// 초상이 3:4 라 그대로 간다. 9:16 으로 뽑으면 좌우가 잘려 소품이 다 날아간다.
const ASPECT = "3:4";
const DEFAULT_DURATION = 3;
// 계정 동시 작업 한도(plus 6) 아래로 둔다. 넘기면 초과분이 튕긴다.
const POOL_SIZE = 5;

const root = process.cwd();
const imageDir = path.join(root, "public", "characters");

// 인물 정보 — 대명사와 소품만 다르고 연기 지시는 표정 쪽에서 온다.
const CAST = [
  { id: "hwarin", female: false, motif: "burning peony and golden bells around him" },
  { id: "hongryeon", female: true, motif: "red lotus and floating lanterns on dark water behind her" },
  { id: "mukyeon", female: false, motif: "ink-dark robes and drifting incense smoke around him" },
  { id: "jawol", female: true, motif: "violet moonlight, mirror shards and silk sleeves around her" },
  { id: "geumya", female: false, motif: "golden lamplight and cracked gold mirrors behind him" },
  { id: "maehwa", female: true, motif: "snow and red plum blossoms drifting past her" },
  { id: "cheongsa", female: false, motif: "jade beads and bamboo shadows around him" },
  { id: "bihwa", female: true, motif: "indigo lanterns and sealed letters behind her" },
  { id: "haewol", female: false, motif: "moonlit water and pale blue silk curtains around him" },
  { id: "yeonhwa", female: true, motif: "lotus pavilion, rose moon and a red thread near her" },
  { id: "jeokya", female: false, motif: "candles, incense smoke and camellia around him" },
];

// 표정. 얼굴에서 일어나는 일만 쓴다 - 자리를 옮기거나 옷이 바뀌면 같은 사람으로
// 안 보인다. 카메라도 고정이다. 대사마다 갈아 끼우는 클립이라 컷이 튀면 안 된다.
const EMOTIONS = {
  // 기본 표정이다. 홈 화면에서 상세로 들어가지 않아도 이게 돈다.
  //
  // 웃지 않는다. 신당에 앉은 사람이 처음 보는 손님에게 웃고 있으면 그 자리의
  // 무게가 사라진다 — 분위기를 잡는 것은 표정이 아니라 눈을 안 피하는 쪽이다.
  idle: (p) =>
    `${p.Subject} holds the camera's gaze quietly, with a calm and composed expression. Slow breathing, one natural blink, ${p.pos} hair drifting a few millimetres. ${p.pos_c} eyes stay open and alive the whole time, steady on the camera.`,
  shy: (p) =>
    `${p.Subject} suddenly flushes - cheeks and ears turning warm pink - and glances down and away for a moment, then looks back at the camera with a small embarrassed smile. ${p.pos_c} eyes stay soft and open.`,
  laugh: (p) =>
    `${p.Subject} bursts into a bright, warm, happy laugh, smiling wide with ${p.pos} whole face. ${p.pos_c} shoulders and upper body bounce and rock with the laughter, ${p.pos} head tipping back a little. ${p.pos_c} eyes crinkle at the corners but stay open and on the camera. A cheerful, human laugh.`,
  tease: (p) =>
    `${p.Subject} tilts ${p.pos} head, lowers ${p.pos} chin and looks up at the camera with a slow, warm, knowing smile. ${p.Subject} leans a little closer, ${p.pos} lips parting slightly. Playful and inviting, never cold.`,
  // 얼굴을 옆으로 완전히 돌려버려 표정이 안 보이던 것을 3/4 로 묶는다.
  disgust: (p) =>
    `${p.Subject} frowns and pulls back slightly, ${p.pos} brows drawing together and ${p.pos} lip curling in clear distaste. ${p.Subject} turns ${p.pos} face only partly away - staying three-quarters toward the camera so the expression is still fully visible - and shakes ${p.pos} head once. Eyes stay open.`,
  sulk: (p) =>
    `${p.Subject} pouts and looks pointedly away to the side, cheeks puffing slightly. ${p.Subject} sneaks one sideways glance back at the camera and looks away again, still sulking. Eyes stay open throughout.`,
  // 놀람이 공포로 나오던 것을 "반가운 놀람" 으로 묶는다. 어두운 배경에서
  // 눈만 크게 뜨면 겁먹은 얼굴이 되고, 그게 신당에서는 곧 귀신이 된다.
  surprise: (p) =>
    `${p.Subject} is pleasantly startled - eyes widening, eyebrows lifting, head rising a little, a small caught breath - and looks straight at the camera. Surprised and interested, not frightened, not alarmed, no fear or panic on ${p.pos} face.`,
  // 슬픔인데 웃는 얼굴로 나온 적이 있다. 웃지 않는다고 못을 박는다.
  sad: (p) =>
    `${p.Subject} lets ${p.pos} smile fade completely - ${p.pos} mouth closing, the corners turning down a little - and ${p.pos} gaze softens as ${p.Subject.toLowerCase().includes("woman") ? "she" : "he"} exhales. ${p.Subject} is not smiling at any point. ${p.pos_c} eyes glisten but stay open and on the camera. Gentle and sympathetic, never blank.`,
};

// 여성 캐릭터에는 관능적인 결을 한 겹 더 얹는다 (운영자 방향, 2026-08-22).
// 옷을 벗기는 것이 아니라 실루엣·호흡·시선으로 간다 - 몸에 붙는 비단, 숨결을 따라
// 오르내리는 가슴선, 젖은 눈. 그 편이 검열에도 걸리지 않고 오래 본다.
const FEMALE_ALLURE =
  "She is filmed as alluring: form-fitting silk that follows her figure, a deep neckline, bare shoulders and collarbones catching warm light. Her chest rises and falls visibly with each breath and her body sways softly with the movement. Bright, warm eyes and softly parted lips.";

// 유령처럼 나오는 것을 막는 줄 (2026-08-22 운영자 지적: "너무 귀신같다").
//
// 원인이 셋이었다. 프롬프트에 "젖은 눈"을 넣었고, 여러 표정이 눈을 감은 채
// 끝났고, 배경이 어두운 신당이다. 셋이 겹치면 매혹이 아니라 공포가 된다.
// 눈을 뜨게 하고, 살빛을 따뜻하게 하고, 무섭게 만들지 말라고 못을 박는다.
// 두 조각으로 나눈 이유 (2026-08-22, 2차 지적):
//
// 처음에는 "따뜻하고 호감 가는 표정" 을 모든 표정에 붙였다. 귀신은 사라졌는데
// 이번엔 질색하는 얼굴까지 웃었다. 무섭지 말라는 말이 "항상 웃어라" 로 읽힌 것이다.
// 그래서 "사람처럼 보이게" 는 전부에, "따뜻하게" 는 긍정 표정에만 붙인다.
const NOT_CREEPY =
  "Human, believable face with healthy skin tone and clear open eyes, lit softly. Not eerie, not creepy, not a ghost or spirit, no horror, no pale grey or waxy skin, no hollow or dead eyes, no blank thousand-yard stare, no eyes rolled back, no distorted, melting or twitching face.";

// 긍정 표정에만. 부정 표정에 붙이면 감정을 지워버린다.
const WARM = "Warm, appealing, inviting expression.";

// 부정 표정에만. 웃지 말라고 못 박지 않으면 위의 "사람답게" 에 끌려 웃는다.
const NOT_SMILING =
  "She or he does not smile at any point in the shot - the mouth stays closed or turned down, and the feeling is unmistakably negative, not pleasant.";

// 기본 표정에만 붙는다. 웃지도 찡그리지도 않는 자리다.
//
// WARM 을 붙이면 웃고, NOT_SMILING 을 붙이면 "감정이 분명히 부정적" 이라는 말이
// 따라와 뚱해진다. 기본은 그 둘 다 아니다 — 아무 일도 일어나지 않는데 자리를
// 지키는 얼굴이라, 웃음만 빼고 차가워지지도 않게 따로 못 박는다.
const COMPOSED =
  "Calm, composed, quietly self-possessed. She or he does not smile at any point - the mouth stays relaxed and closed - but the face is not cold, sullen or unfriendly either. The atmosphere of the scene carries the shot, not the expression.";

// idle 은 빠졌다. 아래 조립부에서 COMPOSED 를 따로 받는다.
const POSITIVE = new Set(["shy", "laugh", "tease"]);

const GUARD = [
  "Preserve the exact face, hairstyle, hair colour, ornaments, costume and background of the source image.",
  "Anime illustration style, same art style as the source, same colour grading, same framing and shot size.",
  // 표정 클립은 대사마다 갈아 끼운다. 인물 크기가 편마다 다르면 말할 때마다
  // 화면이 확 당겨졌다 물러나서, 표정이 아니라 컷이 바뀐 것처럼 보인다.
  "The subject stays exactly the same size and in the same position in the frame from the first frame to the last.",
  "The camera does not move. No zoom, no push-in, no cuts, no new characters, no text, no watermark.",
];

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const readValue = (flag) => {
  const found = args.find((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (!found) return null;
  return (found.includes("=") ? found.split("=").slice(1).join("=") : args[args.indexOf(found) + 1] ?? "").trim();
};

const confirmed = has("--yes");
const force = has("--force");
const resumeOnly = has("--resume");
const tier = readValue("--tier") === "adult" ? "adult" : "safe";
const promptFile = readValue("--prompts");
const onlyRaw = readValue("--only");
const only = onlyRaw ? onlyRaw.split(",").map((v) => v.trim()).filter(Boolean) : null;
const emotionsRaw = readValue("--emotions");
const wanted = emotionsRaw ? emotionsRaw.split(",").map((v) => v.trim()).filter(Boolean) : Object.keys(EMOTIONS);
const durationRaw = Number.parseInt(readValue("--duration") ?? "", 10);
const duration = Number.isFinite(durationRaw) ? durationRaw : DEFAULT_DURATION;

const outputDir = path.join(root, "marketing", "video", tier === "adult" ? "emotions-raw-adult" : "emotions-raw");
const jobLog = path.join(outputDir, "jobs.json");

if (tier === "adult" && !promptFile) {
  console.error("--tier adult 는 --prompts <파일> 이 필요합니다.");
  console.error("이 스크립트는 성인 등급 프롬프트를 갖고 있지 않습니다. JSON 파일로 직접 주세요.");
  console.error('형식: { "hongryeon": { "tease": "...", "shy": "..." } }');
  process.exit(1);
}

let adultPrompts = {};
if (promptFile) {
  if (!existsSync(promptFile)) {
    console.error(`프롬프트 파일이 없습니다: ${promptFile}`);
    process.exit(1);
  }
  adultPrompts = JSON.parse(readFileSync(promptFile, "utf8"));
}

await mkdir(outputDir, { recursive: true });

const pronouns = (person) =>
  person.female
    ? { Subject: "The young woman", pos: "her", pos_c: "Her" }
    : { Subject: "The young man", pos: "his", pos_c: "His" };

function promptFor(person, emotion) {
  if (tier === "adult") {
    const text = adultPrompts?.[person.id]?.[emotion];
    return typeof text === "string" && text.trim() ? text.trim() : null;
  }
  const p = pronouns(person);
  const parts = [EMOTIONS[emotion](p)];
  if (person.female) parts.push(FEMALE_ALLURE);
  parts.push(NOT_CREEPY);
  // idle 은 셋 중 어디에도 안 맞아서 따로 받는다. 웃지도, 부정적이지도 않다.
  parts.push(emotion === "idle" ? COMPOSED : POSITIVE.has(emotion) ? WARM : NOT_SMILING);
  parts.push(`The ${person.motif} shift very slightly.`);
  parts.push(...GUARD);
  return parts.join(" ");
}

// ── 대상 목록 ──
const tasks = [];
for (const person of CAST) {
  if (only && !only.includes(person.id)) continue;
  if (!existsSync(path.join(imageDir, `${person.id}.jpg`))) {
    console.log(`[SKIP] ${person.id} - public/characters/${person.id}.jpg 없음`);
    continue;
  }
  for (const emotion of wanted) {
    if (tier === "safe" && !EMOTIONS[emotion]) {
      console.log(`[SKIP] 알 수 없는 표정: ${emotion}`);
      continue;
    }
    const key = `${person.id}__${emotion}`;
    if (!force && existsSync(path.join(outputDir, `${key}.mp4`))) continue;
    const prompt = promptFor(person, emotion);
    if (!prompt) continue; // adult 파일에 없는 조합은 조용히 건너뛴다
    tasks.push({ key, id: person.id, emotion, prompt });
  }
}

const flagsFor = (task) => [
  MODEL,
  "--prompt", task.prompt,
  "--start-image", path.join(imageDir, `${task.id}.jpg`),
  "--duration", String(duration),
  "--resolution", RESOLUTION,
  "--aspect_ratio", ASPECT,
];

const readJobLog = () => {
  try {
    return JSON.parse(readFileSync(jobLog, "utf8"));
  } catch {
    return {};
  }
};

const firstJob = (payload) =>
  Array.isArray(payload) ? payload[0] : payload?.jobs?.[0] ?? payload?.data?.[0] ?? payload;
const jobIdOf = (payload) => {
  const job = firstJob(payload);
  return typeof job === "string" ? job : job?.id ?? job?.job_id ?? null;
};
const resultUrlOf = (payload) => {
  const job = firstJob(payload);
  return typeof job === "string" ? null : job?.result_url ?? job?.results?.[0]?.url ?? null;
};

const download = async (key, url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`다운로드 실패 ${response.status}`);
  const file = path.join(outputDir, `${key}.mp4`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return file;
};

// ── --resume ── 이미 낸 주문만 회수한다. 새로 만들지 않으니 돈이 안 든다.
if (resumeOnly) {
  const log = readJobLog();
  const pending = Object.entries(log).filter(([key]) => force || !existsSync(path.join(outputDir, `${key}.mp4`)));
  if (pending.length === 0) {
    console.log("회수할 주문이 없습니다.");
    process.exit(0);
  }
  console.log(`주문 ${pending.length}건 회수 중… (새로 만들지 않습니다)`);
  await Promise.all(
    pending.map(async ([key, jobId]) => {
      try {
        const { stdout } = await cli(["generate", "wait", jobId, "--json", "--timeout", "20m", "--interval", "5s", "--quiet"]);
        const url = resultUrlOf(JSON.parse(stdout));
        if (!url) throw new Error("result_url 없음");
        console.log(`[OK] ${path.relative(root, await download(key, url))}`);
      } catch (error) {
        console.error(`[FAIL] ${key} - ${error.message}`);
      }
    })
  );
  process.exit(0);
}

if (tasks.length === 0) {
  console.log("만들 대상이 없습니다. (이미 다 있거나 조건이 안 맞음)");
  process.exit(0);
}

// ── 견적 ──
let perClip = 0;
try {
  const { stdout: costOut } = await cliRetry(["generate", "cost", ...flagsFor(tasks[0])]);
  perClip = Number.parseFloat(costOut.trim());
} catch (error) {
  // 견적 호출은 시작 이미지를 올려보므로, 업로드가 죽으면 여기서 먼저 걸린다.
  // 통째로 뻗지 말고 무엇이 막혔는지 한 줄로 알려준다 - 이 상태로는 생성도 안 된다.
  const detail = String(error.stderr ?? error.message ?? "").trim().slice(0, 200);
  console.error("[중단] 힉스필드에 견적을 물어보지 못했습니다.");
  console.error(detail || "(원인 불명)");
  console.error("");
  console.error("업로드/네트워크 문제일 때가 많습니다. 아래로 확인해보세요:");
  console.error("  higgsfield upload create public/characters/hongryeon.jpg");
  console.error("이것도 실패하면 힉스필드 쪽 문제입니다. 잠시 뒤 다시 시도하세요.");
  process.exit(1);
}
const total = perClip * tasks.length;

let balance = null;
try {
  const { stdout } = await cliRetry(["account", "status", "--json"]);
  const account = JSON.parse(stdout);
  const found = account?.credits ?? account?.balance ?? account?.data?.credits;
  if (typeof found === "number") balance = found;
} catch {
  // 못 읽는 것과 모자란 것은 다르다. 못 읽었다고 막지는 않는다.
}

console.log(`등급 ${tier} / 대상 ${tasks.length}편 (${duration}초, ${RESOLUTION}, ${ASPECT})`);
const byCharacter = tasks.reduce((acc, task) => {
  (acc[task.id] ??= []).push(task.emotion);
  return acc;
}, {});
for (const [id, list] of Object.entries(byCharacter)) console.log(`  ${id.padEnd(11)} ${list.join(", ")}`);
console.log(`편당 ${perClip} 크레딧 -> 합계 약 ${total.toFixed(1)} 크레딧`);
if (balance !== null) console.log(`현재 잔액 ${balance} 크레딧`);

if (balance !== null && balance < total) {
  console.error(`\n[중단] 잔액이 ${(total - balance).toFixed(1)} 크레딧 모자랍니다.`);
  console.error("--only 나 --emotions 로 범위를 좁혀 나눠 돌리세요.");
  process.exit(1);
}

if (!confirmed) {
  console.log("\n견적만 냈습니다. 실제로 만들려면 --yes 를 붙이세요.");
  process.exit(0);
}

// ── 주문 + 회수 ── 한 칸이 [주문 -> 대기 -> 내려받기] 를 끝까지 책임진다.
const log = readJobLog();
const queue = [...tasks];
let done = 0;
let failed = 0;

console.log(`\n${Math.min(POOL_SIZE, queue.length)}칸으로 돌립니다. (창을 닫아도 --resume 으로 회수됩니다)`);

await Promise.all(
  Array.from({ length: Math.min(POOL_SIZE, queue.length) }, async () => {
    for (;;) {
      const task = queue.shift();
      if (!task) return;

      let jobId = null;
      try {
        const { stdout } = await cli(["generate", "create", ...flagsFor(task), "--json"]);
        jobId = jobIdOf(JSON.parse(stdout));
        if (!jobId) {
          failed += 1;
          console.error(`[WARN] ${task.key} - job id 를 못 찾음. 다시 만들지 말고 \`hf generate list\` 로 확인하세요.`);
          continue;
        }
        log[task.key] = jobId;
        await writeFile(jobLog, JSON.stringify(log, null, 2));
        console.log(`[주문] ${task.key}`);
      } catch (error) {
        failed += 1;
        console.error(`[FAIL] ${task.key} 주문 실패 - ${String(error.message).slice(0, 140)}`);
        continue;
      }

      try {
        const { stdout } = await cli(["generate", "wait", jobId, "--json", "--timeout", "20m", "--interval", "5s", "--quiet"]);
        const url = resultUrlOf(JSON.parse(stdout));
        if (!url) throw new Error("result_url 없음");
        done += 1;
        console.log(`[OK] ${path.relative(root, await download(task.key, url))}`);
      } catch (error) {
        failed += 1;
        console.error(`[FAIL] ${task.key} - ${error.message}  (--resume 으로 회수해보세요)`);
      }
    }
  })
);

console.log(`\n끝. 성공 ${done} / 실패 ${failed}`);
console.log("다음: node marketing/video/build-character-motion.mjs  (압축 + 웹에 등록)");
