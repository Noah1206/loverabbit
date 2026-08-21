// 레인과 목적을 받아 어떤 사주시바 패턴으로 쓸지 고른다.
//
// 패턴은 "이 글을 어떤 모양으로 쓸 것인가"만 정한다. 무엇을 주장할지는
// 승인된 명리 입력(approvedFacts)이 정한다. 이 둘을 섞지 않는 것이
// 지시 문서 최우선 명령의 단서 조항이고, 이 파일이 지키는 경계다.

import type { CorpusRow, SajushibaPattern, PatternLibrary } from "@/lib/threads-corpus";
import type {
  AuthorizedReuseMode,
  ReferenceSource,
  ThreadContentLane,
  ThreadGoal,
} from "@/lib/threads-content";
import { reuseDecision } from "@/content/reference/sajushiba/permission-registry";

/**
 * 레인별 우선 패턴. 지시 문서 G의 표를 그대로 옮겼다.
 *
 * 앞에 있는 것이 1순위다. 후보가 여러 개인 레인은 초안을 여러 개 뽑을 때
 * 돌아가며 쓴다 — 같은 패턴으로 넷을 만들면 넷이 서로 닮는다.
 */
export const LANE_PATTERNS: Record<ThreadContentLane, string[]> = {
  daily_zodiac: ["SS-P02-DAILY-12-ZODIAC-BOARD", "SS-P05-WARNING-WITH-RELIEF"],
  weekly_ranking: ["SS-P01-WEEKLY-TOP-RANKING"],
  inner_world: ["SS-P03-SECRET-INSIDE-OUTSIDE"],
  warning_card: ["SS-P05-WARNING-WITH-RELIEF"],
  free_reading: ["SS-P04-FREE-READING-GATE"],
  app_story: ["SS-P07-APP-ORIGIN-COMMUNITY", "SS-P08-ZODIAC-TO-DAY-PILLAR-UPSELL"],
  individual_reading: ["SS-P06-TECHNICAL-TO-EVERYDAY"],
};

/** 패턴의 funnel 표기는 "reach_or_save" 처럼 둘을 겸한다. 목적이 그 안에 있으면 맞다. */
export function patternServesGoal(pattern: SajushibaPattern, goal: ThreadGoal): boolean {
  const funnel = pattern.funnel ?? "";
  if (funnel.includes(goal)) return true;
  // save 를 표시하지 않는 패턴이라도 trust 계열은 저장 목적에 쓸 수 있다.
  if (goal === "save" && funnel.includes("trust")) return true;
  return false;
}

export class PatternNotFoundError extends Error {}

export function patternById(library: PatternLibrary, id: string): SajushibaPattern {
  const found = library.patterns.find((p) => p.id === id);
  if (!found) throw new PatternNotFoundError(`패턴을 찾을 수 없다 — ${id}`);
  return found;
}

/**
 * 레인에 쓸 수 있는 패턴들. goal 이 주어지면 목적이 맞는 것만 남긴다.
 *
 * 목적이 맞는 것이 하나도 없으면 레인 기본 순서를 그대로 돌려준다.
 * 목적은 강도를 정하는 값이지 후보를 없애는 값이 아니어서, 여기서 빈 배열을
 * 돌려주면 레인 자체가 막힌다.
 */
export function candidatePatterns(
  library: PatternLibrary,
  lane: ThreadContentLane,
  goal?: ThreadGoal
): SajushibaPattern[] {
  const ordered = (LANE_PATTERNS[lane] ?? []).map((id) => patternById(library, id));
  if (!goal) return ordered;
  const matched = ordered.filter((p) => patternServesGoal(p, goal));
  return matched.length > 0 ? matched : ordered;
}

/** n번째 초안에 쓸 패턴 — 후보를 돌아가며 고른다 */
export function selectPattern(
  library: PatternLibrary,
  lane: ThreadContentLane,
  goal: ThreadGoal,
  index = 0
): SajushibaPattern {
  const candidates = candidatePatterns(library, lane, goal);
  if (candidates.length === 0) throw new PatternNotFoundError(`레인에 패턴이 없다 — ${lane}`);
  return candidates[index % candidates.length];
}

/**
 * 패턴이 근거로 삼은 원문들을 초안 메타데이터용 형태로.
 *
 * `directCopyAllowed`는 문맥이 온전한 행에만 준다. 부모 글을 못 가져온 행은
 * 앞뒤가 잘려 있어, 문장을 그대로 옮기면 무슨 말인지 모르는 글이 된다.
 */
export function referenceSourcesFor(
  pattern: SajushibaPattern,
  rows: CorpusRow[]
): ReferenceSource[] {
  const byId = new Map(rows.map((r) => [r.post_id, r]));
  return pattern.source_post_ids
    .map((id) => byId.get(id))
    .filter((r): r is CorpusRow => Boolean(r))
    .map((r) => ({
      postId: r.post_id,
      url: r.url,
      directCopyAllowed: r.extraction_status === "complete",
      extractionStatus: r.extraction_status,
    }));
}

/**
 * 패턴 하나를 프롬프트에 실을 형태로.
 *
 * reading-rules.ts 의 rulesForPrompt()와 같은 자리를 차지한다 — 내부 운영 메모는
 * 빼고 모델이 따라야 할 형식만 남긴다. love_rabbit_policy 는 남긴다. 그건 메모가
 * 아니라 이 패턴을 쓸 때 지켜야 하는 조건이다.
 */
export function patternForPrompt(pattern: SajushibaPattern) {
  return {
    pattern_id: pattern.id,
    name: pattern.name,
    hook_formula: pattern.hook_formula,
    body_formula: pattern.body_formula,
    rhythm: pattern.rhythm,
    style_markers: pattern.style_markers,
    conversion_bridge: pattern.conversion_bridge,
    love_rabbit_policy: pattern.love_rabbit_policy,
  };
}

/**
 * 원문 본문을 프롬프트에 실을 형태.
 *
 * pattern_only 에서는 원문 대신 뼈대만 넘긴다. 원문을 눈앞에 두고 "베끼지는 마"라고
 * 하는 것보다 아예 안 보여주는 편이 실제로 지켜진다.
 *
 * 나머지 모드에서는 원문 전문을 넘기되, 그 게시물이 그 모드를 허용하는지를
 * 레지스트리에 먼저 묻는다. 허용되지 않으면 그 행만 뼈대로 내려간다 —
 * 패턴 하나가 여러 원문을 근거로 삼는데, 그중 하나가 잠겼다고 패턴 전체를
 * 못 쓰게 만들 이유는 없다.
 */
export function sourceBodiesForPrompt(
  pattern: SajushibaPattern,
  rows: CorpusRow[],
  mode: AuthorizedReuseMode
): Array<{
  post_id: string;
  allowed_reuse_mode: AuthorizedReuseMode;
  source_body?: string;
  structure_evidence?: string[];
  locked_reason?: string;
}> {
  const byId = new Map(rows.map((r) => [r.post_id, r]));
  return pattern.source_post_ids
    .map((id) => byId.get(id))
    .filter((r): r is CorpusRow => Boolean(r))
    .map((r) => {
      if (mode === "pattern_only") {
        return {
          post_id: r.post_id,
          allowed_reuse_mode: "pattern_only" as const,
          structure_evidence: outlineOf(r.body),
        };
      }
      const decision = reuseDecision(r.post_id, mode, {
        extractionStatus: r.extraction_status,
      });
      if (!decision.ok) {
        return {
          post_id: r.post_id,
          allowed_reuse_mode: "pattern_only" as const,
          structure_evidence: outlineOf(r.body),
          locked_reason: `[${decision.status}] ${decision.reason}`,
        };
      }
      return { post_id: r.post_id, allowed_reuse_mode: mode, source_body: r.body };
    });
}

/**
 * 이 패턴을 이 모드로 돌릴 수 있는가.
 *
 * 원문을 하나도 못 여는 모드라면 생성으로 넘기지 않는다. verbatim 을 시켰는데
 * 원문이 전부 잠겨 있으면 모델은 뼈대만 보고 쓰게 되고, 그 결과물에 verbatim
 * 이라는 딱지가 붙는다. 그 딱지가 나중에 거짓 근거가 된다.
 */
export function modeBlockers(
  pattern: SajushibaPattern,
  rows: CorpusRow[],
  mode: AuthorizedReuseMode
): string[] {
  if (mode === "pattern_only") return [];
  const byId = new Map(rows.map((r) => [r.post_id, r]));
  const decisions = pattern.source_post_ids
    .map((id) => byId.get(id))
    .filter((r): r is CorpusRow => Boolean(r))
    .map((r) => reuseDecision(r.post_id, mode, { extractionStatus: r.extraction_status }));
  if (decisions.some((d) => d.ok)) return [];
  return decisions
    .filter((d): d is Extract<typeof d, { ok: false }> => !d.ok)
    .map((d) => `[${d.status}] ${d.reason}`);
}

/**
 * 원문에서 문장이 아니라 뼈대만 남긴다.
 *
 * 줄 수, 각 줄의 길이, 숫자·순위가 어디 붙는지 — 리듬을 재현하는 데 필요한 것은
 * 이만큼이고, 이것은 표현이 아니라 형식이다.
 */
export function outlineOf(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 14)
    .map((line) => {
      const rank = /^(\d+)\s*위/.exec(line) ?? /^(\d+)[.)]/.exec(line);
      const chars = [...line].length;
      if (rank) return `[순위줄 ${rank[1]}] ${chars}자`;
      if (/[?？]$/.test(line)) return `[질문줄] ${chars}자`;
      if (chars <= 20) return `[짧은줄] ${chars}자`;
      return `[문장줄] ${chars}자`;
    });
}
