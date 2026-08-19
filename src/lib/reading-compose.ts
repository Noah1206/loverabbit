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

import { chapterNumbersFromToc } from "@/lib/reading-chapters";
import {
  buildReadingInput,
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
) => Promise<{ text: string; provider: string } | null>;

export interface ComposeResult {
  report: StructuredReport | null;
  provider: string;
  /** 생성기가 붙어 있는데도 실패한 조각들 */
  failedParts: string[];
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
  const size = batchSize();
  const count = Math.max(1, Math.ceil(outline.length / size));
  // 마지막 묶음만 홀로 작아지지 않도록 고르게 나눈다 (10개를 3으로 자르면 4/3/3)
  const base = Math.floor(outline.length / count);
  const extra = outline.length % count;

  const batches: Batch[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const take = base + (i < extra ? 1 : 0);
    const items = outline.slice(cursor, cursor + take);
    const chapters = numbers.slice(cursor, cursor + take);
    const from = chapters[0] ?? i + 1;
    const to = chapters[chapters.length - 1] ?? from;
    batches.push({ label: from === to ? `${from}장` : `${from}~${to}장`, items });
    cursor += take;
  }
  return batches;
}

const HEAD_SCHEMA = `{
  "report_meta": {"title": "string", "headline": "string", "reading_time_min": 6, "disclaimer": "string", "confidence_note": "string"},
  "summary_cards": [
    {"label": "나의 중심", "value": "string", "detail": "string", "facts_used": ["string"]},
    {"label": "관계의 결", "value": "string", "detail": "string", "facts_used": ["string"]},
    {"label": "지금의 흐름", "value": "string", "detail": "string", "facts_used": ["string"]}
  ],
  "action_questions": [
    {"question": "string", "why_it_matters": "string"},
    {"question": "string", "why_it_matters": "string"},
    {"question": "string", "why_it_matters": "string"}
  ],
  "character_note": {"character_id": "string", "name": "string", "message": "string"},
  "next_step": {"label": "string", "description": "string", "recommended_focus": "relationship|work|timing"}
}`;

function headPrompt(inputJson: string, outline: string[]): string {
  return `입력 JSON으로 러브레빗 사주 리포트의 **머리 부분만** 쓴다. 본문 섹션은 다른 곳에서 쓰므로 여기서는 만들지 않는다.

리포트 전체가 다룰 목차(참고용, 여기서 쓰지는 않는다):
${outline.map((item) => `- ${item}`).join("\n")}

지켜야 할 것
- summary_cards는 정확히 3개, label은 위 스키마의 것을 그대로 쓴다.
- action_questions는 정확히 3개. 리포트 전체를 읽은 사람이 오늘 해볼 수 있는 것으로 쓴다.
- headline 42~65자. 계산값에 근거한 판단을 담는다.
- 모든 문장은 해요체.
- 설명 없이 아래 JSON 객체 하나만 출력한다.

${HEAD_SCHEMA}

입력 JSON:
${inputJson}`;
}

function chapterPrompt(inputJson: string, chapter: Batch, outline: string[]): string {
  return `입력 JSON으로 러브레빗 사주 리포트의 **${chapter.label} 본문만** 쓴다.

이 묶음이 맡은 항목은 정확히 ${chapter.items.length}개다. 순서대로 하나씩, 빠짐없이 쓴다.
${chapter.items.map((item) => `- ${item}`).join("\n")}

리포트 전체 목차(다른 장이 무엇을 다루는지 알고 겹치지 않게 쓰기 위한 참고):
${outline.map((item) => `- ${item}`).join("\n")}

지켜야 할 것
- sections 배열의 길이는 정확히 ${chapter.items.length}개. 합치거나 건너뛰지 않는다.
- title은 위 항목 문구를 앞머리 번호까지 그대로 옮겨 적는다.
- summary는 280~420자. paragraphs는 2개, 각 100~180자.
- facts_used는 "경로=값" 꼴로 적는다 (예: "strength.label=신약"). 경로만 적지 않는다.
- 이 장에서 쓴 규칙은 rule_ids에 적는다.
- 모든 문장은 해요체. '~합니다', '~입니다'로 끝내지 않는다.
- 설명 없이 아래 JSON 객체 하나만 출력한다.

{"sections": [{"id": "core", "nav_label": "string", "title": "string", "summary": "string", "paragraphs": ["string", "string"], "facts_used": ["string"], "rule_ids": ["string"], "watch_out": "string"}]}

입력 JSON:
${inputJson}`;
}

/** 장 응답에서 섹션만 꺼낸다. 머리 스키마가 아니므로 파서를 직접 쓸 수 없다. */
function parseSections(text: string): ReportSectionOut[] {
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
    const sections = (raw.sections as Record<string, unknown>[])
      .filter((section) => typeof section.title === "string" && section.title.trim())
      .map((section) => ({
        id: typeof section.id === "string" ? section.id : "core",
        navLabel:
          typeof section.nav_label === "string" && section.nav_label.trim()
            ? section.nav_label
            : (section.title as string),
        title: section.title as string,
        summary: typeof section.summary === "string" ? section.summary : "",
        paragraphs: strings(section.paragraphs),
        factsUsed: strings(section.facts_used),
        ruleIds: strings(section.rule_ids),
        watchOut: typeof section.watch_out === "string" ? section.watch_out : undefined,
      }));
    if (sections.length > 0) return sections;
  }
  return [];
}

/** 한 장의 출력 토큰 예산. 한글은 토큰을 많이 먹으므로 항목당 넉넉히 잡는다. */
function chapterBudget(items: number): number {
  return 1200 + items * 1200;
}

/**
 * 머리 1개 + 장 N개를 동시에 던지고 하나로 합친다.
 * 벽시계 시간은 "가장 느린 조각 하나"에 수렴한다.
 */
export async function composeReport(input: ReadingInput, complete: Complete): Promise<ComposeResult> {
  const inputJson = buildReadingInput(input);
  const chapters = chaptersOf(input.outline);
  const failedParts: string[] = [];
  let provider = "";

  const run = async (label: string, prompt: string, budget: number) => {
    try {
      const result = await complete(READING_SYSTEM_PROMPT, prompt, budget);
      if (!result) return null;
      provider = result.provider;
      return result.text;
    } catch (error) {
      console.error(`리포트 조각 실패 (${label}):`, error);
      return null;
    }
  };

  const [headText, ...chapterTexts] = await Promise.all([
    run("head", headPrompt(inputJson, input.outline), 2600),
    ...chapters.map((chapter) =>
      run(chapter.label, chapterPrompt(inputJson, chapter, input.outline), chapterBudget(chapter.items.length))
    ),
  ]);

  // 머리가 없으면 리포트가 성립하지 않는다.
  const head = headText ? parseStructuredReport(injectDummySection(headText)) : null;
  if (!head) {
    failedParts.push("head");
    return { report: null, provider, failedParts };
  }

  // 조각별 결과. 실패했거나 항목 수가 모자란 조각만 한 번 더 시킨다.
  // 한 번에 다 쓰던 시절에는 재시도가 리포트 전체를 다시 만드는 일이었지만,
  // 이제는 모자란 묶음 하나만 다시 받으면 된다.
  const parsedByBatch = chapterTexts.map((text) => (text ? parseSections(text) : []));

  const needsRetry = chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter, index }) => parsedByBatch[index].length < chapter.items.length);

  if (needsRetry.length > 0) {
    const retried = await Promise.all(
      needsRetry.map(({ chapter }) =>
        run(
          `${chapter.label} 재시도`,
          chapterPrompt(inputJson, chapter, input.outline),
          chapterBudget(chapter.items.length)
        )
      )
    );
    retried.forEach((text, order) => {
      const { index, chapter } = needsRetry[order];
      const parsed = text ? parseSections(text) : [];
      // 다시 받은 쪽이 더 채워졌을 때만 갈아 끼운다
      if (parsed.length > parsedByBatch[index].length) parsedByBatch[index] = parsed;
      if (parsedByBatch[index].length < chapter.items.length) failedParts.push(chapter.label);
    });
  }

  return {
    report: { ...head, sections: parsedByBatch.flat() },
    provider,
    failedParts,
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
