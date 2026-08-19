// 검수된 해석 규칙 — 계산값과 문장 사이에 놓이는 층.
//
// 지금까지는 saju_facts를 그대로 모델에 넘기고 "알아서 번역해"라고 맡겼다.
// 그러면 같은 명식이 매번 다른 근거로 읽히고, 무엇을 말해도 되는지의 경계가
// 모델의 그날 기분에 달린다. 여기서 조건 -> 주장 -> 금지선을 미리 못박는다.
//
// 규칙 하나는 이렇게 읽는다.
//   when       어떤 계산값일 때 켜지는가
//   claim      그때 말해도 되는 것 (중립 서술 — 예언이 아니다)
//   safePhrasing  그 주장을 감쌀 어법
//   forbidden  그 규칙을 빌미로 넘어가면 안 되는 선. reading-guard가 그대로 검사한다.
//   source     근거를 남겨 나중에 고치기 쉽게
//
// ⚠ 검수 전제: 아래 문안은 초안이다. 명리 검수를 거친 뒤 source를 채워 확정한다.
//   판단이 바뀌면 claim만 고치면 되고, 화면·프롬프트는 손대지 않아도 된다.

import type { Ohaeng } from "./saju";
import { CHEONGAN, JIJI } from "./saju";
import {
  BRANCH_CLASHES,
  BRANCH_SIX_COMBOS,
  BRANCH_TRIPLES,
  HEAVENLY_COMBOS,
  type SajuFacts,
} from "./saju-facts";
import { WONJIN, type ShinsalName } from "./saju-shinsal";

export type PairRelation = "일지육합" | "일지삼합" | "일지충" | "일지원진" | "일간합";

export interface RuleCondition {
  dayMasterElement?: Ohaeng[];
  strength?: ("신강" | "중화" | "신약")[];
  /** 하나라도 있으면 켜진다 */
  shinsal?: ShinsalName[];
  /** dominantTenGods에 하나라도 있으면 */
  tenGodAny?: string[];
  missingElement?: Ohaeng[];
  relationKind?: ("천간합" | "지지충" | "지지육합" | "삼합")[];
  /** 대운·세운 십성 */
  luckTenGodAny?: string[];
  /** 두 명식 사이의 관계 */
  pairRelation?: PairRelation[];
  /** 상대 명식이 있어야만 켜지는 규칙 */
  needsPartner?: boolean;
  /** 시주가 없을 때만 켜지는 규칙 */
  hourUnknown?: boolean;
  /** 특정 상품에서만 */
  domains?: string[];
}

export interface ReadingRule {
  id: string;
  /** 높을수록 먼저 실린다 */
  priority: number;
  when: RuleCondition;
  claim: string;
  safePhrasing: string;
  forbidden: string[];
  source: string;
}

const NOTE = "내부 명리 검수 노트 v1 (검수 전 초안)";

export const READING_RULES: ReadingRule[] = [
  // ── 일간 오행 × 강약 ────────────────────────────────────
  {
    id: "SELF-FIRE-WEAK",
    priority: 80,
    when: { dayMasterElement: ["화"], strength: ["신약"] },
    claim: "관계의 온도를 먼저 확인한 뒤에야 마음을 여는 경향",
    safePhrasing: "그렇게 굴러온 결",
    forbidden: ["먼저 연락하면 반드시 실패한다"],
    source: NOTE,
  },
  {
    id: "SELF-FIRE-STRONG",
    priority: 78,
    when: { dayMasterElement: ["화"], strength: ["신강"] },
    claim: "감정이 빠르게 붙고 빠르게 식는 진폭이 큰 편",
    safePhrasing: "그런 쪽으로 기울기 쉬운",
    forbidden: ["금방 질려서 헤어진다"],
    source: NOTE,
  },
  {
    id: "SELF-WATER-WEAK",
    priority: 80,
    when: { dayMasterElement: ["수"], strength: ["신약"] },
    claim: "상대의 기분을 먼저 읽느라 자기 요구를 늦게 꺼내는 경향",
    safePhrasing: "그렇게 되기 쉬운 자리",
    forbidden: ["항상 이용당한다"],
    source: NOTE,
  },
  {
    id: "SELF-WATER-STRONG",
    priority: 78,
    when: { dayMasterElement: ["수"], strength: ["신강"] },
    claim: "속내를 여러 겹으로 두고 필요한 만큼만 내보이는 편",
    safePhrasing: "그런 방식이 익숙한",
    forbidden: ["거짓말을 잘한다"],
    source: NOTE,
  },
  {
    id: "SELF-WOOD-WEAK",
    priority: 80,
    when: { dayMasterElement: ["목"], strength: ["신약"] },
    claim: "시작할 힘은 있으나 밀어붙일 근거가 부족해 자주 멈추는 구조",
    safePhrasing: "그럴 수 있는 결",
    forbidden: ["끝까지 못 간다"],
    source: NOTE,
  },
  {
    id: "SELF-WOOD-STRONG",
    priority: 78,
    when: { dayMasterElement: ["목"], strength: ["신강"] },
    claim: "관계에서 방향을 먼저 정하고 상대를 그쪽으로 이끄는 편",
    safePhrasing: "그런 자리에 서기 쉬운",
    forbidden: ["상대를 지배한다"],
    source: NOTE,
  },
  {
    id: "SELF-METAL-WEAK",
    priority: 80,
    when: { dayMasterElement: ["금"], strength: ["신약"] },
    claim: "기준은 분명한데 그 기준을 말로 세우지 못해 속으로 삼키는 경향",
    safePhrasing: "그렇게 쌓이기 쉬운",
    forbidden: ["결국 폭발해서 관계가 끝난다"],
    source: NOTE,
  },
  {
    id: "SELF-METAL-STRONG",
    priority: 78,
    when: { dayMasterElement: ["금"], strength: ["신강"] },
    claim: "선이 분명하고 그 선을 넘는 상대에게 단호해지는 편",
    safePhrasing: "그런 쪽으로 반응하기 쉬운",
    forbidden: ["차가워서 사랑받지 못한다"],
    source: NOTE,
  },
  {
    id: "SELF-EARTH-WEAK",
    priority: 80,
    when: { dayMasterElement: ["토"], strength: ["신약"] },
    claim: "품으려는 마음이 앞서 자기 자리를 좁히는 경향",
    safePhrasing: "그렇게 되기 쉬운",
    forbidden: ["호구가 된다"],
    source: NOTE,
  },
  {
    id: "SELF-EARTH-STRONG",
    priority: 78,
    when: { dayMasterElement: ["토"], strength: ["신강"] },
    claim: "속도를 늦추고 오래 지켜본 뒤에 움직이는 편",
    safePhrasing: "그런 리듬을 가진",
    forbidden: ["기회를 반드시 놓친다"],
    source: NOTE,
  },
  {
    id: "SELF-BALANCED",
    priority: 60,
    when: { strength: ["중화"] },
    claim: "한쪽으로 크게 기울지 않아 상황에 맞춰 태도를 바꿀 수 있는 구조",
    safePhrasing: "폭이 넓은 편",
    forbidden: ["아무 문제가 없다"],
    source: NOTE,
  },

  // ── 없는 오행 ───────────────────────────────────────────
  {
    id: "MISS-FIRE",
    priority: 72,
    when: { missingElement: ["화"] },
    claim: "확신을 데워주는 기운이 비어 있어 답을 알고도 발이 늦는 구조",
    safePhrasing: "그런 자리",
    forbidden: ["평생 연애를 못 한다"],
    source: NOTE,
  },
  {
    id: "MISS-WATER",
    priority: 72,
    when: { missingElement: ["수"] },
    claim: "유연하게 흘려보내는 기운이 없어 한 번 걸린 감정을 오래 쥐는 편",
    safePhrasing: "그렇게 되기 쉬운",
    forbidden: ["집착증이 있다"],
    source: NOTE,
  },
  {
    id: "MISS-WOOD",
    priority: 70,
    when: { missingElement: ["목"] },
    claim: "먼저 뻗어나가는 기운이 약해 관계를 시작하는 쪽에 서기 어려운 구조",
    safePhrasing: "그런 편",
    forbidden: ["먼저 고백하면 안 된다"],
    source: NOTE,
  },
  {
    id: "MISS-METAL",
    priority: 70,
    when: { missingElement: ["금"] },
    claim: "끊어내는 기운이 약해 정리해야 할 관계를 길게 끄는 편",
    safePhrasing: "그렇게 되기 쉬운",
    forbidden: ["나쁜 사람만 만난다"],
    source: NOTE,
  },
  {
    id: "MISS-EARTH",
    priority: 70,
    when: { missingElement: ["토"] },
    claim: "관계를 눌러 담아둘 바닥이 얇아 변화에 쉽게 흔들리는 구조",
    safePhrasing: "그런 자리",
    forbidden: ["결혼하면 실패한다"],
    source: NOTE,
  },

  // ── 십성 우세 ───────────────────────────────────────────
  {
    id: "TG-JEONGGWAN",
    priority: 76,
    when: { tenGodAny: ["정관"] },
    claim: "관계를 형태와 약속으로 지키려는 성향",
    safePhrasing: "그쪽을 중요하게 보는",
    forbidden: ["반드시 결혼한다"],
    source: NOTE,
  },
  {
    id: "TG-PYEONGWAN",
    priority: 76,
    when: { tenGodAny: ["편관"] },
    claim: "긴장이 있는 관계에서 오히려 몰입이 커지는 경향",
    safePhrasing: "그런 쪽에 끌리기 쉬운",
    forbidden: ["나쁜 남자만 만난다"],
    source: NOTE,
  },
  {
    id: "TG-JEONGJAE",
    priority: 74,
    when: { tenGodAny: ["정재"] },
    claim: "현실 조건과 안정감을 먼저 계산하는 편",
    safePhrasing: "그 축을 먼저 보는",
    forbidden: ["돈만 본다"],
    source: NOTE,
  },
  {
    id: "TG-PYEONJAE",
    priority: 74,
    when: { tenGodAny: ["편재"] },
    claim: "여러 갈래의 인연이 동시에 들어오기 쉬운 구조",
    safePhrasing: "그렇게 열려 있는",
    forbidden: ["바람을 피운다"],
    source: NOTE,
  },
  {
    id: "TG-SIKSIN",
    priority: 72,
    when: { tenGodAny: ["식신"] },
    claim: "표현으로 마음을 풀어내며 관계를 데우는 편",
    safePhrasing: "그런 방식이 편한",
    forbidden: ["말만 앞선다"],
    source: NOTE,
  },
  {
    id: "TG-SANGGWAN",
    priority: 74,
    when: { tenGodAny: ["상관"] },
    claim: "정해진 틀을 답답해하고 관계의 규칙을 다시 짜려는 경향",
    safePhrasing: "그런 쪽으로 기우는",
    forbidden: ["관계를 반드시 망친다"],
    source: NOTE,
  },
  {
    id: "TG-JEONGIN",
    priority: 72,
    when: { tenGodAny: ["정인"] },
    claim: "받는 자리에서 안정을 찾고, 보살핌으로 애정을 확인하는 편",
    safePhrasing: "그렇게 채워지는",
    forbidden: ["의존적이라 사랑받지 못한다"],
    source: NOTE,
  },
  {
    id: "TG-PYEONIN",
    priority: 70,
    when: { tenGodAny: ["편인"] },
    claim: "혼자 정리하는 시간을 확보해야 관계로 돌아올 수 있는 구조",
    safePhrasing: "그런 리듬이 필요한",
    forbidden: ["연애에 관심이 없다"],
    source: NOTE,
  },
  {
    id: "TG-BIGYEON",
    priority: 68,
    when: { tenGodAny: ["비견"] },
    claim: "대등함이 지켜질 때 관계가 오래 가는 편",
    safePhrasing: "그 조건이 중요한",
    forbidden: ["고집 때문에 헤어진다"],
    source: NOTE,
  },
  {
    id: "TG-GEOPJAE",
    priority: 72,
    when: { tenGodAny: ["겁재"] },
    claim: "비교와 경쟁이 개입할 때 관계의 온도가 흔들리는 구조",
    safePhrasing: "그렇게 흔들리기 쉬운",
    forbidden: ["빼앗긴다"],
    source: NOTE,
  },

  // ── 신살 ───────────────────────────────────────────────
  {
    id: "SIN-DOHWA",
    priority: 84,
    when: { shinsal: ["도화"] },
    claim: "사람을 끌어당기는 기운이 명식에 자리하고 있음",
    safePhrasing: "그런 기운이 앉은",
    forbidden: ["바람기가 있다", "이성이 끊이지 않는다"],
    source: NOTE,
  },
  {
    id: "SIN-HONGYEOM",
    priority: 82,
    when: { shinsal: ["홍염"] },
    claim: "은근하게 번지는 매력이 실려 있어 오래 볼수록 끌리게 하는 결",
    safePhrasing: "그런 색이 도는",
    forbidden: ["유혹을 잘한다"],
    source: NOTE,
  },
  {
    id: "SIN-YEOKMA",
    priority: 78,
    when: { shinsal: ["역마"] },
    claim: "자리와 환경이 바뀔 때 인연도 함께 움직이는 구조",
    safePhrasing: "그렇게 걸려 있는",
    forbidden: ["멀리 사는 사람과 반드시 만난다"],
    source: NOTE,
  },
  {
    id: "SIN-HWAGAE",
    priority: 76,
    when: { shinsal: ["화개"] },
    claim: "혼자 있는 시간에 기운이 정리되는 편이라 관계에도 간격이 필요함",
    safePhrasing: "그런 간격이 필요한",
    forbidden: ["연애를 못 한다"],
    source: NOTE,
  },
  {
    id: "SIN-YANGIN",
    priority: 78,
    when: { shinsal: ["양인"] },
    claim: "밀어붙이는 힘이 강해 결정적인 순간에 관계를 단번에 밀거나 끊는 경향",
    safePhrasing: "그런 힘이 실린",
    forbidden: ["폭력적이다"],
    source: NOTE,
  },
  {
    id: "SIN-WONJIN",
    priority: 80,
    when: { shinsal: ["원진"] },
    claim: "이유를 대기 어려운 거슬림이 관계 안에 깔리는 구조",
    safePhrasing: "그렇게 걸리는 자리",
    forbidden: ["반드시 헤어진다"],
    source: NOTE,
  },

  // ── 형충회합 ───────────────────────────────────────────
  {
    id: "REL-CHUNG",
    priority: 80,
    when: { relationKind: ["지지충"] },
    claim: "같은 지점에서 반복해 부딪히는 구조가 명식 안에 있음",
    safePhrasing: "그 자리가 자주 걸리는",
    forbidden: ["관계가 깨진다"],
    source: NOTE,
  },
  {
    id: "REL-YUKHAP",
    priority: 76,
    when: { relationKind: ["지지육합"] },
    claim: "붙잡아두는 힘이 있어 한 번 맺은 관계를 길게 유지하는 편",
    safePhrasing: "그런 힘이 있는",
    forbidden: ["절대 헤어지지 않는다"],
    source: NOTE,
  },
  {
    id: "REL-SAMHAP",
    priority: 74,
    when: { relationKind: ["삼합"] },
    claim: "한 방향으로 기운이 모여 그 축의 일이 크게 벌어지는 구조",
    safePhrasing: "그쪽으로 쏠리는",
    forbidden: ["뭐든 이룬다"],
    source: NOTE,
  },
  {
    id: "REL-CHEONHAP",
    priority: 72,
    when: { relationKind: ["천간합"] },
    claim: "겉으로 드러나는 태도가 상대에 따라 크게 달라지는 편",
    safePhrasing: "그렇게 바뀌는",
    forbidden: ["이중인격이다"],
    source: NOTE,
  },

  // ── 운(대운·세운) ──────────────────────────────────────
  {
    id: "LUCK-GWAN",
    priority: 86,
    when: { luckTenGodAny: ["정관", "편관"] },
    claim: "지금 구간은 관계의 형태와 책임이 표면으로 올라오는 흐름",
    safePhrasing: "그런 결이 도는 구간",
    forbidden: ["올해 반드시 결혼한다"],
    source: NOTE,
  },
  {
    id: "LUCK-JAE",
    priority: 84,
    when: { luckTenGodAny: ["정재", "편재"] },
    claim: "지금 구간은 만남의 기회가 늘고 선택지가 벌어지는 흐름",
    safePhrasing: "그렇게 열리는 구간",
    forbidden: ["곧 인연이 나타난다"],
    source: NOTE,
  },
  {
    id: "LUCK-IN",
    priority: 82,
    when: { luckTenGodAny: ["정인", "편인"] },
    claim: "지금 구간은 밖으로 벌이기보다 안으로 정리하는 쪽에 힘이 실리는 흐름",
    safePhrasing: "그런 시기",
    forbidden: ["연애운이 없다"],
    source: NOTE,
  },
  {
    id: "LUCK-SIKSANG",
    priority: 82,
    when: { luckTenGodAny: ["식신", "상관"] },
    claim: "지금 구간은 말과 표현이 관계를 크게 움직이는 흐름",
    safePhrasing: "그런 힘이 실린 구간",
    forbidden: ["말하면 반드시 이루어진다"],
    source: NOTE,
  },
  {
    id: "LUCK-BIGEOP",
    priority: 84,
    when: { luckTenGodAny: ["비견", "겁재"] },
    claim: "지금 구간은 사람이 끼어들며 관계의 지분이 흔들리기 쉬운 흐름",
    safePhrasing: "그렇게 흔들릴 수 있는 구간",
    forbidden: ["삼각관계가 생긴다"],
    source: NOTE,
  },

  // ── 두 명식 사이 ───────────────────────────────────────
  {
    id: "PAIR-YUKHAP",
    priority: 90,
    when: { needsPartner: true, pairRelation: ["일지육합"] },
    claim: "두 사람의 일지가 서로를 붙잡는 자리에 놓여 있음",
    safePhrasing: "그렇게 맞물린",
    forbidden: ["천생연분이다", "반드시 이어진다"],
    source: NOTE,
  },
  {
    id: "PAIR-SAMHAP",
    priority: 88,
    when: { needsPartner: true, pairRelation: ["일지삼합"] },
    claim: "두 일지가 같은 국에 들어 방향이 같은 쪽으로 모이는 구조",
    safePhrasing: "그쪽으로 함께 기우는",
    forbidden: ["운명적인 만남이다"],
    source: NOTE,
  },
  {
    id: "PAIR-CHUNG",
    priority: 90,
    when: { needsPartner: true, pairRelation: ["일지충"] },
    claim: "두 사람의 일지가 정면으로 부딪히는 자리에 놓여 있음",
    safePhrasing: "그 자리가 걸리는",
    forbidden: ["만나면 안 되는 사이다", "반드시 헤어진다"],
    source: NOTE,
  },
  {
    id: "PAIR-WONJIN",
    priority: 88,
    when: { needsPartner: true, pairRelation: ["일지원진"] },
    claim: "설명하기 어려운 거슬림이 두 사람 사이에 깔리기 쉬운 구조",
    safePhrasing: "그렇게 걸리기 쉬운",
    forbidden: ["악연이다"],
    source: NOTE,
  },
  {
    id: "PAIR-GANHAP",
    priority: 88,
    when: { needsPartner: true, pairRelation: ["일간합"] },
    claim: "두 일간이 묶이는 조합이라 서로에게 태도가 크게 달라지는 구조",
    safePhrasing: "그렇게 반응하는",
    forbidden: ["서로밖에 없다"],
    source: NOTE,
  },

  // ── 계산의 한계 ────────────────────────────────────────
  {
    id: "META-NO-HOUR",
    priority: 95,
    when: { hourUnknown: true },
    claim: "출생 시각이 없어 시주에 기댄 해석은 범위를 넓게 잡아야 함",
    safePhrasing: "단정하지 않고 폭을 두는",
    forbidden: ["시주로 보면"],
    source: "계산 노트 — 시주 미상",
  },
];

// ── 매칭 ────────────────────────────────────────────────

function pairRelationsOf(me: SajuFacts, partner: SajuFacts | null): PairRelation[] {
  if (!partner) return [];
  const a = JIJI.indexOf(me.fourPillars.day.branch as (typeof JIJI)[number]);
  const b = JIJI.indexOf(partner.fourPillars.day.branch as (typeof JIJI)[number]);
  const ga = CHEONGAN.indexOf(me.fourPillars.day.stem as (typeof CHEONGAN)[number]);
  const gb = CHEONGAN.indexOf(partner.fourPillars.day.stem as (typeof CHEONGAN)[number]);
  const both = (pairs: [number, number][]) =>
    pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  const out: PairRelation[] = [];
  if (both(BRANCH_SIX_COMBOS)) out.push("일지육합");
  if (both(BRANCH_CLASHES)) out.push("일지충");
  if (both(WONJIN)) out.push("일지원진");
  if (a !== b && BRANCH_TRIPLES.some(([members]) => members.includes(a) && members.includes(b))) {
    out.push("일지삼합");
  }
  if (HEAVENLY_COMBOS.some(([x, y]) => (x === ga && y === gb) || (x === gb && y === ga))) {
    out.push("일간합");
  }
  return out;
}

function matches(rule: ReadingRule, me: SajuFacts, partner: SajuFacts | null, productId: string): boolean {
  const w = rule.when;
  if (w.domains && !w.domains.includes(productId)) return false;
  if (w.needsPartner && !partner) return false;

  if (w.hourUnknown !== undefined) {
    const unknown = me.fourPillars.hour === null;
    if (w.hourUnknown !== unknown) return false;
  }
  if (w.dayMasterElement && !w.dayMasterElement.includes(me.dayMasterElement)) return false;
  if (w.strength && !w.strength.includes(me.strength.label)) return false;
  if (w.missingElement && !w.missingElement.some((e) => me.missingElements.includes(e))) return false;
  if (w.tenGodAny && !w.tenGodAny.some((t) => me.dominantTenGods.includes(t))) return false;
  if (w.shinsal && !w.shinsal.some((name) => me.shinsal.some((s) => s.name === name))) return false;
  if (w.relationKind && !w.relationKind.some((k) => me.notableRelations.some((r) => r.kind === k))) return false;

  if (w.luckTenGodAny) {
    const running = [
      me.luckContext.majorLuck?.currentTenGod,
      me.luckContext.yearly.tenGod,
      me.luckContext.monthly.tenGod,
    ].filter(Boolean) as string[];
    if (!w.luckTenGodAny.some((t) => running.includes(t))) return false;
  }
  if (w.pairRelation) {
    const relations = pairRelationsOf(me, partner);
    if (!w.pairRelation.some((r) => relations.includes(r))) return false;
  }
  return true;
}

/**
 * 이 명식에서 켜지는 규칙을 우선순위 순으로. 모델에는 상위 몇 개만 실어
 * 한 리포트가 감당할 수 있는 만큼만 주장하게 한다.
 */
export function matchRules(
  me: SajuFacts,
  partner: SajuFacts | null,
  productId: string,
  limit = 12
): ReadingRule[] {
  return READING_RULES.filter((rule) => matches(rule, me, partner, productId))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** 매칭된 규칙이 금지한 문구 — reading-guard가 그대로 검사한다 */
export function forbiddenFromRules(rules: ReadingRule[]): string[] {
  return [...new Set(rules.flatMap((rule) => rule.forbidden))];
}

/** 모델 입력 JSON에 실을 형태 — 판단의 근거만 남기고 내부 메모는 뺀다 */
export function rulesForPrompt(rules: ReadingRule[]) {
  return rules.map((rule) => ({
    rule_id: rule.id,
    narrative_claim: rule.claim,
    safe_phrasing: rule.safePhrasing,
    forbidden_claims: rule.forbidden,
  }));
}
