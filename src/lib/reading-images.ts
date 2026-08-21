// 장마다 한 장씩 들어가는 그림.
//
// 왜 비동기인가: 한 장에 60초가 걸린다(실측). 리딩 본문이 42초니까 그림을 기다리면
// 읽기 시작하는 시각이 세 배가 된다. 그래서 **글이 먼저 나가고 그림은 뒤따라 채워진다.**
// 이미 읽고 지나간 장의 그림은 다음에 열 때 보인다. 그림이 끝내 실패해도 리딩은
// 온전하다 — 그림은 덤이지 본문이 아니다.
//
// 왜 프롬프트를 따로 쓰게 하는가: 본문을 쓴 모델이 그 장이 무슨 이야기인지 가장 잘 안다.
// 다만 본문 응답에 끼워 넣으면 절마다 하나씩 나와 장 단위로 묶기 어렵고, 실패했을 때
// 본문까지 다시 만들어야 한다. 그래서 본문이 끝난 뒤 한 번만 따로 부른다.
//
// 무엇을 그리지 않는가 — 이 부분이 이 파일에서 제일 중요하다.
//   · 알아볼 수 있는 사람. 얼굴을 그리지 않는다. 사용자도, 그 상대도 실존 인물이다.
//   · 글자·로고·상표.
//   · 선정적이거나 폭력적인 장면.
//   · 사주 도표, 부적, 점집 소품 — 이건 사주 풀이지 무속 연출이 아니다.

import { chatComplete } from "@/lib/ai";

/** 그림 한 장의 상태. 화면은 이 값만 보고 그린다. */
export type ReadingImageStatus = "pending" | "ready" | "failed";

/**
 * 부적이 앉는 자리. 장 번호와 겹치지 않게 0 을 쓴다 —
 * 장은 1부터 세므로 0 은 비어 있고, 배열 하나로 같이 다닐 수 있다.
 */
export const TALISMAN_SLOT = 0;

export interface ReadingImage {
  /** 몇 번째 장인가. 뷰어의 장 번호와 같다. 0 이면 부적이다. */
  chapter: number;
  status: ReadingImageStatus;
  /** 완성된 그림 주소. pending·failed 면 없다. */
  url?: string;
  /** 화면 낭독기가 읽을 설명 */
  alt?: string;
}

/** 그림을 부탁할 때 넘기는 한 장의 재료 */
export interface ChapterBrief {
  chapter: number;
  title: string;
  /** 그 장 첫 절의 요약 — 무슨 이야기인지 알기에 이만큼이면 충분하다 */
  gist: string;
}

const IMAGE_MODEL = "gpt-image-2";
const IMAGE_SIZE = "1024x1024";
/** 부적은 저장해서 볼 물건이라 세로로 뽑는다 */
const TALISMAN_SIZE = "1024x1536";
const IMAGE_QUALITY = "medium";

/**
 * 그림 프롬프트를 쓰는 규칙.
 *
 * 사람을 그리지 말라는 지시를 두 번 적는다. 한 번만 적으면 "뒷모습이니까 괜찮겠지"
 * 같은 판단이 끼어들고, 그 판단은 사용자의 실제 연인을 그리는 데까지 간다.
 */
const PROMPT_SYSTEM = `너는 사주 리포트에 들어갈 삽화의 '장면 지시문'을 쓴다.
그림 자체를 그리는 게 아니라, 그림 모델에게 줄 한국어 지시문을 쓴다.

# 무엇을 그리는가
- 그 장의 감정이 **머무는 자리**를 그린다. 사건이 아니라 공기다.
- 사용자가 적은 고민과 하는 일이 주어지면 그 사람의 하루에서 배경을 고른다.
  (3교대 간호사 -> 새벽 정류장 / 취업 준비 중 -> 늦은 밤 책상)
- 한국의 장소로 그린다. 골목, 정류장, 편의점 앞, 지하철, 아파트 복도, 카페 창가.

# 무엇을 그리지 않는가 — 어기면 폐기된다
- **사람의 얼굴을 그리지 않는다.** 실루엣이나 뒷모습도 화면에서 작게만 둔다.
  사용자와 그 상대는 실존 인물이고, 그 사람을 그릴 권한이 우리에게 없다.
- 두 사람이 함께 있는 장면을 그리지 않는다. 관계를 그림으로 확정하는 것과 같다.
- 글자, 숫자, 간판, 로고, 상표를 넣지 않는다.
- 선정적이거나 폭력적인 것, 술·담배, 사주 도표·부적·점집 소품을 넣지 않는다.
- 눈물, 쓰러진 사람, 병실처럼 고통을 직접 그리지 않는다. 빈자리로 대신한다.

# 어떻게 쓰는가
- **한국어 두 문장, 160자 이내.** 길면 그림이 산만해진다.
- 장소 / 시간대와 빛 / 눈에 걸리는 사물 하나. 이 셋이면 충분하다.
- **그림체는 적지 않는다.** 그건 서버가 모든 장에 똑같이 붙인다.
  "일러스트", "수채화", "사진처럼" 같은 말을 쓰면 다섯 장이 서로 다른 그림이 된다.
  너는 **무엇이 보이는지**만 쓴다.

# 출력
{"prompts":[{"chapter":1,"prompt":"...","alt":"..."}]}
- chapter 는 받은 번호를 그대로 적는다. 빠뜨리지 않는다.
- alt 는 화면 낭독기가 읽을 한 줄이다. 40자 이내로 무엇이 보이는지만 적는다.
- JSON 하나만 출력한다.`;

/** 그림 지시문이 지켜야 하는 선 — 모델이 어겨도 여기서 한 번 더 막는다 */
const BANNED = [
  /얼굴|표정|이목구비|초상/,
  /두 사람|커플|연인이 함께|마주 (앉|보)/,
  /간판|로고|상표|글씨|문구/,
  /부적|점집|신당|사주 ?(도표|판)/,
  /눈물|우는|쓰러|병실|피\b/,
];

/**
 * 그림체 — 여기서 한 번만 정하고 모든 장에 똑같이 붙인다.
 *
 * 장마다 모델이 알아서 결을 고르게 두면 다섯 장이 다 다른 그림이 된다. 한 리딩 안에서
 * 수채화 한 장, 사진 한 장, 유화 한 장이 나오면 그건 화집이지 한 편의 글이 아니다.
 * **장면만 장마다 다르고 그림체는 고정이다.**
 *
 * 결은 한국 웹툰이다. 매끄러운 디지털 채색, 어두운 화면에 푸른 발광이 가장자리를 훑고,
 * 배경은 채도를 낮춰 깔고 한 곳만 밝게 남긴다. 앱 자체가 검은 화면이라 이 결이 화면에
 * 그대로 이어 붙는다.
 */
const ART_STYLE =
  " 그림체는 한국 웹툰의 디지털 채색이다. 매끄럽게 칠한 반사실적 작화," +
  " 어두운 화면에 푸른빛 림라이트와 은은한 네온이 가장자리를 훑고," +
  " 배경은 채도를 낮춰 깔되 한 곳만 밝게 남긴다." +
  " 시네마틱한 구도, 얕은 심도, 미세한 빛 입자. 매트한 질감, 거친 붓자국 없이 깔끔하게." +
  " 사진이 아니다. 수채화나 유화 느낌도 아니다.";

/** 어떤 지시문이든 마지막에 덧붙이는 안전선. 모델의 선의에 기대지 않는다. */
const HARD_RULES =
  " 사람의 얼굴은 보이지 않는다. 인물이 있다면 화면에서 아주 작게, 뒷모습으로만 둔다." +
  " 글자, 숫자, 간판, 로고를 넣지 않는다." +
  ART_STYLE;

/**
 * 한 리딩에 그리는 그림의 최대 장수.
 *
 * 목차를 잘게 묶으면서 장이 4개에서 9개로 늘었다. "장마다 한 장" 을 그대로 지키면
 * 그림 값이 $0.35 에서 $0.70 으로 뛴다. 글이 늘어난 게 아니라 나누는 단위가
 * 달라졌을 뿐인데 값이 두 배가 되는 건 맞지 않는다.
 *
 * 그래서 장수를 고정하고 **고르게 흩는다.** 장이 적은 상품은 장마다 한 장씩 그대로,
 * 많은 상품은 한 장 걸러 하나씩 들어간다.
 */
export const MAX_IMAGES = 5;

/**
 * 어느 장에 그림을 넣을지 고른다. 첫 장에는 반드시 넣는다 —
 * 읽기 시작하는 자리에 하나도 없으면 이 리딩에 그림이 있다는 걸 모른다.
 */
export function pickIllustrated<T extends { chapter: number }>(chapters: T[], max = MAX_IMAGES): T[] {
  if (chapters.length <= max) return chapters;
  const step = chapters.length / max;
  const picked: T[] = [];
  for (let i = 0; i < max; i += 1) picked.push(chapters[Math.floor(i * step)]);
  return picked;
}

export interface ImagePrompt {
  chapter: number;
  prompt: string;
  alt: string;
}

function parsePrompts(text: string, chapters: ChapterBrief[]): ImagePrompt[] {
  const attempts = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) attempts.push(fenced[1].trim());
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (braced.length > 2) attempts.push(braced);

  for (const candidate of attempts) {
    let raw: { prompts?: unknown };
    try {
      raw = JSON.parse(candidate) as { prompts?: unknown };
    } catch {
      continue;
    }
    if (!Array.isArray(raw.prompts)) continue;
    const known = new Set(chapters.map((c) => c.chapter));
    const out = (raw.prompts as Record<string, unknown>[])
      .map((row) => ({
        chapter: Number(row.chapter),
        prompt: typeof row.prompt === "string" ? row.prompt.trim() : "",
        alt: typeof row.alt === "string" ? row.alt.trim() : "",
      }))
      .filter((row) => known.has(row.chapter) && row.prompt.length > 0)
      // 선을 넘은 지시문은 그림을 그리지 않는다. 한 장 없는 편이 낫다.
      .filter((row) => !BANNED.some((pattern) => pattern.test(row.prompt)));
    if (out.length > 0) return out;
  }
  return [];
}

/**
 * 장마다 그림 지시문 하나씩. 실패하면 빈 배열 — 그림 없이 리딩이 나간다.
 */
export async function writeImagePrompts(
  chapters: ChapterBrief[],
  context: { occupation?: string; question?: string }
): Promise<ImagePrompt[]> {
  if (chapters.length === 0) return [];
  const user = [
    context.occupation ? `하는 일: ${context.occupation}` : null,
    context.question ? `지금 고민: ${context.question}` : null,
    "",
    "장 목록:",
    ...chapters.map((c) => `${c.chapter}. ${c.title} — ${c.gist.slice(0, 160)}`),
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    const result = await chatComplete(PROMPT_SYSTEM, [{ role: "user", content: user }], 1200, {
      thinking: false,
      json: true,
    });
    if (!result?.text) return [];
    return parsePrompts(result.text, chapters);
  } catch (e) {
    console.warn("그림 지시문 생성 실패:", String(e).slice(0, 200));
    return [];
  }
}

/**
 * 그림 한 장. 실패하면 null — 부르는 쪽이 failed 로 기록하고 넘어간다.
 * 그림 하나가 안 나왔다고 리딩을 막지 않는다.
 */
export async function renderImage(prompt: string, kind: "scene" | "talisman" = "scene"): Promise<Buffer | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  // 부적은 지시문이 이미 완성돼 있다(reading-talisman.ts). 장면용 그림체를 덧붙이면
  // 한지 부적에 네온 림라이트가 얹혀 부적처럼 보이지 않는다.
  const talisman = kind === "talisman";
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: talisman ? prompt : `${prompt}${HARD_RULES}`,
        size: talisman ? TALISMAN_SIZE : IMAGE_SIZE,
        quality: IMAGE_QUALITY,
        n: 1,
      }),
    });
    if (!res.ok) {
      console.warn("그림 생성 실패:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    return b64 ? Buffer.from(b64, "base64") : null;
  } catch (e) {
    console.warn("그림 생성 중 오류:", String(e).slice(0, 200));
    return null;
  }
}

/** 테스트에서만 쓴다 — 거르는 규칙이 실제로 거르는지 봐야 한다 */
export const __test = { parsePrompts, BANNED };
