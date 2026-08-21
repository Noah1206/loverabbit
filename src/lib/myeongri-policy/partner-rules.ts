// 상대 명식으로 상대를 말하는 규칙 — 등재부.
//
// 왜 따로 두는가.
//
// 감사에서 나온 가장 조용한 문제는 환각이 아니라 **무근거**였다. 상대 쪽 검수 규칙이
// 0개인 궁합 리포트가 열두 절 내내 "상대는 자기 기준을 지키는 힘이 있고",
// "관계에서 요구받는 역할을 무겁게 받아들이는 편" 이라고 썼다. 계산값과 어긋나지도
// 않았고 명식에 없는 글자를 부르지도 않았다. 다만 그 판단을 아무도 검수하지 않았다.
//
// 상대는 이 자리에 없는 사람이다. 본인은 자기 이야기가 안 맞으면 안 맞는다고 알지만,
// 상대에 대한 서술은 검증할 사람이 아무도 없는 채로 사용자에게 사실처럼 남는다.
// 그래서 상대를 말하는 규칙은 조건이 계산되는 것만으로는 부족하고, **출처와 어법과
// 금지선이 함께 등재되어야** 켜진다.
//
// status:
//   approved        — 검수 완료. matchRules 에 실려 실제로 켜진다.
//   policy_proposed — 조건은 계산되지만 아직 승인 전. 켜지지 않는다.
//
// 승인의 뜻은 "이 명리가 옳다"가 아니라 **"이 문장이 검증 없이 나가도 되는 범위 안에
// 있다"** 이다. 그래서 아래 규칙의 claim 은 전부 관계의 결까지만 말하고, 상대의
// 사람됨이나 미래 행동으로 넘어가지 않는다. forbidden 이 그 선을 지킨다.

import type { ReadingRule } from "@/lib/reading-rules";

export type PartnerRuleStatus = "approved" | "policy_proposed";

export interface PartnerRuleEntry {
  rule: ReadingRule;
  status: PartnerRuleStatus;
  /** 어느 명리 원리인가 — 검색 가능한 짧은 열쇠 */
  sourceId: string;
  /** 그 원리를 어디서 확인할 수 있는가 */
  sourceLocation: string;
  /** 이 판단이 서려면 반드시 계산돼 있어야 하는 값 */
  requiredFacts: string[];
  /** 승인하면서 무엇을 정했는가 — 나중에 다시 묻지 않게 남긴다 */
  resolution?: string;
  /** 승인 전이라면 무엇이 막고 있는가 */
  blockedBy?: string;
}

// 상대 규칙의 무게는 본인 규칙보다 낮게 둔다.
// 이 리포트를 사는 사람은 본인이고, 상대는 그 사람의 관계 안에서만 등장한다.
// 상대 이야기가 앞자리를 차지하면 자기 리딩을 사서 남의 이야기를 읽게 된다.
const P = { high: 68, mid: 64, low: 60 } as const;

export const PARTNER_RULE_REGISTRY: PartnerRuleEntry[] = [
  {
    status: "approved",
    sourceId: "absent-element-partner",
    sourceLocation:
      "오행 전무(全無) — 천간·지지 본기는 물론 지장간을 열어도 없는 오행. " +
      "암장(暗藏)된 것과 달리 쓸 뿌리 자체가 없는 자리로 본다.",
    requiredFacts: ["partner_saju_facts.absentElements"],
    resolution:
      "'없다'와 '숨어 있다'를 가르는 것으로 막혀 있던 자리를 풀었다. saju-facts 가 " +
      "missingElements(겉으로 안 드러남)와 absentElements(지장간까지 없음)를 나눠 계산하므로, " +
      "이 규칙은 뒤쪽에만 걸린다. 기준 케이스의 상대는 화가 암장, 수가 전무다 — 같은 0인데 다른 자리다.",
    rule: {
      id: "P-ABSENT-ELEMENT",
      priority: P.high,
      when: {
        partnerAbsentElement: ["목", "화", "토", "금", "수"],
        domains: ["sokgunghap", "gunghap", "jaehoe", "gyeolhon", "jjak", "sseom"],
      },
      claim:
        "상대 쪽에 그 기운이 쓸 뿌리째 없어서, 그 결이 필요한 대목에서는 타고나서가 아니라 " +
        "배워서 하게 되고 그래서 반응이 한 박자 늦는 구조",
      safePhrasing: "그 자리가 비어 있는",
      forbidden: [
        "상대는 그 능력이 없다",
        "상대는 못 한다",
        "상대가 부족하다",
        "상대는 감정이 없다",
        "고칠 수 없다",
      ],
      source: "오행 전무 — 지장간까지 없는 오행은 쓸 뿌리가 없는 자리로 본다.",
    },
  },
  {
    status: "approved",
    sourceId: "hidden-element-partner",
    sourceLocation:
      "암장(暗藏) — 지장간에만 있고 천간·지지 본기로 드러나지 않은 오행. " +
      "있기는 하나 평소에 안 쓰이고, 운에서 그 글자가 오면 그때 드러난다고 본다.",
    requiredFacts: ["partner_saju_facts.hiddenOnlyElements", "partner_saju_facts.elementBalance"],
    resolution: "위와 같은 갈래에서 앞쪽. '없다'가 아니라 '안 쓰인다'로만 말한다.",
    rule: {
      id: "P-HIDDEN-ELEMENT",
      priority: P.mid,
      when: {
        partnerHiddenOnlyElement: ["목", "화", "토", "금", "수"],
        domains: ["sokgunghap", "gunghap", "jaehoe", "gyeolhon", "jjak", "sseom"],
      },
      claim:
        "상대 안에 있기는 한데 평소에 꺼내 쓰지 않는 결이라, 그것이 나올 때와 안 나올 때의 " +
        "차이가 커서 같은 사람인데 다르게 보이는 구조",
      safePhrasing: "숨어 있다가 드러나는",
      forbidden: ["이중인격이다", "속을 숨긴다", "거짓말을 한다", "본심은 따로 있다"],
      source: "암장 — 지장간에만 있는 오행은 평소 안 쓰이다가 때가 오면 드러나는 자리로 본다.",
    },
  },
  {
    status: "approved",
    sourceId: "pair-element-complement",
    sourceLocation:
      "오행 보완 — 한쪽에 옅은 오행을 다른 쪽이 갖고 있으면 그 자리를 대신 맡게 된다고 보는 통설.",
    requiredFacts: ["saju_facts.elementBalance", "partner_saju_facts.elementBalance"],
    resolution:
      "'서로 메운다'를 궁합의 좋음으로 옮기는 근거가 없다는 것이 막고 있던 이유였다. " +
      "그래서 좋음으로 옮기지 않기로 정했다. claim 은 **누가 어느 자리를 맡게 되는가**까지만 " +
      "말하고, 천생연분·완벽한 궁합은 forbidden 에 넣어 막는다. 메우는 것은 편한 것과 다르다 — " +
      "한쪽이 늘 그 역할을 지는 구조이기도 하다.",
    rule: {
      id: "P-ELEMENT-COMPLEMENT",
      priority: P.mid,
      when: {
        pairElementComplement: ["목", "화", "토", "금", "수"],
        domains: ["sokgunghap", "gunghap", "gyeolhon", "jjak"],
      },
      claim:
        "한쪽에 옅은 자리를 다른 쪽이 대신 맡게 되는 구조. 편해지는 만큼 그 역할이 " +
        "한 사람에게 고정되기도 하는 자리",
      safePhrasing: "그렇게 나눠 맡는",
      forbidden: [
        "천생연분이다",
        "완벽한 궁합이다",
        "서로 없으면 안 된다",
        "운명적인 만남이다",
      ],
      source: "오행 보완 — 한쪽의 결을 다른 쪽의 왕이 메운다. 좋고 나쁨으로 옮기지 않는다.",
    },
  },
  {
    status: "approved",
    sourceId: "pair-month-branch-clash",
    sourceLocation: "궁위 — 월지는 사회 자리다. 두 명식의 월지가 부딪히는 것은 바깥에서의 어긋남으로 본다.",
    requiredFacts: ["saju_facts.fourPillars.month", "partner_saju_facts.fourPillars.month"],
    resolution:
      "월지 궁합의 무게를 일지와 어떻게 나눌지가 막고 있던 이유였다. **일지 아래로 둔다**로 정했다 — " +
      "우선순위를 60으로 두어 PAIR-*(88~92)와 XING-SPOUSE-PALACE(86)보다 확실히 뒤에 선다. " +
      "배우자 자리가 먼저고 사회 자리는 그다음이라는 뜻이 숫자에 들어가 있다.",
    rule: {
      id: "P-MONTH-BRANCH-CLASH",
      priority: P.low,
      when: {
        pairMonthBranchRelation: ["충", "원진"],
        domains: ["sokgunghap", "gunghap", "jaehoe", "gyeolhon", "jjak"],
      },
      claim:
        "두 사람이 바깥에서 서 있는 자리가 어긋나, 둘만 있을 때보다 사람들 사이에 있을 때 " +
        "속도와 우선순위가 더 크게 갈리는 구조",
      safePhrasing: "밖에서 더 어긋나는",
      forbidden: [
        "사회적으로 안 맞는다",
        "주변이 반대한다",
        "결혼하면 안 된다",
        "일 때문에 헤어진다",
      ],
      source: "궁위 — 월지는 사회 자리. 그 자리의 충·원진은 바깥에서의 어긋남으로 본다.",
    },
  },
  {
    status: "approved",
    sourceId: "pair-month-branch-harmony",
    sourceLocation: "궁위 — 월지끼리 합을 이루면 바깥에서의 결이 맞는다고 본다. 위 규칙의 반대쪽.",
    requiredFacts: ["saju_facts.fourPillars.month", "partner_saju_facts.fourPillars.month"],
    resolution: "위와 같은 자리. 어긋남만 말하고 맞음을 안 말하면 리딩이 한쪽으로만 기운다.",
    rule: {
      id: "P-MONTH-BRANCH-HARMONY",
      priority: P.low,
      when: {
        pairMonthBranchRelation: ["육합", "삼합"],
        domains: ["sokgunghap", "gunghap", "gyeolhon", "jjak", "sseom"],
      },
      claim:
        "바깥에서 서 있는 자리가 서로 맞아, 사람들 사이에서의 속도와 예의가 자연스럽게 " +
        "같은 방향을 보는 구조",
      safePhrasing: "밖에서 잘 맞는",
      forbidden: ["최고의 궁합이다", "다툴 일이 없다", "결혼하면 잘 산다"],
      source: "궁위 — 월지의 합은 사회 자리에서의 맞음으로 본다.",
    },
  },
  {
    status: "approved",
    sourceId: "partner-spouse-palace",
    sourceLocation:
      "궁위 + 십성 — 일지는 배우자궁이다. 그 자리에 앉은 십성은 그 사람이 가까운 관계에서 " +
      "무엇을 먼저 놓고 보는지를 나타낸다고 본다. 본인 쪽으로는 SPOUSE-STAR-F/M 가 이미 쓰는 원리다.",
    requiredFacts: ["partner_saju_facts.tenGods.일지"],
    resolution:
      "본인에게 이미 쓰는 원리를 상대에게 쓰는 것이라 새 명리가 아니다. 다만 상대 쪽은 " +
      "확인할 사람이 없으므로, 성격이 아니라 **관계에서 무엇을 먼저 보는지**까지만 말한다.",
    rule: {
      id: "P-SPOUSE-PALACE",
      priority: P.high,
      when: {
        partnerDayBranchTenGod: ["정관", "편관", "정재", "편재", "식신", "상관", "정인", "편인", "비견", "겁재"],
        domains: ["sokgunghap", "gunghap", "jaehoe", "gyeolhon", "jjak", "insun"],
      },
      claim:
        "상대의 배우자 자리에 앉은 기운이 있어, 가까운 사이에서 상대가 먼저 확인하려는 것이 " +
        "따로 있는 구조. 두 사람이 중요하게 여기는 순서가 어긋나기 쉬운 자리",
      safePhrasing: "먼저 보는 것이 다른",
      forbidden: [
        "상대는 당신을 사랑하지 않는다",
        "상대는 바람을 피운다",
        "상대의 성격이 나쁘다",
        "상대는 변하지 않는다",
      ],
      source: "궁위 + 십성 — 일지는 배우자궁. 그 자리의 십성으로 가까운 관계에서의 우선순위를 본다.",
    },
  },
  {
    status: "approved",
    sourceId: "partner-luck-inseong",
    sourceLocation:
      "십성 + 운 — 인성운은 안으로 거두는 흐름이다. 배우는 것·기대는 것·혼자 정리하는 것이 " +
      "늘고, 밖으로 내는 표현은 준다고 본다. 본인 쪽으로는 LUCK-IN 이 이미 쓰는 원리다.",
    requiredFacts: ["partner_saju_facts.luckContext"],
    resolution:
      "상대의 운을 말하는 것은 상대의 성격을 말하는 것보다 안전하다 — 사람됨이 아니라 " +
      "지나가는 구간이기 때문이다. 다만 그 구간에 상대가 무엇을 할지는 말하지 않는다.",
    rule: {
      id: "P-LUCK-INSEONG",
      priority: P.mid,
      when: {
        partnerLuckTenGodAny: ["정인", "편인"],
        domains: ["sokgunghap", "gunghap", "jaehoe", "gyeolhon", "insun", "hwanseung"],
      },
      claim:
        "상대가 지금 안으로 거두는 흐름을 지나고 있어, 말수와 연락이 줄어드는 것이 " +
        "마음의 변화가 아니라 구간의 성질일 수 있는 때",
      safePhrasing: "지금 그런 구간을 지나는",
      forbidden: [
        "상대가 연락할 것이다",
        "상대의 마음이 식었다",
        "상대는 지금 다른 사람을 만난다",
        "기다리면 돌아온다",
      ],
      source: "십성 + 운 — 인성운은 안으로 거두는 흐름. 표현이 줄고 정리하는 시간이 는다.",
    },
  },
  {
    status: "approved",
    sourceId: "pair-strength-gap",
    sourceLocation:
      "억부 — 두 명식의 강약 차이. 한쪽이 자기 힘을 오래 유지하고 다른 쪽이 그렇지 못하면, " +
      "관계의 속도와 결정권이 한쪽으로 기운다고 본다.",
    requiredFacts: ["saju_facts.strength.label", "partner_saju_facts.strength.label"],
    resolution:
      "강약은 P2 정책 논의가 남아 있는 자리다. 그래서 이 규칙은 **점수를 쓰지 않고 라벨만** " +
      "쓴다. 라벨은 지금 판정 그대로이고 P2 가 승인돼도 바뀌지 않기로 되어 있다.",
    rule: {
      id: "P-STRENGTH-GAP",
      priority: P.mid,
      when: {
        strength: ["신약"],
        partnerStrength: ["신강", "중화"],
        domains: ["sokgunghap", "gunghap", "jaehoe", "gyeolhon", "jjak"],
      },
      claim:
        "자기 힘을 오래 끌고 가는 쪽과 그렇지 못한 쪽이 만나, 관계의 속도를 한쪽이 정하고 " +
        "다른 쪽이 맞추는 모양이 되기 쉬운 구조",
      safePhrasing: "그렇게 기우는",
      forbidden: [
        "상대가 갑이다",
        "당신이 약자다",
        "이용당한다",
        "끌려다닌다",
        "헤어지는 게 낫다",
      ],
      source: "억부 — 두 명식의 강약 차이는 관계의 속도와 결정권의 기울기로 본다.",
    },
  },
  {
    status: "approved",
    sourceId: "partner-dominant-tengod",
    sourceLocation:
      "십성 — 명식에 가장 많이 나온 십성은 그 사람이 기본으로 쓰는 결로 본다. " +
      "본인 쪽으로는 TG-* 열한 규칙이 이미 쓰는 원리다.",
    requiredFacts: ["partner_saju_facts.dominantTenGods"],
    resolution:
      "본인에게 쓰는 원리를 상대에게 옮기는 것이라 새 명리가 아니다. 다만 상대 쪽은 " +
      "'그 사람이 이런 사람이다'로 넘어가기 쉬워서, claim 을 **두 사람 사이에서 그 결이 " +
      "어떻게 부딪히는가**로만 묶었다. 상대 혼자를 설명하는 문장이 되지 않게 한다.",
    rule: {
      id: "P-DOMINANT-TENGOD",
      priority: P.high,
      when: {
        partnerDominantTenGod: [
          "정관", "편관", "정재", "편재", "식신", "상관", "정인", "편인", "비견", "겁재",
        ],
        domains: ["sokgunghap", "gunghap", "jaehoe", "gyeolhon", "jjak", "insun"],
      },
      claim:
        "상대가 기본으로 쓰는 결이 따로 있어, 같은 상황에서 두 사람이 먼저 꺼내는 카드가 " +
        "달라지는 구조. 어느 쪽이 옳아서가 아니라 손에 익은 것이 달라서 갈리는 자리",
      safePhrasing: "손에 익은 것이 다른",
      forbidden: [
        "상대는 이기적이다",
        "상대의 성격이 나쁘다",
        "상대는 안 바뀐다",
        "상대는 당신을 사랑하지 않는다",
      ],
      source: "십성 — 두드러진 십성은 그 사람이 기본으로 쓰는 결로 본다.",
    },
  },
  {
    status: "approved",
    sourceId: "partner-shinsal",
    sourceLocation:
      "신살 — 도화·홍염·역마·화개·양인·원진. 본인 쪽으로는 SIN-* 여섯 규칙이 이미 쓰는 원리이고, " +
      "계산은 saju-shinsal.ts 가 자리까지 낸다.",
    requiredFacts: ["partner_saju_facts.shinsal"],
    resolution:
      "신살은 이름이 세서 상대 쪽에 붙이면 낙인이 되기 쉽다(도화 → 바람기). 그래서 " +
      "**관계 안에서 드러나는 결까지만** 말하고, 사람됨이나 행실로 넘어가는 말을 전부 " +
      "forbidden 에 넣었다. 이름은 계산에 있는 것만 쓰고 자리를 옮기지 않는다.",
    rule: {
      id: "P-SHINSAL",
      priority: P.mid,
      when: {
        partnerShinsal: ["도화", "홍염", "역마", "화개", "양인", "원진"],
        domains: ["sokgunghap", "gunghap", "jaehoe", "gyeolhon", "jjak", "sseom"],
      },
      claim:
        "상대 명식에도 관계에서 도드라지는 자리가 있어, 두 사람이 같은 장면에서 서로 다른 " +
        "지점에 반응하게 되는 구조",
      safePhrasing: "그 자리가 도드라지는",
      forbidden: [
        "상대는 바람을 피운다",
        "상대는 이성이 많다",
        "상대는 떠난다",
        "상대는 외롭게 산다",
        "상대는 위험하다",
      ],
      source: "신살 — 계산된 이름과 자리만 쓰고, 관계에서 드러나는 결까지만 읽는다.",
    },
  },
  {
    status: "approved",
    sourceId: "partner-relation-bundle",
    sourceLocation:
      "형충회합 — 한 자리에 합과 형이 함께 걸리면 붙드는 힘과 걸리는 힘이 같은 곳에서 나온다. " +
      "본인 쪽으로는 relationBundles 가 이미 그렇게 읽는다.",
    requiredFacts: ["partner_saju_facts.relationBundles"],
    resolution: "본인에게 쓰는 읽기를 상대에게 그대로 쓰는 것이라 새 명리가 아니다.",
    rule: {
      id: "P-RELATION-BUNDLE",
      priority: P.low,
      when: {
        partnerRelationBundle: ["합+형", "충+형"],
        domains: ["sokgunghap", "gunghap", "jaehoe", "gyeolhon"],
      },
      claim:
        "상대 쪽에도 붙드는 힘과 걸리는 결이 같은 자리에서 나오는 대목이 있어, " +
        "두 사람이 같은 방식으로 못 놓고 같은 방식으로 지치는 구조",
      safePhrasing: "서로 닮은 자리에서 걸리는",
      forbidden: ["둘 다 문제가 있다", "만나면 안 되는 사이다", "서로를 망친다"],
      source: "형충회합 — 한 자리에 겹친 합과 형은 하나의 결로 읽는다.",
    },
  },
];

/** 실제로 켜지는 상대 규칙 */
export function approvedPartnerRules(): ReadingRule[] {
  return PARTNER_RULE_REGISTRY.filter((entry) => entry.status === "approved").map((entry) => entry.rule);
}

/** 승인을 기다리는 것 — 리포트에 무엇이 빠져 있는지 사람이 볼 수 있게 */
export function pendingPartnerRules(): PartnerRuleEntry[] {
  return PARTNER_RULE_REGISTRY.filter((entry) => entry.status !== "approved");
}

/** 이 id 가 상대를 말하는 규칙인가 — matchRules 가 자리를 남겨 둘 때 쓴다 */
const PARTNER_RULE_IDS = new Set(PARTNER_RULE_REGISTRY.map((entry) => entry.rule.id));

export function isPartnerRule(id: string): boolean {
  return PARTNER_RULE_IDS.has(id) || id.startsWith("PAIR-");
}
