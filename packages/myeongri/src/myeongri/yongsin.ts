// 용신(用神) — 하나를 고르지 않는 층.
//
// 이 파일의 설계 근거는 학술 쪽에서 왔다. 적천수천미 명조 512개를 분석한 연구는
// 억부 단독 38.3%, 격국 20.3%, 조후 8.4%, 나머지는 둘 이상 병용이라고 보고한다
// (SRC-ACADEMIC-2025-YONGSHIN). 즉 **용신법은 하나가 아니라 여럿이고, 서로 다른
// 답을 낼 수 있다.** 그런데 리포트는 한 줄로 말하고 싶어 한다. 그 간극이 이 층에서
// 가장 위험한 자리다.
//
// 그래서 여기서는 축마다 후보를 따로 내고, 축들이 합의하는지 갈리는지를 계산한다.
// 합의하면 합의했다고 하고, 갈리면 갈렸다고 한다. **갈린 것을 하나로 만들지 않는다.**
//
// 기준 명식이 정확히 그 자리다.
//   억부: 신약한 을목에게 화는 설기 — 빼내는 것
//   조후: 축월의 언 을목에게 화는 온기 — 녹이는 것
// 같은 화가 정반대로 읽힌다. 지금까지 시스템은 조후 축이 없어서 이 충돌이 있다는
// 사실조차 계산하지 못했다.

import type { Ohaeng, SajuChart } from "../saju";
import { assessJohu, type JohuAssessment } from "../myeongri/johu-assessment";
import { assessGyeokguk, type GyeokgukAssessment } from "../myeongri/gyeokguk";
import { strengthPolicyEvidence } from "../myeongri/strength-policy";
import { stemElementOf } from "../myeongri/hidden-stems";
import { withJosa } from "../korean-josa";

export type YongsinAxis = "eokbu" | "johu" | "gyeokguk" | "tonggwan" | "byeongyak";

export interface YongsinCandidate {
  axis: YongsinAxis;
  /**
   * 이 축이 가리키는 오행. **정할 수 없으면 null 이다.**
   *
   * 처음에는 자리를 채우려고 아무 오행이나 넣고 status 로 막았는데, 그 값이 합의
   * 판정에 그대로 섞여 들어갔다. 있지도 않은 후보 때문에 축이 갈린 것으로 세어졌다.
   * 모르는 자리는 비워 두는 편이 낫다 — 채워 두면 어딘가에서 반드시 쓰인다.
   */
  element: Ohaeng | null;
  role: string;
  rank: "primary" | "secondary" | "supporting";
  status: "candidate" | "approved" | "blocked" | "not_applicable";
  ruleId: string;
  sourceIds: string[];
  requiredFacts: string[];
  reason: string;
}

export interface YongsinAssessment {
  candidatesByAxis: Record<YongsinAxis, YongsinCandidate[]>;
  consensus: {
    elements: Ohaeng[];
    kind: "unanimous" | "partial_agreement" | "conflict" | "insufficient_evidence";
    reason: string;
  };
  finalOutput: {
    status: "not_selected" | "candidate_only" | "policy_selected";
    selected?: YongsinCandidate[];
    policyId?: string;
  };
}

const GENERATES: Record<Ohaeng, Ohaeng> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const CONTROLS: Record<Ohaeng, Ohaeng> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };

/**
 * 억부 축.
 *
 * P2 강약 정책이 아직 승인 전이라(strength-v1.json status=policy_proposed)
 * 이 축의 후보도 candidate 에서 멈춘다. 지금 판정(strength.label)은 그대로 쓰되
 * **그것으로 용신을 단정하지 않는다** — 라벨과 용신은 다른 물음이다.
 */
function eokbuCandidates(
  chart: SajuChart,
  strengthLabel: "신강" | "중화" | "신약"
): YongsinCandidate[] {
  const dayElement = stemElementOf(chart.day.gan);
  const evidence = strengthPolicyEvidence(chart);
  const base = {
    axis: "eokbu" as const,
    status: "candidate" as const,
    ruleId: "ADV-YONGSIN-EOKBU-V1",
    sourceIds: ["SRC-CHUNMISO-IM", "SRC-ACADEMIC-2025-YONGSHIN"],
    requiredFacts: ["strength.label", "strengthPolicy"],
  };

  if (strengthLabel === "신약") {
    // 약하면 돕는다 — 인성(나를 생하는 것)과 비겁(같은 오행).
    const inseong = (Object.keys(GENERATES) as Ohaeng[]).find((e) => GENERATES[e] === dayElement)!;
    return [
      {
        ...base,
        element: inseong,
        role: "일간을 생해 힘을 보탠다",
        rank: "primary",
        reason: `일간 ${dayElement}이 약하다는 판정(${strengthLabel} ${evidence.proposedScore} 제안)에서 나오는 후보`,
      },
      {
        ...base,
        element: dayElement,
        role: "같은 기운으로 곁을 채운다",
        rank: "secondary",
        reason: "비겁이 일간의 힘을 나눠 받쳐 준다고 보는 자리",
      },
    ];
  }

  if (strengthLabel === "신강") {
    // 강하면 덜어 낸다 — 식상(내가 생하는 것), 재성(내가 극하는 것), 관살(나를 극하는 것).
    const siksang = GENERATES[dayElement];
    const jaeseong = CONTROLS[dayElement];
    const gwansal = (Object.keys(CONTROLS) as Ohaeng[]).find((e) => CONTROLS[e] === dayElement)!;
    return [
      { ...base, element: siksang, role: "넘치는 기운을 밖으로 낸다", rank: "primary", reason: "설기" },
      { ...base, element: jaeseong, role: "쓸 데를 만들어 덜어 낸다", rank: "secondary", reason: "재성" },
      { ...base, element: gwansal, role: "눌러서 가지런하게 한다", rank: "supporting", reason: "관살" },
    ];
  }

  return [
    {
      ...base,
      element: dayElement,
      role: "치우친 쪽을 보아 정한다",
      rank: "supporting",
      status: "candidate",
      reason: "중화에 가까워 억부만으로는 방향이 정해지지 않는다",
    },
  ];
}

/** 조후 축 — 승인 전이라 후보 상태 그대로 넘어온다 */
function johuCandidates(johu: JohuAssessment): YongsinCandidate[] {
  return johu.candidates.map((c) => ({
    axis: "johu" as const,
    element: c.candidateElement,
    role: c.reason,
    rank: c.priority,
    status: c.status === "approved" ? "approved" : c.status === "blocked" ? "blocked" : "candidate",
    ruleId: c.ruleId,
    sourceIds: c.sourceIds,
    requiredFacts: ["advanced.seasonalContext.climateAxes"],
    reason: `${johu.context.monthBranch}월 · ${johu.context.climateAxes.temperature}/${johu.context.climateAxes.moisture}`,
  }));
}

/**
 * 격국 축.
 *
 * 격이 확정되지 않으면 후보를 내지 않는다. 격국의 용신은 그 격을 이루거나 지키는
 * 상신 쪽에서 나오는데, 상신 표가 자평진전 판본에 기대야 해서 지금은 비어 있다.
 */
function gyeokgukCandidates(gyeokguk: GyeokgukAssessment): YongsinCandidate[] {
  if (gyeokguk.determination !== "determined" || !gyeokguk.primary) return [];
  return [
    {
      axis: "gyeokguk",
      // 격은 섰지만 그 격의 용신(상신)을 정할 표가 없다. 오행을 비워 둔다.
      element: null,
      role: "격을 이루거나 지키는 자리 — 상신",
      rank: "primary",
      status: "blocked",
      ruleId: "ADV-YONGSIN-GYEOKGUK-V1",
      sourceIds: ["SRC-JAPYEONG"],
      requiredFacts: ["advanced.gyeokguk.primary", "advanced.gyeokguk.sangshin"],
      reason: `${gyeokguk.primary.pattern}은 섰지만 상신 표(자평진전 판본)가 확보되지 않아 오행을 정할 수 없다`,
    },
  ];
}

export function assessYongsin(
  chart: SajuChart,
  strengthLabel: "신강" | "중화" | "신약"
): YongsinAssessment {
  const johu = assessJohu(chart);
  const gyeokguk = assessGyeokguk(chart);

  const candidatesByAxis: Record<YongsinAxis, YongsinCandidate[]> = {
    eokbu: eokbuCandidates(chart, strengthLabel),
    johu: johuCandidates(johu),
    gyeokguk: gyeokgukCandidates(gyeokguk),
    // V2 준비. 계산하지 않는다 — 자리만 열어 두고 not_applicable 로 못 박는다.
    tonggwan: [
      {
        axis: "tonggwan",
        element: null,
        role: "상극하는 두 축 사이를 잇는다",
        rank: "supporting",
        status: "not_applicable",
        ruleId: "ADV-YONGSIN-TONGGWAN-V2",
        sourceIds: [],
        requiredFacts: [],
        reason: "V2 준비 — 통관 판정 기준이 정해지지 않았다. 리포트에 쓰지 않는다.",
      },
    ],
    byeongyak: [
      {
        axis: "byeongyak",
        element: null,
        role: "병이 된 자리를 덜어 낸다",
        rank: "supporting",
        status: "not_applicable",
        ruleId: "ADV-YONGSIN-BYEONGYAK-V2",
        sourceIds: [],
        requiredFacts: [],
        reason: "V2 준비 — 병·약 판정의 출처가 정해지지 않았다. 리포트에 쓰지 않는다.",
      },
    ],
  };

  const consensus = judgeConsensus(candidatesByAxis, chart);

  return {
    candidatesByAxis,
    consensus,
    // 정책이 승인되기 전에는 어떤 축도 최종이 되지 않는다.
    finalOutput: { status: consensus.kind === "insufficient_evidence" ? "not_selected" : "candidate_only" },
  };
}

/** 축들이 같은 곳을 가리키는가 */
function judgeConsensus(
  byAxis: Record<YongsinAxis, YongsinCandidate[]>,
  chart: SajuChart
): YongsinAssessment["consensus"] {
  // 살아 있는 후보만 — 오행을 정하지 못했거나(element null) 막힌 것은 세지 않는다.
  const live = (["eokbu", "johu", "gyeokguk"] as YongsinAxis[])
    .map((axis) => ({
      axis,
      primary: byAxis[axis].filter(
        (c) =>
          c.rank === "primary" &&
          c.element !== null &&
          (c.status === "candidate" || c.status === "approved")
      ),
    }))
    .filter((x) => x.primary.length > 0);

  if (live.length === 0) {
    return { elements: [], kind: "insufficient_evidence", reason: "어느 축에서도 후보가 서지 않았다" };
  }
  if (live.length === 1) {
    return {
      elements: [...new Set(live[0].primary.map((c) => c.element!))],
      kind: "insufficient_evidence",
      reason: `${axisLabel(live[0].axis)} 한 축에서만 후보가 섰다 — 한 축만으로 용신을 말하지 않는다`,
    };
  }

  const sets = live.map((x) => new Set(x.primary.map((c) => c.element!)));
  const all = [...new Set(sets.flatMap((s) => [...s]))] as Ohaeng[];
  const shared = all.filter((e) => sets.every((s) => s.has(e)));

  if (shared.length > 0) {
    return {
      elements: shared,
      kind: sets.every((s) => s.size === shared.length) ? "unanimous" : "partial_agreement",
      reason: `${listWithSubject(live.map((x) => axisLabel(x.axis)))} ${shared.join("·")}에서 만난다`,
    };
  }

  // 겹치는 것이 없다. 서로 반대를 가리키는지까지 본다 — 그게 진짜 충돌이다.
  const dayElement = stemElementOf(chart.day.gan);
  const opposing = all.some((a) =>
    all.some(
      (b) =>
        a !== b &&
        // 하나는 일간을 돕고 하나는 일간을 빼내는 자리라면 방향이 반대다
        ((GENERATES[a] === dayElement || a === dayElement) &&
          (GENERATES[dayElement] === b || CONTROLS[dayElement] === b || CONTROLS[b] === dayElement))
    )
  );

  return {
    elements: all,
    kind: "conflict",
    reason: opposing
      ? `${listWithSubject(live.map((x) => axisLabel(x.axis)))} 서로 반대 방향을 가리킨다 (${all.join(", ")})`
      : `축마다 다른 오행을 가리킨다 (${all.join(", ")})`,
  };
}

/** "억부와 조후가" — 마지막 낱말만 주격 조사를 받는다 */
function listWithSubject(words: string[]): string {
  if (words.length === 0) return "";
  const last = words[words.length - 1];
  const head = words.slice(0, -1).map((w) => withJosa(w, "와과"));
  return [...head, withJosa(last, "이가")].join(" ");
}

export function axisLabel(axis: YongsinAxis): string {
  return { eokbu: "억부", johu: "조후", gyeokguk: "격국", tonggwan: "통관", byeongyak: "병약" }[axis];
}
