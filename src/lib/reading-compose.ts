// 리포트를 장(章) 단위로 나눠 동시에 생성한다.
//
// 왜 나누는가:
//   한 번에 다 시키면 목차 10개짜리 리포트가 gpt-5.6에서 128초 걸린다(실측).
//   병목은 추론이 아니라 출력 길이다 — 추론 토큰은 100개 남짓인데 본문이 14,000자다.
//   토큰은 순서대로 나오므로 한 요청 안에서는 줄일 방법이 없다. 대신 장마다 따로
//   요청해 동시에 던지면 벽시계 시간이 "가장 느린 장 하나"로 줄어든다.
//
// 무엇을 나누는가:
//   머리(headline·요약카드·행동질문·화자 한마디) 1개 + 장 N개.
//   모든 요청이 같은 saju_facts와 matched_rules를 받으므로 근거는 어긋나지 않고,
//   전체 목차를 함께 줘서 옆 장이 무엇을 다루는지 알고 쓰게 한다.
//
// 무엇을 잃는가:
//   입력 토큰이 (장 수 + 1)배로 늘고, 장 사이의 문맥 연결이 한 번에 쓸 때보다 느슨하다.
//   대신 한 장이 실패해도 그 장만 다시 시키면 된다.

import { normalizeEmotionTags } from "@/lib/reading-asset-selector";
import { sumUsage, type ChatUsage } from "@/lib/ai";
import { extraPlanFor, parseExtra } from "@/lib/reading-extra";
import { chapterNumbersFromToc } from "@/lib/reading-chapters";
import {
  buildReadingInput,
  seasonBrief,
  parseStructuredReport,
  READING_SYSTEM_PROMPT,
  type ReadingInput,
  type ReportSectionOut,
  type StructuredReport,
} from "@/lib/reading-prompt";

/** 모델 호출부. 테스트에서 갈아끼울 수 있도록 주입받는다. */
export type Complete = (
  system: string,
  user: string,
  maxTokens: number
) => Promise<{ text: string; provider: string; model?: string; usage?: ChatUsage | null } | null>;

/** 조각 하나가 걸린 시간. 전체 시간은 이 중 가장 큰 값이 정한다. */
export interface PartTiming {
  label: string;
  ms: number;
  ok: boolean;
  /** 재시도로 다시 부른 조각인가 */
  retry: boolean;
}

export interface ComposeResult {
  /** 머리를 만든 경우에만 채워진다. 이어 만들기(composeRest)에서는 항상 null이다. */
  report: StructuredReport | null;
  /** 이번 호출이 만든 절. 이어 만들 때는 이것만 쓴다. */
  sections: ReportSectionOut[];
  provider: string;
  /** 생성기가 붙어 있는데도 실패한 조각들 */
  failedParts: string[];
  /** 실제로 응답한 모델 이름 (조각마다 같다) */
  model: string;
  /** 조각별 소요 시간 — 어느 조각이 병목인지 보려면 이게 필요하다 */
  timings: PartTiming[];
  /** 조각 전체를 합친 실제 청구 토큰. 제공사가 안 주면 전부 0이다. */
  usage: ChatUsage;
  requestCount: number;
  retryCount: number;
}

/**
 * 한 번의 요청이 맡는 묶음. 장 경계를 따르되, 항목이 한둘뿐인 장은 옆 장과 합친다.
 * 990원 입문 리포트는 목차 5개가 각각 한 장이라, 그대로 두면 요청이 6개가 된다.
 * 요청 하나가 왕복 대기를 통째로 물기 때문에 잘게 쪼갤수록 오히려 느려진다.
 */
interface Batch {
  /** 프롬프트에 쓸 이름 — "2장" 또는 합쳐졌으면 "1~2장" */
  label: string;
  /** 이 묶음이 맡은 목차 항목 (원래 순서 그대로) */
  items: string[];
}

/**
 * 한 요청이 맡는 항목 수.
 *
 * 전체 시간은 "가장 큰 묶음 하나"가 정한다. 묶음을 작게 할수록 빨라지지만
 * 동시 요청과 입력 토큰이 늘고 문맥이 더 잘게 끊긴다. 3이 그 사이의 타협점이고,
 * 배포에서 재보고 조정할 수 있게 환경변수로 뺀다.
 */
/** 재시도 전에 쉬는 시간 — 속도 제한에 걸린 조각이 같은 벽에 다시 부딪히지 않게 한다 */
const RETRY_DELAY_MS = 1200;

/**
 * 결제 전 화면이 실제로 보여주는 절 수 (/api/reading의 preview).
 * 첫 절은 읽히고 둘째 절은 흐려지며 끊긴다. 그 뒤는 제목만 목차에 남으므로
 * 결제 전에 만들 이유가 없다.
 *
 * **원가의 아홉 할이 여기서 나간다.** 결제하지 않는 사람에게도 이만큼은 만들어
 * 주기 때문이다. 광고에서 들어온 사람은 표지에서 끊기므로 첫 절의 두 문장만 본다 —
 * 그 길만 보면 1로도 충분하다.
 *
 *   READING_PREVIEW_SECTIONS=1
 *
 * **켜고 끄는 시점에 주의한다.** 이 값이 묶음 경계를 정하고, 결제 뒤 이어 만들 때
 * 그 경계로 "어디까지 만들었는지"를 센다. 미리보기를 2로 만들어 두고 1로 바꾸면
 * 이어 만들기가 절을 건너뛴다. 만들다 만 리딩이 없을 때 바꾼다.
 */
export function previewSections(): number {
  const raw = Number(process.env.READING_PREVIEW_SECTIONS);
  if (!Number.isInteger(raw) || raw < 1 || raw > 4) return 2;
  return raw;
}

/** 예전 이름. 상수처럼 쓰던 자리가 있어 남겨 둔다 — 값은 위 함수가 정한다. */
export const PREVIEW_SECTIONS = previewSections();

/** 미리보기 절 수를 채우는 데 필요한 묶음 수 */
export function previewBatchCount(outline: string[]): number {
  const batches = chaptersOf(outline);
  let items = 0;
  for (let i = 0; i < batches.length; i += 1) {
    items += batches[i].items.length;
    if (items >= PREVIEW_SECTIONS) return i + 1;
  }
  return batches.length;
}

function batchSize(): number {
  const raw = Number(process.env.READING_BATCH_SIZE);
  return Number.isInteger(raw) && raw >= 1 && raw <= 8 ? raw : 3;
}

/**
 * 목차를 요청 단위로 자른다.
 *
 * 장 경계에 맞추지 않는다 — 독자가 보는 장은 뷰어가 제목에서 다시 세우므로
 * (reading-chapters.ts), 여기서는 오직 시간만 보고 고르게 자르면 된다.
 * 라벨은 그 묶음이 걸친 장을 알려주기 위한 표시일 뿐이다.
 */
export function chaptersOf(outline: string[]): Batch[] {
  const numbers = chapterNumbersFromToc(outline);
  const batches: Batch[] = [];
  let cursor = 0;

  const push = (take: number, index: number) => {
    const items = outline.slice(cursor, cursor + take);
    if (items.length === 0) return;
    const chapters = numbers.slice(cursor, cursor + take);
    const from = chapters[0] ?? index + 1;
    const to = chapters[chapters.length - 1] ?? from;
    batches.push({ label: from === to ? `${from}장` : `${from}~${to}장`, items });
    cursor += take;
  };

  /*
    첫 묶음은 미리보기 몫에 딱 맞춘다.

    예전에는 목차를 고르게 잘랐고(12절 -> 3/3/3/3), 미리보기는 그중 첫 묶음을
    통째로 만들었다. 그런데 결제 전에 보여 주는 절은 둘뿐이다. 셋을 만들어 하나를
    버린 셈이고, 그 하나는 **결제하지 않는 사람에게도** 매번 만들어졌다.
    광고 유입처럼 전환이 낮은 길에서는 그 낭비가 클릭 수만큼 곱해진다.

    첫 묶음만 떼어 내고 나머지는 예전처럼 고르게 나눈다. 자르는 자리는 목차만
    보고 정해지므로, 결제 뒤 이어 만들 때도 같은 경계가 나온다 — 경계가 달라지면
    이미 만든 절을 다시 만들거나 건너뛴다.
  */
  push(Math.min(previewSections(), outline.length), 0);

  const rest = outline.length - cursor;
  if (rest > 0) {
    const size = batchSize();
    const count = Math.max(1, Math.ceil(rest / size));
    // 마지막 묶음만 홀로 작아지지 않도록 고르게 나눈다 (10개를 3으로 자르면 4/3/3)
    const base = Math.floor(rest / count);
    const extra = rest % count;
    for (let i = 0; i < count; i += 1) push(base + (i < extra ? 1 : 0), i + 1);
  }

  return batches;
}

/** 목차 항목의 앞머리 번호만 남긴 짧은 목록 — 옆 조각과 겹치지 않게 하는 용도 */
function outlineBrief(outline: string[], mine: string[]): string {
  const owned = new Set(mine);
  const others = outline.filter((item) => !owned.has(item));
  if (others.length === 0) return "";
  return `\n다른 조각이 맡은 항목(겹치게 쓰지 않기 위한 참고, 여기서 쓰지 않는다):\n${others.join(" / ")}\n`;
}

/*
  입력 JSON 을 맨 앞에 둔다.

  프롬프트 캐시는 **앞에서부터 같은 만큼**만 먹는다. 예전에는 조각마다 달라지는
  지시문이 먼저 오고 입력 JSON 이 뒤에 붙었다. 그러면 캐시가 시스템 프롬프트에서
  끊기고, 조각마다 똑같은 5,000자짜리 JSON 이 매번 새 값으로 청구된다.

  순서만 바꾸면 시스템 프롬프트 + 입력 JSON 까지가 한 덩어리로 캐시에 얹힌다.
  모델이 읽는 내용은 한 글자도 안 바뀐다.
*/
function headPrompt(inputJson: string, outline: string[]): string {
  return `입력:
${inputJson}

지시: 머리. 리포트 전체가 다룰 내용은 아래와 같고, 본문은 다른 조각이 쓴다.
${outline.join(" / ")}`;
}

function chapterPrompt(
  inputJson: string,
  chapter: Batch,
  outline: string[],
  season: string,
  /** 가드가 잡은 지적. 다시 쓸 때만 붙는다 */
  notes: string[] = []
): string {
  // 어떤 모양(extra)을 얹을지는 서버가 정해서 알려준다. 묶음마다 따로 생성되므로
  // 모델에게 고르라고 맡기면 옆 묶음이 뭘 골랐는지 몰라 결국 한 가지로 몰린다.
  const shape = (item: string) => {
    const kind = extraPlanFor(outline.indexOf(item));
    return kind ? ` [extra: ${kind}]` : " [extra 없이]";
  };
  // 입력 JSON 이 먼저다 — 캐시가 여기까지 먹는다(headPrompt 위 주석).
  return `입력:
${inputJson}

지시: 본문 ${chapter.items.length}개. 아래 항목을 하나씩 빠짐없이 쓰고, 각 절의 n에 그 번호를 적는다.
대괄호 안의 extra 지정을 그대로 따른다.
${chapter.items.map((item, i) => `${i + 1}. ${item}${shape(item)}`).join("\n")}
${season ? `${season}\n` : ""}${notes.length ? `${rewriteBrief(notes)}\n` : ""}${outlineBrief(outline, chapter.items)}`;
}

/**
 * 다시 쓰라고 할 때 붙이는 줄.
 *
 * 무엇이 걸렸는지만 말하고 무엇을 쓰라고는 말하지 않는다. 고쳐 쓸 문장을 여기서
 * 불러 주면 그건 규칙이 아니라 서버가 지어낸 말이 되고, 가드를 통과시키려고
 * 가드를 우회하는 꼴이 된다.
 */
function rewriteBrief(notes: string[]): string {
  return [
    "앞서 쓴 글이 아래에서 걸렸다. 같은 항목을 처음부터 다시 쓰되 이 지적을 피한다.",
    ...notes.map((note) => `- ${note}`),
  ].join("\n");
}

/**
 * 장 응답에서 섹션만 꺼낸다. 머리 스키마가 아니므로 파서를 직접 쓸 수 없다.
 *
 * 제목은 모델이 쓰지 않는다. 목차 문구를 그대로 옮겨 적게 하면 항목마다 25토큰씩
 * 나가는데, 그건 서버가 이미 아는 값이다. 번호(n)만 받아 여기서 붙인다 —
 * 값이 싸질 뿐 아니라 제목이 어긋날 여지 자체가 사라진다.
 */
function parseSections(text: string, items: string[]): ReportSectionOut[] {
  const attempts = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) attempts.push(fenced[1].trim());
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (braced.length > 2) attempts.push(braced);

  for (const candidate of attempts) {
    let raw: { sections?: unknown };
    try {
      raw = JSON.parse(candidate) as { sections?: unknown };
    } catch {
      continue;
    }
    if (!Array.isArray(raw.sections)) continue;
    const strings = (value: unknown) =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
    const rows = raw.sections as Record<string, unknown>[];
    const sections = rows
      .map((section, order) => {
        // n이 오면 그 번호의 목차 문구를, 없거나 범위를 벗어나면 나온 순서대로 붙인다.
        const n = typeof section.n === "number" ? section.n : Number(section.n);
        const at = Number.isInteger(n) && n >= 1 && n <= items.length ? n - 1 : order;
        // 옛 형식(title을 직접 쓰던 응답)도 그대로 받는다
        const title = typeof section.title === "string" && section.title.trim() ? section.title : items[at];
        return { section, title, at };
      })
      .filter((row): row is { section: Record<string, unknown>; title: string; at: number } => Boolean(row.title))
      // 모델이 순서를 흩어 보내도 n이 제자리를 안다. n이 없었으면 at은 나온 순서라 그대로다.
      .sort((x, y) => x.at - y.at)
      .map(({ section, title }) => ({
        id: typeof section.id === "string" ? section.id : "core",
        navLabel: typeof section.nav_label === "string" && section.nav_label.trim() ? section.nav_label : title,
        title,
        // 한 줄 결론. 없으면 없는 대로 — 옛 리딩에는 이 칸이 없다.
        verdict: typeof section.verdict === "string" && section.verdict.trim() ? section.verdict.trim() : undefined,
        summary: typeof section.summary === "string" ? section.summary : "",
        paragraphs: strings(section.paragraphs),
        factsUsed: strings(section.facts_used),
        ruleIds: strings(section.rule_ids),
        watchOut: typeof section.watch_out === "string" ? section.watch_out : undefined,
        // 삽화를 고르는 열쇠. 허용 목록 밖의 말은 여기서 사라진다.
        emotionTags: normalizeEmotionTags(strings(section.emotion_tags)),
        // 모양이 어긋나면 버린다 — 덤이라 반쯤 망가진 채로 세우느니 없는 편이 낫다
        extra: parseExtra(section.extra),
      }));
    if (sections.length > 0) return sections;
  }
  return [];
}

/**
 * 한 묶음에 허용하는 출력 토큰.
 *
 * 절 하나가 1,200~1,500자다(reading-prompt.ts 의 본문 계약). 한국어는
 * 글자당 대략 1토큰이 나가고, 여기에 JSON 껍데기와 facts_used·rule_ids 가 붙는다.
 * 추론 모델은 **생각한 토큰도 이 예산에서 깎으므로** 그 몫까지 얹어 둔다.
 * 모자라면 절이 문장 중간에서 잘리고, 잘린 절은 재시도로 다시 돈을 쓴다.
 */
function chapterBudget(items: number): number {
  return 2400 + items * 3600;
}

export interface ComposeOptions {
  /** 앞에서 몇 묶음까지만 만들지. 생략하면 전부. 미리보기는 previewBatchCount()를 쓴다. */
  batchLimit?: number;
  /**
   * 이미 만들어 둔 절 수. 그 절을 맡았던 묶음은 건너뛰고 그다음부터 만든다.
   * 머리도 발급 때 이미 만들었으므로 다시 만들지 않는다.
   */
  doneSections?: number;
}

/**
 * 머리 1개 + 장 N개를 동시에 던지고 하나로 합친다.
 * 벽시계 시간은 "가장 느린 조각 하나"에 수렴한다.
 *
 * 결제 전에는 미리보기에 필요한 묶음까지만 만들고(batchLimit), 나머지는 결제가
 * 확인된 뒤에 이어 만든다(doneSections). 결제하지 않는 사람의 유료 본문을
 * 만들지 않기 위해서다.
 */
export async function composeReport(
  input: ReadingInput,
  complete: Complete,
  options: ComposeOptions = {}
): Promise<ComposeResult> {
  const inputJson = buildReadingInput(input);
  const all = chaptersOf(input.outline);

  // 이미 만든 절을 맡았던 묶음은 건너뛴다. 항목 수로 세므로 묶음 크기가 바뀌어도 안전하다.
  let skipBatches = 0;
  if (options.doneSections && options.doneSections > 0) {
    let counted = 0;
    while (skipBatches < all.length && counted < options.doneSections) {
      counted += all[skipBatches].items.length;
      skipBatches += 1;
    }
    // 묶음 경계와 이미 만든 절 수가 안 맞으면 그만큼이 통째로 사라진다.
    // READING_PREVIEW_SECTIONS 를 만들다 만 리딩이 있는 채로 바꾸면 이렇게 된다.
    if (counted > options.doneSections) {
      console.error(
        `이어 만들기 경계가 어긋났습니다: 만든 절 ${options.doneSections}개인데 ` +
          `묶음 경계는 ${counted}개입니다. ${counted - options.doneSections}개 절이 비게 됩니다. ` +
          `READING_PREVIEW_SECTIONS 를 바꾼 뒤 옛 리딩을 이어 만들면 이렇게 됩니다.`
      );
    }
  }
  const resuming = skipBatches > 0;
  const chapters = all
    .slice(skipBatches)
    .slice(0, options.batchLimit === undefined ? undefined : options.batchLimit);
  const failedParts: string[] = [];
  let provider = "";
  let model = "";
  const timings: PartTiming[] = [];
  const usages: (ChatUsage | null)[] = [];

  const run = async (label: string, prompt: string, budget: number, retry = false) => {
    const started = Date.now();
    try {
      const result = await complete(READING_SYSTEM_PROMPT, prompt, budget);
      timings.push({ label, ms: Date.now() - started, ok: Boolean(result), retry });
      if (!result) return null;
      provider = result.provider;
      if (result.model) model = result.model;
      usages.push(result.usage ?? null);
      return result.text;
    } catch (error) {
      timings.push({ label, ms: Date.now() - started, ok: false, retry });
      console.error(`리포트 조각 실패 (${label}):`, error);
      return null;
    }
  };

  // 계절은 첫 묶음의 지시문에만 붙는다. 나머지 조각은 그 줄을 못 보므로 쓸 수 없다 —
  // "전체에서 한 번"을 조각 하나가 지킬 수 없으니, 서버가 정해서 한 조각에만 준다.
  // 이어 만들기(resuming)일 때는 첫 묶음이 이미 만들어졌으므로 아무에게도 안 준다.
  const season = resuming ? "" : seasonBrief(input.facts);
  const batchCalls = chapters.map((chapter, index) =>
    run(
      chapter.label,
      chapterPrompt(inputJson, chapter, input.outline, index === 0 ? season : ""),
      chapterBudget(chapter.items.length)
    )
  );
  // 이어 만들 때는 머리가 이미 있다. 다시 만들면 헤드라인과 요약 카드가 바뀌어,
  // 결제 전에 본 화면과 결제 후에 보는 화면이 달라진다.
  const headCall = resuming ? Promise.resolve(null) : run("head", headPrompt(inputJson, input.outline), 2600);
  const [headText, ...chapterTexts] = await Promise.all([headCall, ...batchCalls]);

  // 머리가 없으면 리포트가 성립하지 않는다 (이어 만들기는 애초에 머리를 안 만든다).
  const head = headText ? parseStructuredReport(injectDummySection(headText)) : null;
  if (!resuming && !head) {
    failedParts.push("head");
    return { report: null, sections: [], provider, failedParts, model, timings, usage: sumUsage(usages), requestCount: timings.length, retryCount: 0 };
  }

  // 조각별 결과. 실패했거나 항목 수가 모자란 조각만 한 번 더 시킨다.
  // 한 번에 다 쓰던 시절에는 재시도가 리포트 전체를 다시 만드는 일이었지만,
  // 이제는 모자란 묶음 하나만 다시 받으면 된다.
  const parsedByBatch = chapterTexts.map((text, i) => (text ? parseSections(text, chapters[i].items) : []));

  const needsRetry = chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter, index }) => parsedByBatch[index].length < chapter.items.length);

  if (needsRetry.length > 0) {
    // 조각이 빈 이유가 속도 제한(429)이면 곧바로 다시 부르는 것은 같은 벽에 다시
    // 부딪히는 일이다. Gemini 무료 티어처럼 분당 요청이 적은 곳에서 특히 그렇다.
    // 한 박자 쉬고 부른다 — 어차피 이 경로는 이미 늦은 요청뿐이다.
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    const retried = await Promise.all(
      needsRetry.map(({ chapter, index }) => {
        // 이미 받아둔 절은 다시 시키지 않는다. 제목이 겹치지 않는 항목만 다시 부른다.
        const done = new Set(parsedByBatch[index].map((section) => section.title));
        const missing = chapter.items.filter((item) => ![...done].some((title) => sameItem(title, item)));
        const target: Batch = missing.length > 0 ? { label: chapter.label, items: missing } : chapter;
        return run(
          `${chapter.label} 재시도`,
          chapterPrompt(inputJson, target, input.outline, index === 0 ? season : ""),
          chapterBudget(target.items.length),
          true
        ).then((text) => ({ text, target }));
      })
    );
    retried.forEach(({ text, target }, order) => {
      const { index, chapter } = needsRetry[order];
      const parsed = text ? parseSections(text, target.items) : [];
      if (parsed.length > 0) {
        parsedByBatch[index] =
          target.items.length === chapter.items.length
            ? // 통째로 다시 받은 경우 — 더 채워졌을 때만 갈아 끼운다
              parsed.length > parsedByBatch[index].length
              ? parsed
              : parsedByBatch[index]
            : // 빠진 것만 받은 경우 — 기존 절과 합치고 목차 순서로 다시 세운다
              orderByOutline([...parsedByBatch[index], ...parsed], chapter.items);
      }
      if (parsedByBatch[index].length < chapter.items.length) failedParts.push(chapter.label);
    });
  }

  const sections = parsedByBatch.flat();
  return {
    report: head ? { ...head, sections } : null,
    sections,
    provider,
    failedParts,
    model,
    timings,
    usage: sumUsage(usages),
    requestCount: timings.length,
    retryCount: timings.filter((t) => t.retry).length,
  };
}

/**
 * parseStructuredReport는 sections가 비면 리포트로 인정하지 않는다.
 * 머리 응답에는 섹션이 없으므로, 파서를 통과시키기 위해 임시 섹션 하나를 끼웠다가
 * 곧바로 진짜 섹션으로 갈아 끼운다.
 */
function injectDummySection(headText: string): string {
  const start = headText.indexOf("{");
  const end = headText.lastIndexOf("}");
  const body = start >= 0 && end > start ? headText.slice(start, end + 1) : headText;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    parsed.sections = [{ id: "core", title: "_", summary: "", paragraphs: [], facts_used: [] }];
    return JSON.stringify(parsed);
  } catch {
    return headText;
  }
}

/**
 * 목차 항목과 절 제목이 같은 것을 가리키는지 본다.
 * 모델이 앞머리 번호나 공백을 흘리는 일이 있어 글자만 비교한다.
 */
function sameItem(title: string, item: string): boolean {
  const bare = (v: string) => v.replace(/\s+/g, "").replace(/^[0-9]+장?[0-9.)]*/, "");
  return bare(title) === bare(item) || bare(title).includes(bare(item)) || bare(item).includes(bare(title));
}

/** 합쳐진 절을 목차 순서로 다시 세우고, 같은 항목이 둘이면 뒤엣것을 버린다. */
function orderByOutline(sections: ReportSectionOut[], items: string[]): ReportSectionOut[] {
  const picked: ReportSectionOut[] = [];
  const used = new Set<number>();
  for (const item of items) {
    const at = sections.findIndex((section, i) => !used.has(i) && sameItem(section.title, item));
    if (at >= 0) {
      used.add(at);
      picked.push(sections[at]);
    }
  }
  // 어느 항목에도 붙지 않은 절은 뒤에 남겨 둔다 — 버리는 것보다 낫다
  sections.forEach((section, i) => {
    if (!used.has(i)) picked.push(section);
  });
  return picked;
}

/**
 * 가드가 막은 절만 다시 쓴다.
 *
 * 여기까지 오는 위반은 표현 문제가 아니다. 규칙에 없는 상대 성향을 단정했다거나,
 * 계산에 없는 값을 근거로 적었다거나 — 이 저장소가 "그러지 않는다" 고 못 박아 둔
 * 것들이다. 그런 문장이 든 리포트를 그대로 파는 것은 가드를 달아 둔 이유를 지우는
 * 일이다.
 *
 * 그런데 리포트 전체를 다시 만들면 값이 여섯 배가 되고, 통과했던 절까지 새로 뽑혀
 * 결제 전에 본 화면과 결제 후 화면이 달라진다. 걸린 절만 도려내고 그 자리에만
 * 다시 받는다.
 *
 * 한 번만 한다. 두 번째에도 같은 자리가 걸린다면 그건 모델이 흔들린 것이 아니라
 * 이 명식에 그 절을 쓸 근거가 없다는 뜻이고, 그건 다시 시켜서 풀 문제가 아니다.
 */
export async function rewriteFlagged(
  input: ReadingInput,
  complete: Complete,
  /** 다시 쓸 절의 목차 문구와, 그 절이 걸린 이유 */
  flagged: { title: string; notes: string[] }[]
): Promise<{ sections: ReportSectionOut[]; usage: ChatUsage; requestCount: number }> {
  const empty = { sections: [] as ReportSectionOut[], usage: sumUsage([]), requestCount: 0 };
  if (flagged.length === 0) return empty;

  const inputJson = buildReadingInput(input);
  const usages: (ChatUsage | null)[] = [];
  let requestCount = 0;

  // 걸린 이유가 절마다 다르므로 한 절씩 따로 보낸다. 묶어 보내면 한 절의 지적이
  // 옆 절에도 걸려, 멀쩡하던 절이 지적을 피하느라 같이 비틀린다.
  const results = await Promise.all(
    flagged.map(async ({ title, notes }) => {
      requestCount += 1;
      try {
        const result = await complete(
          READING_SYSTEM_PROMPT,
          chapterPrompt(inputJson, { label: "다시", items: [title] }, input.outline, "", notes),
          chapterBudget(1)
        );
        if (!result) return null;
        usages.push(result.usage ?? null);
        return parseSections(result.text, [title])[0] ?? null;
      } catch (error) {
        console.error(`다시 쓰기 실패 (${title}):`, error);
        return null;
      }
    })
  );

  return {
    sections: results.filter((section): section is ReportSectionOut => Boolean(section)),
    usage: sumUsage(usages),
    requestCount,
  };
}
