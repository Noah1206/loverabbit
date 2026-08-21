// 축이 갈릴 때 무엇을 할 것인가.
//
// 이 파일이 내리는 기본 판정은 하나다 — **아무것도 하지 않는다.**
//
// 억부가 화를 설기라 하고 조후가 화를 온기라 할 때, 코드가 둘 중 하나를 고르면
// 그 선택이 어디서 왔는지 아무도 다시 못 묻는다. 그래서 기본값은
// unresolved + content_suppressed 다. 충돌이 있다는 사실은 계산해 남기고,
// 사용자가 읽는 글은 기존 P0/P1 결론 그대로 둔다.
//
// 이건 기능을 미룬 것이 아니라 이 층의 완성된 동작이다. 승인된 우선순위 정책이
// 생기면 그때 policy_resolved 로 바뀐다.

import { axisLabel, type YongsinAssessment, type YongsinAxis, type YongsinCandidate } from "@/lib/myeongri/yongsin";
import type { SeasonalContext } from "@/lib/myeongri/seasonal-context";
import POLICY from "@/lib/myeongri-policy/conflict-resolution-v1.json";
import { withJosa } from "@/lib/korean-josa";

export interface AdvancedConflict {
  id: string;
  axes: YongsinAxis[];
  subject: string;
  candidateA: YongsinCandidate;
  candidateB: YongsinCandidate;
  severity: "blocking" | "major" | "advisory";
  resolutionStatus: "unresolved" | "policy_resolved" | "content_suppressed";
  resolutionPolicyId?: string;
  explanation: string;
}

interface PolicyRow {
  policyId: string;
  status: string;
  scenario: string;
  priorityOrder: YongsinAxis[];
  applicability: string;
  sourceIds: string[];
  requiredFacts: string[];
  safePhrasing: string[];
  forbiddenPhrasing: string[];
  blockedBy?: string;
}

const POLICIES = POLICY.policies as PolicyRow[];

/** 승인된 우선순위 정책. 지금은 비어 있다. */
export function approvedResolutionPolicies(): PolicyRow[] {
  return POLICIES.filter((p) => p.status === "approved");
}

export function detectConflicts(
  yongsin: YongsinAssessment,
  context: SeasonalContext
): AdvancedConflict[] {
  const out: AdvancedConflict[] = [];
  const axes: YongsinAxis[] = ["eokbu", "johu", "gyeokguk"];

  for (let i = 0; i < axes.length; i += 1) {
    for (let j = i + 1; j < axes.length; j += 1) {
      const a = primaryOf(yongsin, axes[i]);
      const b = primaryOf(yongsin, axes[j]);
      if (!a || !b) continue;
      if (a.element === b.element) continue;

      const resolution = resolve(axes[i], axes[j], context);
      out.push({
        id: `CONFLICT-${axes[i].toUpperCase()}-${axes[j].toUpperCase()}-${a.element}${b.element}`,
        axes: [axes[i], axes[j]],
        subject:
          `${withJosa(axisLabel(axes[i]), "은는")} ${a.element}, ` +
          `${withJosa(axisLabel(axes[j]), "은는")} ${withJosa(b.element!, "을를")} 가리킨다`,
        candidateA: a,
        candidateB: b,
        // 아직 어느 후보도 사용자에게 안 나가므로 리포트를 막을 일이 아니다.
        // 다만 이 상태에서 결론을 단정하면 그건 blocking 이다 — 가드가 그걸 본다.
        severity: "major",
        resolutionStatus: resolution.status,
        ...(resolution.policyId ? { resolutionPolicyId: resolution.policyId } : {}),
        explanation: resolution.explanation,
      });
    }
  }

  return out;
}

function primaryOf(yongsin: YongsinAssessment, axis: YongsinAxis): YongsinCandidate | null {
  const list = yongsin.candidatesByAxis[axis].filter(
    (c) =>
      c.rank === "primary" &&
      c.element !== null &&
      (c.status === "candidate" || c.status === "approved")
  );
  return list[0] ?? null;
}

function resolve(
  a: YongsinAxis,
  b: YongsinAxis,
  context: SeasonalContext
): { status: AdvancedConflict["resolutionStatus"]; policyId?: string; explanation: string } {
  const approved = approvedResolutionPolicies();
  const pair = new Set([a, b]);

  const hit = approved.find((p) => {
    const ordered = p.priorityOrder.filter((axis) => pair.has(axis));
    return ordered.length === 2;
  });

  if (hit) {
    return {
      status: "policy_resolved",
      policyId: hit.policyId,
      explanation: `${hit.policyId} 가 ${hit.priorityOrder.map(axisLabel).join(" > ")} 순으로 정한다`,
    };
  }

  const extreme = ["해", "자", "축", "사", "오", "미"].includes(context.monthBranch);
  return {
    status: "content_suppressed",
    explanation:
      `${withJosa(axisLabel(a), "와과")} ${axisLabel(b)}의 우선순위를 정한 승인 정책이 없다. ` +
      `기존 해석을 그대로 두고 고급 결론을 내지 않는다.` +
      (extreme
        ? ` (${context.monthBranch}월은 한난이 극에 있는 자리라 CR-JOHU-FIRST-EXTREME-SEASON 이 겨냥하는 경우지만, 아직 draft 다.)`
        : ""),
  };
}

/** 충돌이 하나라도 있으면 고급 결론을 내지 않는다 */
export function shouldSuppressAdvanced(conflicts: AdvancedConflict[]): boolean {
  return conflicts.some((c) => c.resolutionStatus !== "policy_resolved");
}

export const CONFLICT_POLICY_VERSION = POLICY.policyVersion;
export const CONFLICT_POLICY_STATUS = POLICY.status;
export const CONFLICT_OPEN_QUESTIONS = POLICY.openQuestions;
export const CONFLICT_POLICY_ROWS = POLICIES;
