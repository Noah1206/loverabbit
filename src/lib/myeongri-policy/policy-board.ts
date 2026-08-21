// 관리 화면이 읽는 한 덩어리.
//
// 화면이 직접 여러 모듈을 뒤지게 하면, 나중에 정책이 하나 늘 때 화면도 같이 고쳐야
// 한다. 그러면 어느 날 정책은 늘었는데 화면에는 안 뜨는 상태가 된다 — 승인해야 할
// 것이 있는데 아무도 모르는 상태가 가장 나쁘다. 그래서 여기서 한 번에 모은다.

import { buildSajuFacts, type Gender } from "@/lib/saju-facts";
import { advancedMode, type AdvancedMyeongriMode } from "@/lib/myeongri/advanced-mode";
import type { AdvancedMyeongriFacts } from "@/lib/myeongri/advanced-facts";
import {
  MYEONGRI_SOURCES,
  SOURCE_POLICY_VERSION,
  canBackUserFacingClaim,
  type MyeongriSource,
} from "@/lib/myeongri-policy/source-registry";
import {
  CONFLICT_POLICY_ROWS,
  CONFLICT_POLICY_STATUS,
  CONFLICT_POLICY_VERSION,
  CONFLICT_OPEN_QUESTIONS,
} from "@/lib/myeongri/advanced-conflict";
import {
  JOHU_TABLE_STATUS,
  JOHU_TABLE_SCOPE,
  JOHU_TABLE_WHY_NOT_120,
} from "@/lib/myeongri/johu-assessment";
import {
  STRENGTH_POLICY_STATUS,
  STRENGTH_POLICY_VERSION,
  STRENGTH_OPEN_QUESTIONS,
} from "@/lib/myeongri/strength-policy";
import { JOHU_POLICY_STATUS, JOHU_OPEN_QUESTIONS } from "@/lib/myeongri/johu";
import { pendingPartnerRules } from "@/lib/myeongri-policy/partner-rules";
import GYEOKGUK_POLICY from "@/lib/myeongri-policy/gyeokguk-v1.json";
import { axisLabel } from "@/lib/myeongri/yongsin";

export interface PolicyBoard {
  mode: AdvancedMyeongriMode;
  sourcePolicyVersion: string;
  sources: Array<MyeongriSource & { usable: boolean }>;
  tables: Array<{
    name: string;
    version: string;
    status: string;
    note: string;
    openQuestions: string[];
  }>;
  conflictPolicies: typeof CONFLICT_POLICY_ROWS;
  pendingPartnerRuleIds: Array<{ id: string; blockedBy: string }>;
  sample: {
    label: string;
    birth: { year: number; month: number; day: number; hour: number; gender: Gender };
    fourPillars: string;
    strength: string;
    advanced: AdvancedMyeongriFacts;
  } | null;
  /** 승인 흐름 — 화면이 순서를 그대로 보여 준다 */
  approvalOrder: Array<{ step: number; what: string; why: string; done: boolean }>;
}

/** 관리 화면의 기준 명식. 값을 눈으로 확인할 수 있게 늘 같은 것을 쓴다. */
const SAMPLE = { year: 1993, month: 1, day: 24, hour: 14, gender: "F" as Gender };

export function buildPolicyBoard(now = new Date()): PolicyBoard {
  const mode = advancedMode();

  let sample: PolicyBoard["sample"] = null;
  try {
    const facts = buildSajuFacts(SAMPLE, now);
    const p = facts.fourPillars;
    sample = {
      label: "기준 명식 1993-01-24 14:00 여",
      birth: SAMPLE,
      fourPillars: `${p.year.stem}${p.year.branch} ${p.month.stem}${p.month.branch} ${p.day.stem}${p.day.branch} ${p.hour ? `${p.hour.stem}${p.hour.branch}` : "미상"}`,
      strength: `${facts.strength.label} ${facts.strength.score}`,
      advanced: facts.advanced,
    };
  } catch (error) {
    // 고급 층이 깨져도 관리 화면은 떠야 한다 — 무엇이 깨졌는지 봐야 고친다.
    console.error("기준 명식 계산 실패:", error);
  }

  const johuTableApproved = JOHU_TABLE_STATUS === "approved";
  const conflictApproved = CONFLICT_POLICY_ROWS.some((p) => p.status === "approved");

  return {
    mode,
    sourcePolicyVersion: SOURCE_POLICY_VERSION,
    sources: MYEONGRI_SOURCES.map((s) => ({ ...s, usable: canBackUserFacingClaim(s.sourceId) })),
    tables: [
      {
        name: "조후 후보표",
        version: "johu-candidates-v1",
        status: JOHU_TABLE_STATUS,
        note: `${JOHU_TABLE_SCOPE}\n${JOHU_TABLE_WHY_NOT_120.join(" ")}`,
        openQuestions: [],
      },
      {
        name: "조후 기후 축 (기존)",
        version: "johu-v1",
        status: JOHU_POLICY_STATUS,
        note: "월지의 한난조습. 계산층이라 고전 출처를 필요로 하지 않는다.",
        openQuestions: JOHU_OPEN_QUESTIONS,
      },
      {
        name: "억부 강약 가중치",
        version: STRENGTH_POLICY_VERSION,
        status: STRENGTH_POLICY_STATUS,
        note: "왕상휴수사·설기·득세·통근·인성과다. 2026-08-21 승인돼 strength.label 을 낸다. 되돌리려면 STRENGTH_POLICY=legacy.",
        openQuestions: STRENGTH_OPEN_QUESTIONS,
      },
      {
        name: "격국 내격 우선순위",
        version: GYEOKGUK_POLICY.policyVersion,
        status: GYEOKGUK_POLICY.status,
        note: GYEOKGUK_POLICY.scope + " / " + GYEOKGUK_POLICY.userFacing.reason,
        openQuestions: GYEOKGUK_POLICY.openQuestions,
      },
      {
        name: "축 충돌 우선순위",
        version: CONFLICT_POLICY_VERSION,
        status: CONFLICT_POLICY_STATUS,
        note: "억부·조후·격국이 갈릴 때. CR-BOTH-WITH-SCOPE(고르지 않는다)만 승인됐고, 누가 이기는지를 정한 셋은 판본 대기다.",
        openQuestions: CONFLICT_OPEN_QUESTIONS,
      },
    ],
    conflictPolicies: CONFLICT_POLICY_ROWS,
    pendingPartnerRuleIds: pendingPartnerRules().map((e) => ({
      id: e.rule.id,
      blockedBy: e.blockedBy ?? "-",
    })),
    sample,
    approvalOrder: [
      {
        step: 1,
        what: "조후의 기후 계산 범위",
        why: "절기·월지·한난조습은 후보 결론보다 먼저 검증 가능한 사실층이다",
        done: true,
      },
      {
        step: 2,
        what: "격국 V1 내격 우선순위",
        why: "월령 투간 우선. 32건 중 모호가 16건 -> 2건으로 줄었다. 격 이름을 부르는 것은 아직 별개다",
        done: GYEOKGUK_POLICY.status === "approved",
      },
      {
        step: 3,
        what: "억부 강약 정책",
        why: "P2의 가중치·통근·설기·인성과다 기준을 명시적으로 정해야 한다",
        done: STRENGTH_POLICY_STATUS === "approved",
      },
      {
        step: 4,
        what: "조후용신 표 (일간 × 월지 120칸)",
        why: "판본·번역·주석과 각 행의 근거를 확보한 뒤에만 승인할 수 있다",
        done: johuTableApproved,
      },
      {
        step: 5,
        what: "격국·조후·억부 충돌 우선순위",
        why: "단일 용신 결론을 사용자에게 보여 주기 직전의 마지막 정책이다",
        done: conflictApproved,
      },
      {
        step: 6,
        what: "통관·병약·외격·종격",
        why: "학설 차이와 예외가 커서 V2 이후로 미룬다",
        done: false,
      },
    ],
  };
}

export { axisLabel };
