// 고급 해석 팩트 — 조후·격국·용신·충돌을 한 덩어리로.
//
// trace 가 이 구조의 핵심이다. 어떤 규칙이 어떤 출처와 어떤 계산값으로 무엇을
// 판정했는지, 그리고 **왜 사용자에게 안 나갔는지**를 함께 남긴다.
// 나가지 않은 이유를 안 남기면, 나중에 이 층을 켜려는 사람이 무엇을 승인해야
// 하는지 알 수 없어 결국 다시 처음부터 따지게 된다.
//
// 계산이 실패해도 기존 P0/P1 리포트를 막지 않는다. 이 층은 얹혀 있는 것이지
// 떠받치고 있는 것이 아니다.

import type { SajuChart } from "@/lib/saju";
import { advancedMode, type AdvancedMyeongriMode } from "@/lib/myeongri/advanced-mode";
import { assessJohu, type JohuAssessment } from "@/lib/myeongri/johu-assessment";
import {
  assessGyeokguk,
  gyeokOperation,
  sangshinCandidates,
  OUTER_PATTERN_NOTE,
  type GyeokgukAssessment,
  type GyeokOperation,
  type SangshinCandidate,
} from "@/lib/myeongri/gyeokguk";
import { assessYongsin, axisLabel, type YongsinAssessment } from "@/lib/myeongri/yongsin";
import { detectConflicts, shouldSuppressAdvanced, type AdvancedConflict } from "@/lib/myeongri/advanced-conflict";
import type { SeasonalContext } from "@/lib/myeongri/seasonal-context";
import { SOURCE_POLICY_VERSION } from "@/lib/myeongri-policy/source-registry";

export interface AdvancedTrace {
  ruleId: string;
  sourceIds: string[];
  requiredFacts: string[];
  usedFacts: string[];
  verdict: "applied" | "candidate" | "blocked" | "ambiguous";
  reason: string;
}

export interface AdvancedMyeongriFacts {
  mode: AdvancedMyeongriMode;
  sourcePolicyVersion: string;
  seasonalContext: SeasonalContext;
  johu: JohuAssessment;
  gyeokguk: GyeokgukAssessment;
  sangshin: SangshinCandidate[];
  gyeokOperation: GyeokOperation;
  yongsin: YongsinAssessment;
  conflicts: AdvancedConflict[];
  trace: AdvancedTrace[];
  /** 이 명식에서 고급 해석이 사용자 글에 닿을 수 있는가 */
  readerVisible: boolean;
  /** 닿지 못한다면 왜인가 — 관리 화면과 감사 리포트가 그대로 쓴다 */
  suppressionReasons: string[];
}

export function buildAdvancedFacts(
  chart: SajuChart,
  strengthLabel: "신강" | "중화" | "신약",
  mode: AdvancedMyeongriMode = advancedMode()
): AdvancedMyeongriFacts {
  const johu = assessJohu(chart);
  const gyeokguk = assessGyeokguk(chart);
  const yongsin = assessYongsin(chart, strengthLabel);
  const conflicts = detectConflicts(yongsin, johu.context);

  const trace: AdvancedTrace[] = [];

  // ── 조후 ──
  for (const candidate of johu.candidates) {
    trace.push({
      ruleId: candidate.ruleId,
      sourceIds: candidate.sourceIds,
      requiredFacts: ["advanced.seasonalContext.climateAxes"],
      usedFacts: [
        `seasonalContext.monthBranch=${johu.context.monthBranch}`,
        `seasonalContext.climateAxes.temperature=${johu.context.climateAxes.temperature}`,
        `seasonalContext.climateAxes.moisture=${johu.context.climateAxes.moisture}`,
      ],
      verdict: candidate.status === "approved" ? "applied" : candidate.status === "blocked" ? "blocked" : "candidate",
      reason:
        candidate.status === "approved"
          ? candidate.reason
          : `${candidate.reason} — 나가지 못하는 이유: ${candidate.blockers.join(" / ") || "정책 미승인"}`,
    });
  }

  // ── 격국 ──
  trace.push({
    ruleId: gyeokguk.candidates[0]?.ruleId ?? "ADV-GYEOK-INNER-V1",
    sourceIds: gyeokguk.candidates[0]?.sourceIds ?? ["SRC-JAPYEONG"],
    requiredFacts: ["advanced.gyeokguk.monthlyCommand"],
    usedFacts: [
      `gyeokguk.monthlyCommand.branch=${gyeokguk.monthlyCommand.branch}`,
      `gyeokguk.monthlyCommand.hiddenStems=${gyeokguk.monthlyCommand.hiddenStems.map((h) => h.stem).join(",")}`,
      `gyeokguk.monthlyCommand.exposed=${gyeokguk.monthlyCommand.exposed.map((e) => e.stem).join(",") || "없음"}`,
    ],
    verdict:
      gyeokguk.determination === "determined"
        ? "candidate"
        : gyeokguk.determination === "ambiguous"
          ? "ambiguous"
          : "blocked",
    reason:
      gyeokguk.determination === "determined"
        ? `${gyeokguk.primary!.pattern} 후보가 가장 뚜렷하다. 다만 출처가 metadata_only 라 사용자에게 나가지 않는다.`
        : gyeokguk.determination === "ambiguous"
          ? `후보 ${gyeokguk.candidates.map((c) => c.pattern).join(", ")} 가 같은 무게로 서서 하나로 정하지 않는다`
          : "월지에서 내격 후보가 서지 않는다",
  });

  trace.push({
    ruleId: OUTER_PATTERN_NOTE.ruleId,
    sourceIds: [],
    requiredFacts: [],
    usedFacts: [],
    verdict: "blocked",
    reason: OUTER_PATTERN_NOTE.reason,
  });

  // ── 용신 ──
  for (const [axis, list] of Object.entries(yongsin.candidatesByAxis)) {
    for (const candidate of list) {
      trace.push({
        ruleId: candidate.ruleId,
        sourceIds: candidate.sourceIds,
        requiredFacts: candidate.requiredFacts,
        usedFacts: [`strength.label=${strengthLabel}`],
        verdict:
          candidate.status === "approved"
            ? "applied"
            : candidate.status === "candidate"
              ? "candidate"
              : "blocked",
        reason: `${axisLabel(axis as never)} · ${candidate.element} · ${candidate.reason}`,
      });
    }
  }

  // ── 충돌 ──
  for (const conflict of conflicts) {
    trace.push({
      ruleId: conflict.resolutionPolicyId ?? "CONFLICT-UNRESOLVED",
      sourceIds: [],
      requiredFacts: ["advanced.yongsin.candidatesByAxis"],
      usedFacts: [conflict.subject],
      verdict: conflict.resolutionStatus === "policy_resolved" ? "applied" : "blocked",
      reason: conflict.explanation,
    });
  }

  const suppressionReasons = collectSuppression(mode, johu, gyeokguk, conflicts);

  return {
    mode,
    sourcePolicyVersion: SOURCE_POLICY_VERSION,
    seasonalContext: johu.context,
    johu,
    gyeokguk,
    sangshin: sangshinCandidates(gyeokguk),
    gyeokOperation: gyeokOperation(gyeokguk),
    yongsin,
    conflicts,
    trace,
    readerVisible: suppressionReasons.length === 0,
    suppressionReasons,
  };
}

function collectSuppression(
  mode: AdvancedMyeongriMode,
  johu: JohuAssessment,
  gyeokguk: GyeokgukAssessment,
  conflicts: AdvancedConflict[]
): string[] {
  const out: string[] = [];
  if (mode === "evidence_only") {
    out.push("ADVANCED_MYEONGRI_MODE=evidence_only — 계산만 하고 사용자 글은 바꾸지 않는다");
  }
  if (johu.appliedCandidates.length === 0) {
    out.push(`조후 후보 ${johu.candidates.length}개가 전부 승인 전이다 (${johu.policyVersion})`);
  }
  if (gyeokguk.status !== "approved") {
    out.push(`격국이 ${gyeokguk.determination}·${gyeokguk.status} 라 단일 격으로 서술할 수 없다`);
  }
  if (conflicts.length > 0) {
    // 승인된 정책이 "고르지 않는다"이므로, 갈린 축이 있으면 단일 결론은 영영 안 나간다.
    // 이건 미승인 상태가 아니라 승인된 결론이다.
    out.push(
      `축이 갈린다 (${conflicts.map((c) => c.id).join(", ")}) — ` +
        `CR-BOTH-WITH-SCOPE 에 따라 단일 용신 결론을 내지 않는다`
    );
  }
  if (shouldSuppressAdvanced(conflicts)) {
    out.push("아직 처리되지 않은 충돌이 있다");
  }
  return out;
}

/** 리포트 입력에 실을 요약 — policy_preview 이상에서만 채워진다 */
export function advancedForPrompt(advanced: AdvancedMyeongriFacts) {
  if (!advanced.readerVisible) return null;
  return {
    seasonal: `${advanced.seasonalContext.monthBranch}월 · ${advanced.seasonalContext.climateAxes.temperature}/${advanced.seasonalContext.climateAxes.moisture}`,
    johu: advanced.johu.appliedCandidates.map((c) => `${c.candidateElement}=${c.role}`),
    gyeokguk: advanced.gyeokguk.primary?.pattern ?? null,
    // 승인된 trace 만 넘긴다. 후보는 모델이 볼 이유가 없다 — 보면 쓴다.
    trace: advanced.trace
      .filter((t) => t.verdict === "applied")
      .map((t) => `${t.ruleId}@${t.sourceIds.join(",")}`),
  };
}
