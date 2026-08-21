// 격국(格局) V1 — 월지 중심 내격 후보까지만.
//
// 이 파일이 하지 않는 일이 하는 일보다 중요하다.
//
// 외격·종격·화기격은 이례 조건과 학설 차이가 크다. "종강격이다" 를 자동으로 붙이면
// 그 한 줄이 리포트 전체의 어조를 정하는데, 그 판정의 근거는 유파마다 다르다.
// 그래서 V1은 그것들을 unsupported 로 돌려준다. 모르는 것을 모른다고 하는 편이
// 그럴듯한 이름을 붙이는 것보다 낫다 — 이름이 붙는 순간 아무도 다시 안 묻는다.
//
// 내격도 확정하지 않는다. 후보를 내고, 후보가 둘 이상이면 ambiguous 다.
// 월지 본기가 투간했는가, 통근했는가, 합충으로 깨졌는가를 근거로 함께 낸다.
//
// 격국 이름 하나로 직업·배우자·재회·부귀를 말하지 않는다. 그건 이 층이 할 수 있는
// 일의 범위 밖이고, 그렇게 쓰는 순간 사주가 점이 된다.

import { CHEONGAN, JIJI, type Ohaeng, type SajuChart } from "@/lib/saju";
import { hiddenStemsOf, stemElementOf, stemPolarity, type HiddenStemRole } from "@/lib/myeongri/hidden-stems";
import { tenGodOf } from "@/lib/saju-facts";
import { BRANCH_CLASHES, BRANCH_SIX_COMBOS } from "@/lib/saju-facts";
import { CALCULATION_POLICY_VERSION } from "@/lib/myeongri/policy";

export type GyeokgukFamily = "inner" | "outer" | "follow" | "transformation" | "special";
export type GyeokgukStatus = "calculated_only" | "source_attached" | "approved";

export interface GyeokgukCandidate {
  /** 격의 이름 — 내격은 십성 이름을 그대로 쓴다 (정관격, 편재격 ...) */
  pattern: string;
  family: GyeokgukFamily;
  confidence: "high" | "medium" | "low";
  /** 왜 이 후보가 섰는가 — 사람이 읽는 근거 줄 */
  basis: string[];
  requiredFacts: string[];
  ruleId: string;
  sourceIds: string[];
  safePhrasing: string[];
}

export interface GyeokgukAssessment {
  determination: "determined" | "ambiguous" | "unsupported";
  primary: GyeokgukCandidate | null;
  candidates: GyeokgukCandidate[];
  exclusions: Array<{ pattern: string; reason: string }>;
  monthlyCommand: {
    branch: string;
    hiddenStems: Array<{ stem: string; tier: HiddenStemRole }>;
    tenGodsToDayMaster: string[];
    /** 월지 지장간 중 천간에 드러난 것 */
    exposed: Array<{ stem: string; tier: HiddenStemRole; atPositions: string[] }>;
    /** 월지가 합·충으로 흔들렸는가 — 격이 깨지는 자리 */
    disturbed: Array<{ kind: "충" | "육합"; with: string; atPosition: string }>;
  };
  status: GyeokgukStatus;
  calculationPolicyVersion: string;
}

/** 상신 — 격을 돕거나 손상하는 것. 격의 존재와 섞지 않는다. */
export interface SangshinCandidate {
  elementOrTenGod: string;
  function: "protect" | "assist" | "counter" | "damage";
  ruleId: string;
  sourceIds: string[];
  status: "candidate" | "approved" | "blocked";
  reason: string;
}

/** 순용(順用)할 격인가 역용(逆用)할 격인가 — 자평진전 계열의 갈래 */
export interface GyeokOperation {
  operation: "obey" | "counter" | "unknown";
  ruleId: string;
  sourceIds: string[];
  status: "candidate" | "approved" | "blocked";
  reason: string;
}

const RULE_INNER = "ADV-GYEOK-INNER-V1";
const RULE_OUTER = "ADV-GYEOK-OUTER-UNSUPPORTED-V1";
const SRC_INNER = ["SRC-JAPYEONG", "SRC-ACADEMIC-2013-WOLJI"];

/** 내격이 서는 십성 — 비견·겁재는 월지로 격을 삼지 않는 것이 통례다 */
const INNER_TEN_GODS = new Set([
  "정관", "편관", "정재", "편재", "식신", "상관", "정인", "편인",
]);

const POSITION_OF_STEM = ["연간", "월간", "일간", "시간"];

export function assessGyeokguk(chart: SajuChart): GyeokgukAssessment {
  const dayElement = stemElementOf(chart.day.gan);
  const dayYang = stemPolarity(chart.day.gan) === "yang";
  const monthBranch = chart.month.ji;
  const hidden = hiddenStemsOf(chart.month.jiIdx);

  const pillars = [chart.year, chart.month, chart.day, chart.hour];
  const stemsAt = new Map<string, string[]>();
  pillars.forEach((pillar, i) => {
    if (!pillar) return;
    const list = stemsAt.get(pillar.gan) ?? [];
    list.push(POSITION_OF_STEM[i]);
    stemsAt.set(pillar.gan, list);
  });

  const tenGodOfStem = (stem: string) =>
    tenGodOf(dayElement, dayYang, stemElementOf(stem), stemPolarity(stem) === "yang");

  const exposed = hidden
    .filter((h) => stemsAt.has(h.stem))
    // 일간 자신은 투간으로 세지 않는다 — 자기가 자기 격의 근거가 될 수 없다.
    .map((h) => ({
      stem: h.stem,
      tier: h.role,
      atPositions: (stemsAt.get(h.stem) ?? []).filter((p) => p !== "일간"),
    }))
    .filter((h) => h.atPositions.length > 0);

  const disturbed = monthDisturbance(chart);

  const monthlyCommand: GyeokgukAssessment["monthlyCommand"] = {
    branch: monthBranch,
    hiddenStems: hidden.map((h) => ({ stem: h.stem, tier: h.role })),
    tenGodsToDayMaster: hidden.map((h) => tenGodOfStem(h.stem)),
    exposed,
    disturbed,
  };

  const exclusions: GyeokgukAssessment["exclusions"] = [
    {
      pattern: "외격·종격·화기격",
      reason:
        "V1에서는 판정하지 않는다. 성립 조건과 학설 차이가 커서, 자동으로 이름을 붙이면 " +
        "그 한 줄이 리포트 전체의 어조를 정해 버린다. 출처와 기준이 승인된 뒤 V2에서 연다.",
    },
    {
      pattern: "건록격·양인격",
      reason:
        "월지가 비견·겁재인 경우다. 십성으로 격을 삼지 않는 통례를 따르되, " +
        "따로 다루는 유파가 있어 V1에서는 후보를 세우지 않는다.",
    },
  ];

  const candidates: GyeokgukCandidate[] = [];

  for (const h of hidden) {
    const tenGod = tenGodOfStem(h.stem);
    if (!INNER_TEN_GODS.has(tenGod)) continue;

    const isExposed = exposed.some((e) => e.stem === h.stem);
    // 본기가 투간하면 가장 뚜렷하고, 본기만 있으면 그다음, 중기·여기가 투간 없이
    // 서는 것은 근거가 얇다. 이 셋을 confidence 로 나눈다 — 점수로 뭉개지 않는다.
    const confidence: GyeokgukCandidate["confidence"] =
      h.role === "main" && isExposed ? "high" : h.role === "main" ? "medium" : isExposed ? "medium" : "low";

    const basis = [
      `월지 ${monthBranch}의 지장간 ${h.stem}(${roleLabel(h.role)})가 일간 ${chart.day.gan}에게 ${tenGod}`,
      isExposed
        ? `${h.stem}이 ${exposed.find((e) => e.stem === h.stem)!.atPositions.join(",")}에 투간했다`
        : `${h.stem}은 천간에 드러나지 않았다`,
    ];
    if (disturbed.length > 0) {
      basis.push(
        `월지가 ${disturbed.map((d) => `${d.with}${d.kind}(${d.atPosition})`).join(", ")}으로 흔들린다 — 격이 온전하지 않을 수 있다`
      );
    }

    candidates.push({
      pattern: `${tenGod}격`,
      family: "inner",
      confidence,
      basis,
      requiredFacts: [
        "advanced.gyeokguk.monthlyCommand.hiddenStems",
        "advanced.gyeokguk.monthlyCommand.exposed",
      ],
      ruleId: RULE_INNER,
      sourceIds: SRC_INNER,
      safePhrasing: ["이 명식에서 월령이 가리키는 결", "구조로 보면 그쪽에 가까운"],
    });
  }

  if (candidates.length === 0) {
    exclusions.push({
      pattern: "내격",
      reason: `월지 ${monthBranch}의 지장간이 일간에게 비견·겁재뿐이라 내격 후보가 서지 않는다`,
    });
  }

  // 가장 뚜렷한 후보 하나만 남는가. 둘 이상이 같은 무게로 서면 ambiguous 다.
  const ranked = [...candidates].sort(
    (a, b) => weight(b.confidence) - weight(a.confidence) || a.pattern.localeCompare(b.pattern)
  );
  const top = ranked[0] ?? null;
  const tiedAtTop = ranked.filter((c) => c.confidence === top?.confidence);

  let determination: GyeokgukAssessment["determination"];
  if (!top) {
    determination = "unsupported";
  } else if (tiedAtTop.length > 1 || top.confidence === "low") {
    // 정책이 우선순위를 승인하기 전에는 동률을 임의로 깨지 않는다.
    determination = "ambiguous";
  } else if (disturbed.length > 0 && top.confidence !== "high") {
    determination = "ambiguous";
  } else {
    determination = "determined";
  }

  return {
    determination,
    primary: determination === "determined" ? top : null,
    candidates: ranked,
    exclusions,
    monthlyCommand,
    // 출처가 metadata_only 뿐이라 계산까지다. source-registry 가 이 상태를 정한다.
    status: "calculated_only",
    calculationPolicyVersion: CALCULATION_POLICY_VERSION,
  };
}

function weight(c: GyeokgukCandidate["confidence"]): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

function roleLabel(role: HiddenStemRole): string {
  return role === "main" ? "본기" : role === "middle" ? "중기" : "여기";
}

/** 월지가 다른 자리와 충·합으로 얽혔는가 */
function monthDisturbance(chart: SajuChart): GyeokgukAssessment["monthlyCommand"]["disturbed"] {
  const month = chart.month.jiIdx;
  const others: Array<{ idx: number; position: string }> = [
    { idx: chart.year.jiIdx, position: "연지" },
    { idx: chart.day.jiIdx, position: "일지" },
  ];
  if (chart.hour) others.push({ idx: chart.hour.jiIdx, position: "시지" });

  const out: GyeokgukAssessment["monthlyCommand"]["disturbed"] = [];
  for (const other of others) {
    const pair = (table: [number, number][]) =>
      table.some(([a, b]) => (a === month && b === other.idx) || (b === month && a === other.idx));
    if (pair(BRANCH_CLASHES)) {
      out.push({ kind: "충", with: JIJI[other.idx], atPosition: other.position });
    } else if (pair(BRANCH_SIX_COMBOS)) {
      out.push({ kind: "육합", with: JIJI[other.idx], atPosition: other.position });
    }
  }
  return out;
}

/**
 * 상신과 순역.
 *
 * 자평진전은 격에 따라 순용할지 역용할지를 가르고, 그 격을 지키거나 이루는 글자를
 * 상신으로 본다. 그 갈래는 판본과 주석에 기대야 하는데 지금 출처가 metadata_only 라
 * 표를 채울 수 없다. **비워 두는 것이 지금 할 수 있는 정직한 일이다.**
 */
export function sangshinCandidates(assessment: GyeokgukAssessment): SangshinCandidate[] {
  if (assessment.determination !== "determined") return [];
  return [];
}

export function gyeokOperation(assessment: GyeokgukAssessment): GyeokOperation {
  return {
    operation: "unknown",
    ruleId: "ADV-GYEOK-OPERATION-V1",
    sourceIds: ["SRC-JAPYEONG"],
    status: "blocked",
    reason:
      assessment.determination === "determined"
        ? "격은 섰지만 순용·역용의 갈래는 자평진전 판본이 확보되지 않아 정할 수 없다"
        : "격이 확정되지 않아 순용·역용을 물을 자리가 아니다",
  };
}

/** 외격 계열을 왜 안 보는지 — 관리 화면이 그대로 보여 준다 */
export const OUTER_PATTERN_NOTE = {
  ruleId: RULE_OUTER,
  families: ["outer", "follow", "transformation", "special"] as GyeokgukFamily[],
  status: "unsupported" as const,
  reason:
    "종격·화기격은 일간이 뿌리를 아주 잃었거나 합화가 성립했을 때만 서는데, " +
    "그 '아주'의 기준이 유파마다 다르다. 기준을 정하지 않은 채 판정하면 " +
    "가장 큰 결론이 가장 얇은 근거 위에 서게 된다.",
};

/** 지지 이름 -> 색인 (표 다룰 때) */
export function branchIdx(name: string): number {
  return JIJI.indexOf(name as (typeof JIJI)[number]);
}

/** 천간 이름 -> 오행 (외부에서 쓸 때) */
export function stemOhaeng(stem: string): Ohaeng {
  return stemElementOf(stem);
}

export { CHEONGAN };
