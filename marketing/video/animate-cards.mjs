import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// 상품 카드 일러스트를 "그 장면이 실제로 일어나는" 짧은 클립으로 만든다.
//
// 카드마다 움직임이 다르다. 키스하는 그림은 정말 키스로 끝나고, 이별 그림은
// 팔이 풀리며 정말 떨어진다 - 카드가 파는 감정이 곧 그 카드의 움직임이다.
// 숨결만 넣는 신당 캐릭터(animate-characters.mjs)와 다른 점이 이것이다.
//
//   node marketing/video/animate-cards.mjs                      견적만 (돈 안 씀)
//   node marketing/video/animate-cards.mjs --only sokgunghap,ibyeol --yes
//   node marketing/video/animate-cards.mjs --yes                 남은 것 전부
//   node marketing/video/animate-cards.mjs --only sseom --duration 5 --force --yes
//   node marketing/video/animate-cards.mjs --resume              이미 낸 주문만 회수
//
// 크레딧을 아끼는 방법이 이 스크립트에 네 개 박혀 있다.
//
//  1. --yes 없이는 절대 생성하지 않는다. 기본 실행은 총액만 찍고 멈춘다.
//  2. 시작 전에 잔액을 확인한다. 모자라면 한 편도 만들지 않는다 - 중간에
//     끊기면 절반은 움직이고 절반은 정지인 채로 돈만 쓴 상태가 된다.
//  3. 이미 있는 카드는 건너뛴다. 다시 돌려도 0원이다.
//  4. 주문을 넣는 즉시 job id 를 파일에 적는다. 대기 중에 창이 닫혀도
//     --resume 으로 결과만 회수한다. 다시 만들지 않는다 = 두 번 내지 않는다.
//
// 전부 3초가 기본이다. 싸고, 카드 한 장에 담길 동작은 3초면 끝난다.
// 특정 카드만 아쉬우면 그 카드만 --duration 5 --force 로 다시 뽑는 게 제일 싸다.

// Windows의 npm 전역 설치본은 .cmd 래퍼라 node가 직접 spawn하지 못한다.
const CLI_ENTRY = [
  path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@higgsfield", "cli", "bin", "higgsfield.js"),
  path.join(process.env.HOME ?? "", ".npm-global", "lib", "node_modules", "@higgsfield", "cli", "bin", "higgsfield.js"),
  "/usr/local/lib/node_modules/@higgsfield/cli/bin/higgsfield.js",
].find((candidate) => candidate && existsSync(candidate));

const cli = (argv, options = {}) =>
  CLI_ENTRY
    ? run(process.execPath, [CLI_ENTRY, ...argv], { maxBuffer: 1024 * 1024 * 16, ...options })
    : run("higgsfield", argv, { maxBuffer: 1024 * 1024 * 16, ...options });

// wan2_7 은 3:4 를 그대로 받는 모델 중 초당 단가가 제일 싸다 (1.5 크레딧/초).
// 더 싼 seedance mini 는 480p 라 화면을 꽉 채우는 히어로에서 뭉개지고,
// 3:4 를 못 받는 모델은 두 사람 구도를 한 사람 반으로 잘라 버린다.
const MODEL = "wan2_7";
const RESOLUTION = "720p";
const ASPECT = "3:4";
const DEFAULT_DURATION = 3;
// 동시에 몇 편을 물고 있을지. 계정의 동시 작업 한도(plus 기준 6) 아래로 둔다 -
// 넘기면 초과분이 rate_limit_reached 로 튕겨서 그만큼 안 만들어진다.
const POOL_SIZE = 5;

const root = process.cwd();
const imageDir = path.join(root, "public", "cards-pastel");
const outputDir = path.join(root, "marketing", "video", "cards-raw");
const jobLog = path.join(outputDir, "jobs.json");

// 모든 프롬프트에 공통으로 붙는 경계.
//
// i2v 모델은 놔두면 얼굴을 바꾸고, 고개를 돌리고, 없던 사람을 넣는다. 카드는
// 상품의 얼굴이라 인물이 달라지면 그림이 바뀐 게 아니라 상품이 바뀐 것으로 읽힌다.
// 다시 뽑는 것이 곧 다시 결제라, 경계를 세게 쓰는 편이 결국 싸다.
const GUARD = [
  "Preserve the exact faces, hairstyles, hair colour, clothing and background of the source image.",
  "Anime illustration style, same art style as the source, same colour grading.",
  "No new characters, no text, no subtitles, no watermark, no camera shake, no cuts, no zoom jumps.",
].join(" ");

// 장면마다 다른 움직임.
const CARDS = [
  {
    id: "sokgunghap",
    motion: [
      "The blonde woman in the red dress and the man in the black shirt close the last few centimetres between them",
      "and kiss on the lips - a slow, deliberate kiss that lands and holds.",
      "Her hand slides up his shoulder, his hand tightens at her waist, her eyes close as their lips meet.",
      "The candle flames behind them flicker and the red drapes breathe.",
      "Very slow camera push-in.",
    ],
  },
  {
    id: "ibyeol",
    motion: [
      "The man's arms slowly loosen and slide off the crying woman until he is no longer holding her,",
      "then he leans back and drifts out of the frame behind her, growing dim.",
      "She stays exactly where she is, alone, still holding the small photograph, which trembles in her fingers.",
      "One tear runs down her cheek and falls. The single candle flame wavers.",
      "Very slow camera push-in on her face.",
    ],
  },
  {
    id: "jaehoe",
    motion: [
      "The man behind the crying woman tightens his arms and draws her back against him, closer than before.",
      "She lets her head tip back onto his shoulder and her eyes slide shut, tears still on her cheeks.",
      "His face lowers toward her hair. Rain streams down the dark window beside them and the far lights blur.",
      "Very slow camera push-in.",
    ],
  },
  {
    id: "gyeolhon",
    // 1차 생성 실패 기록 (2026-08-22): "wider smile" + push-in 을 같이 주니
    // 카메라가 밀고 들어가 두 얼굴 이마가 잘렸고, 웃음이 입을 크게 벌린 채 눈을 감은
    // 기괴한 표정이 됐다. 웃음의 크기를 키우라고 하지 말고 "조용히" 를 못박고,
    // 프레이밍은 아예 고정한다. 시선도 반지로 내려 붙여 얼굴 클로즈업을 피한다.
    motion: [
      "The man slides the ring the rest of the way onto the woman's finger; the stone catches the light and glints once.",
      "Both of them keep looking down at the ring with a small, quiet, closed-mouth smile - they do not laugh,",
      "they do not open their mouths wide, they do not look at the camera. One tear slips quietly down her cheek.",
      "Keep the exact framing and shot size of the source image - no zoom, no push-in, no crop.",
      "The warm restaurant lights behind them glow softly.",
    ],
  },
  {
    id: "hwanseung",
    motion: [
      "The man lets go of the pink-haired woman's hand and lowers his own; her hand falls and hangs at her side.",
      "He turns away from her and takes a step off toward the neon street, his back to her.",
      "She stays still and watches him go, lips parting slightly. The neon signs flicker and the wet street reflects them.",
      "Very slow camera drift.",
    ],
  },
  {
    id: "insun",
    motion: [
      "The red thread running from the fingertips in the foreground to the waiting woman pulls taut and tugs twice, glowing brighter.",
      "The station clock's second hand ticks forward. The dark silhouette of a man behind her shifts slightly closer.",
      "The woman slowly begins to turn her head toward the shadow, as if she felt the pull.",
      "Rain still falls and the wet platform reflects the lights. Very slow camera push-in.",
    ],
  },
  {
    id: "yeonae",
    motion: [
      "The couple on the dark sofa lean into each other until their noses almost touch, breathing together,",
      "eyes half-closed, but they do not quite kiss - the moment holds.",
      "Her lace-gloved hand slides a little higher on his chest. Rose petals drift down past them,",
      "the candle flames sway and moonlight moves on the window behind them.",
    ],
  },
  {
    id: "gwontaegi",
    motion: [
      "Neither of them moves toward the other. The woman hugs her knees a little tighter and looks away;",
      "the man exhales and lets his shoulders drop, still facing the other direction.",
      "They drift a few centimetres further apart on the bed. Nobody turns their head. Nobody speaks.",
      "The cold blue light on the wall shifts slowly. Very slow camera pull-back.",
    ],
  },
  {
    id: "baramgi",
    motion: [
      "The red-haired woman tilts the phone away and the screen glows brighter on her face;",
      "a new message notification lights up on it. The man behind her lets his eyes flick down to the screen,",
      "his smile sharpening, then looks away as if he had not been looking.",
      "She glances back over her shoulder toward the camera. City lights blink behind them.",
    ],
  },
  {
    id: "sseom",
    motion: [
      "In the café she looks up at him and their eyes meet; his gaze drops to her for a beat and his blush deepens.",
      "She looks quickly away, biting back a smile, and her fingers curl on the table.",
      "He opens his mouth as if to say something and does not. Nothing else happens.",
      "Warm afternoon light and the hanging lamps glow softly behind them.",
    ],
  },
  {
    id: "jjak",
    motion: [
      "The short-haired girl peeking around the bookshelf pulls back behind it, hiding more of her face,",
      "and hugs the red book tighter against her chest, eyes still fixed on him.",
      "The smiling boy in the background keeps talking to someone off-frame and never notices her.",
      "Dust drifts in the library light. Very slow camera push-in on the girl.",
    ],
  },
  {
    id: "bimil",
    motion: [
      "The woman presses her fingertip more firmly to the man's lips, hushing him.",
      "Both of their eyes flick sideways toward the office corridor at the same moment and they freeze,",
      "then she snatches her hand back and they straighten up, pretending to look at the monitor.",
      "Fluorescent office light, nobody else appears.",
    ],
  },
  {
    id: "bamgijil",
    motion: [
      "The silver-haired woman slowly raises the white rabbit mask and holds it over the upper half of her face,",
      "then tilts it just enough to look out over its edge, her smile widening behind it.",
      "Her long hair and the black lace of her dress drift slightly. The candle flames behind her flicker.",
      "Very slow camera push-in.",
    ],
  },
  {
    id: "dohwasal",
    motion: [
      "The giant ferris wheel behind her turns slowly and its pink lights pulse one after another.",
      "She brings her fingertip to her lower lip, her eyes drifting to the camera, and gives the faintest smile.",
      "Her hair and the hem of her black dress drift; the rows of candle flames in front of her sway together.",
      "Very slow camera push-in.",
    ],
  },
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
const onlyRaw = readValue("--only");
const only = onlyRaw ? onlyRaw.split(",").map((value) => value.trim()).filter(Boolean) : null;
const durationRaw = Number.parseInt(readValue("--duration") ?? "", 10);
const duration = Number.isFinite(durationRaw) ? durationRaw : DEFAULT_DURATION;

await mkdir(outputDir, { recursive: true });

const promptFor = (card) => [...card.motion, GUARD].join(" ");
const flagsFor = (card) => [
  MODEL,
  "--prompt", promptFor(card),
  "--start-image", path.join(imageDir, `${card.id}.jpg`),
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

const download = async (id, url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`다운로드 실패 ${response.status}`);
  const file = path.join(outputDir, `${id}.mp4`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return file;
};

// 결과 JSON 모양이 명령마다 다르다. create 는 id 문자열만 담은 배열을 주고
// (["7816dc3b-..."]), wait 는 result_url 이 든 객체를 준다. 어느 쪽이 오든 첫 건을 꺼낸다.
const firstJob = (payload) =>
  Array.isArray(payload) ? payload[0] : payload?.jobs?.[0] ?? payload?.data?.[0] ?? payload;

const jobIdOf = (payload) => {
  const job = firstJob(payload);
  if (typeof job === "string") return job;
  return job?.id ?? job?.job_id ?? null;
};

const resultUrlOf = (payload) => {
  const job = firstJob(payload);
  if (typeof job === "string") return null;
  return job?.result_url ?? job?.results?.[0]?.url ?? job?.output?.url ?? null;
};

// ── --resume ── 이미 낸 주문만 회수한다. 새로 만들지 않으니 돈이 들지 않는다.
if (resumeOnly) {
  const log = readJobLog();
  const pending = Object.entries(log).filter(([id]) => force || !existsSync(path.join(outputDir, `${id}.mp4`)));
  if (pending.length === 0) {
    console.log("회수할 주문이 없습니다.");
    process.exit(0);
  }
  console.log(`주문 ${pending.length}건 회수 중… (새로 만들지 않습니다)`);
  await Promise.all(
    pending.map(async ([id, jobId]) => {
      try {
        const { stdout } = await cli(["generate", "wait", jobId, "--json", "--timeout", "20m", "--interval", "5s", "--quiet"]);
        const url = resultUrlOf(JSON.parse(stdout));
        if (!url) throw new Error("result_url 없음");
        console.log(`[OK] ${path.relative(root, await download(id, url))}`);
      } catch (error) {
        console.error(`[FAIL] ${id} - ${error.message}`);
      }
    })
  );
  process.exit(0);
}

const targets = CARDS.filter((card) => {
  if (only && !only.includes(card.id)) return false;
  if (!existsSync(path.join(imageDir, `${card.id}.jpg`))) {
    console.log(`[SKIP] ${card.id} - public/cards-pastel/${card.id}.jpg 없음`);
    return false;
  }
  // 이미 있는 것은 돈이 들지 않게 건너뛴다 (--force 로 무시)
  if (!force && existsSync(path.join(outputDir, `${card.id}.mp4`))) return false;
  return true;
});

if (targets.length === 0) {
  console.log("만들 대상이 없습니다. (이미 다 있거나 --only 가 안 맞음)");
  process.exit(0);
}

// ── 견적 ── 단가는 길이·해상도로만 정해지므로 한 번만 물어보고 곱한다.
const { stdout: costOut } = await cli(["generate", "cost", ...flagsFor(targets[0])]);
const perClip = Number.parseFloat(costOut.trim());
const total = perClip * targets.length;

let balance = null;
try {
  const { stdout } = await cli(["account", "status", "--json"]);
  const account = JSON.parse(stdout);
  const found = account?.credits ?? account?.balance ?? account?.data?.credits;
  if (typeof found === "number") balance = found;
} catch {
  // 잔액을 못 읽어도 진행은 막지 않는다. 못 읽는 것과 모자란 것은 다르다.
}

console.log(`대상 ${targets.length}편 (${duration}초, ${RESOLUTION}, ${ASPECT})`);
console.log(`  ${targets.map((card) => card.id).join(", ")}`);
console.log(`편당 ${perClip} 크레딧 -> 합계 약 ${total.toFixed(1)} 크레딧`);
if (balance !== null) console.log(`현재 잔액 ${balance} 크레딧`);

if (balance !== null && balance < total) {
  console.error(`\n[중단] 잔액이 ${(total - balance).toFixed(1)} 크레딧 모자랍니다.`);
  console.error("절반만 만들면 절반은 움직이고 절반은 정지인 채로 돈만 씁니다. 충전 후 다시 실행하세요.");
  const affordable = Math.floor(balance / perClip);
  if (affordable > 0) console.error(`나눠 하려면: --only 로 ${affordable}편씩 끊어서.`);
  process.exit(1);
}

if (!confirmed) {
  console.log("\n견적만 냈습니다. 실제로 만들려면 --yes 를 붙이세요.");
  process.exit(0);
}

// ── 주문 + 회수 ──
//
// 한 칸이 [주문 -> 대기 -> 내려받기] 를 끝까지 책임지고, 끝나야 다음 카드를 집는다.
// 계정이 동시에 돌릴 수 있는 작업 수가 정해져 있어서다 (plus 는 6개). 전부 한꺼번에
// 밀어 넣으면 한도를 넘은 것들이 rate_limit_reached 로 튕긴다 - 튕긴 주문은 과금되지
// 않지만 그만큼 안 만들어진다. 칸 수를 한도 아래로 두는 편이 결국 빠르다.
//
// job id 는 주문 직후 바로 파일에 적는다. 여기서 잃어버리면 낸 돈을 잃는다.
const log = readJobLog();
const queue = [...targets];
let done = 0;
let failed = 0;

console.log(`\n${Math.min(POOL_SIZE, queue.length)}칸으로 돌립니다. (창을 닫아도 --resume 으로 회수됩니다)`);

await Promise.all(
  Array.from({ length: Math.min(POOL_SIZE, queue.length) }, async () => {
    for (;;) {
      const card = queue.shift();
      if (!card) return;

      let jobId = null;
      try {
        const { stdout } = await cli(["generate", "create", ...flagsFor(card), "--json"]);
        jobId = jobIdOf(JSON.parse(stdout));
        if (!jobId) {
          console.error(`[WARN] ${card.id} - job id 를 못 찾음. 원본 응답:\n${stdout.slice(0, 400)}`);
          console.error("       주문은 이미 들어갔을 수 있습니다. 다시 만들지 말고 `hf generate list` 로 확인하세요.");
          failed += 1;
          continue;
        }
        log[card.id] = jobId;
        await writeFile(jobLog, JSON.stringify(log, null, 2));
        console.log(`[주문] ${card.id} -> ${jobId}`);
      } catch (error) {
        failed += 1;
        console.error(`[FAIL] ${card.id} 주문 실패 - ${String(error.message).slice(0, 160)}`);
        continue;
      }

      try {
        const { stdout } = await cli(["generate", "wait", jobId, "--json", "--timeout", "20m", "--interval", "5s", "--quiet"]);
        const url = resultUrlOf(JSON.parse(stdout));
        if (!url) throw new Error("result_url 없음");
        done += 1;
        console.log(`[OK] ${path.relative(root, await download(card.id, url))}`);
      } catch (error) {
        failed += 1;
        console.error(`[FAIL] ${card.id} - ${error.message}  (--resume 으로 다시 회수해보세요)`);
      }
    }
  })
);

console.log(`\n끝. 성공 ${done} / 실패 ${failed}`);
console.log("다음: node marketing/video/build-card-motion.mjs  (압축 + 웹에 등록)");
