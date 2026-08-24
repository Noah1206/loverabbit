// 조후 후보 — 계산과 결론을 나눈 뒤의 결론 쪽.
//
// seasonal-context.ts 가 "축월이고 한랭하고 습하다" 까지 낸다. 그건 계산이다.
// 여기서 내는 "그래서 화가 먼저 필요하다" 는 결론이고, 결론에는 출처가 있어야 한다.
//
// 지금 johu-candidates-v1.json 의 모든 행은 draft 다. 그래서 이 파일은 후보를
// 계산해 내되 **한 줄도 사용자에게 보내지 않는다.** 그게 이 층의 정상 상태다.
//
// 기존 johu.ts 의 johuEvidence() 는 건드리지 않는다. P0/P1 이 그것을 쓰고 있고,
// 이 파일은 그 위에 얹히는 층이다.

import type { Ohaeng, SajuChart } from "../saju";
import { seasonalContext, elementsPresent, type SeasonalContext } from "../myeongri/seasonal-context";
import { ruleIsUserFacing, blockersFor, type AdvancedPolicyRule } from "../myeongri-policy/source-registry";
import TABLE from "../myeongri-policy/johu-candidates-v1.json";

export type JohuRole = "warm" | "cool" | "moisten" | "dry" | "drain" | "contain" | "circulate";

export interface JohuCandidate {
  candidateElement: Ohaeng;
  role: JohuRole;
  priority: "primary" | "secondary" | "supporting";
  ruleId: string;
  sourceIds: string[];
  status: "candidate" | "approved" | "blocked";
  reason: string;
  /** 그 오행이 명식 안에 있는가 (지장간 포함). 없으면 운에서 와야 한다. */
  presentInChart: boolean;
  safePhrasing: string[];
  forbiddenPhrasing: string[];
  /** 승인을 막고 있는 것 — 관리 화면이 그대로 보여 준다 */
  blockers: string[];
}

export interface JohuAssessment {
  context: SeasonalContext;
  candidates: JohuCandidate[];
  /** 실제로 사용자에게 나갈 수 있는 것. 지금은 언제나 빈 배열이다. */
  appliedCandidates: JohuCandidate[];
  policyStatus: "calculated_only" | "source_attached" | "approved";
  policyVersion: string;
  openQuestions: string[];
}

interface TableRow {
  ruleId: string;
  climate: { temperature: string[]; moisture: string[] };
  candidateElement: string;
  role: string;
  priority: string;
  status: string;
  sourceIds: string[];
  applicability: string;
  reason: string;
  safePhrasing: string[];
  forbiddenPhrasing: string[];
}

function matchesClimate(row: TableRow, context: SeasonalContext): boolean {
  const t = row.climate.temperature;
  const m = row.climate.moisture;
  const tOk = t.includes("any") || t.includes(context.climateAxes.temperature);
  const mOk = m.includes("any") || m.includes(context.climateAxes.moisture);
  return tOk && mOk;
}

/** 표의 한 행을 정책 규칙 꼴로 — 출처·상태 검사를 한 곳에서 하기 위해서다 */
function asPolicyRule(row: TableRow): AdvancedPolicyRule {
  return {
    ruleId: row.ruleId,
    family: "johu",
    status: row.status as AdvancedPolicyRule["status"],
    sourceIds: row.sourceIds,
    applicability: row.applicability,
    requiredFacts: ["advanced.seasonalContext.climateAxes"],
    output: { candidateElement: row.candidateElement, role: row.role },
    safePhrasing: row.safePhrasing,
    forbiddenPhrasing: row.forbiddenPhrasing,
    policyVersion: TABLE.policyVersion,
  };
}

export function assessJohu(chart: SajuChart): JohuAssessment {
  const context = seasonalContext(chart);
  const present = elementsPresent(chart);
  const rows = TABLE.rows as TableRow[];

  const candidates: JohuCandidate[] = rows
    .filter((row) => matchesClimate(row, context))
    .map((row) => {
      const rule = asPolicyRule(row);
      const userFacing = ruleIsUserFacing(rule);
      return {
        candidateElement: row.candidateElement as Ohaeng,
        role: row.role as JohuRole,
        priority: row.priority as JohuCandidate["priority"],
        ruleId: row.ruleId,
        sourceIds: row.sourceIds,
        // 출처가 metadata_only 이거나 상태가 approved 가 아니면 후보에서 멈춘다.
        status: (userFacing ? "approved" : row.status === "draft" ? "candidate" : "blocked") as JohuCandidate["status"],
        reason: row.reason,
        presentInChart: present.has(row.candidateElement as Ohaeng),
        safePhrasing: row.safePhrasing,
        forbiddenPhrasing: row.forbiddenPhrasing,
        blockers: blockersFor(rule),
      };
    })
    .sort((a, b) => rank(a.priority) - rank(b.priority));

  const applied = candidates.filter((c) => c.status === "approved");

  return {
    context,
    candidates,
    appliedCandidates: applied,
    policyStatus:
      applied.length > 0
        ? "approved"
        : candidates.some((c) => c.sourceIds.length > 0)
          ? "source_attached"
          : "calculated_only",
    policyVersion: TABLE.policyVersion,
    openQuestions: TABLE.openQuestions,
  };
}

function rank(p: JohuCandidate["priority"]): number {
  return p === "primary" ? 0 : p === "secondary" ? 1 : 2;
}

export const JOHU_TABLE_STATUS = TABLE.status;
export const JOHU_TABLE_SCOPE = TABLE.scope;
export const JOHU_TABLE_WHY_NOT_120 = TABLE.whyNot120;
