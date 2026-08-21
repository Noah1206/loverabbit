// 검수된 해석 규칙 — 계산값과 문장 사이에 놓이는 층.
//
// 지금까지는 saju_facts를 그대로 모델에 넘기고 "알아서 번역해"라고 맡겼다.
// 그러면 같은 명식이 매번 다른 근거로 읽히고, 무엇을 말해도 되는지의 경계가
// 모델의 그날 기분에 달린다. 여기서 조건 -> 주장 -> 금지선을 미리 못박는다.
//
// 규칙 하나는 이렇게 읽는다.
//   when          어떤 계산값일 때 켜지는가
//   claim         그때 말해도 되는 것 (경향 서술이지 예언이 아니다)
//   safePhrasing  그 주장을 감쌀 어법
//   forbidden     그 규칙을 빌미로 넘어가면 안 되는 선. reading-guard가 그대로 검사한다.
//   source        어느 명리 원리에서 나왔는가
//
// 성별을 조건으로 쓰는 이유:
//   십성에서 배우자를 뜻하는 자리가 남녀에 따라 다르다. 여자는 관성(정관·편관),
//   남자는 재성(정재·편재)이 배우자성이다. 같은 재성운이라도 남자에게는 인연이
//   늘어나는 구간이고 여자에게는 바깥일이 늘어나는 구간이라, 한 문장으로 묶으면
//   절반이 틀린다.

import { CHEONGAN, JIJI, type Ohaeng } from "./saju";
import {
  BRANCH_CLASHES,
  BRANCH_SIX_COMBOS,
  BRANCH_TRIPLES,
  HEAVENLY_COMBOS,
  type Gender,
  type SajuFacts,
} from "./saju-facts";
import { WONJIN, type ShinsalName } from "./saju-shinsal";
import { hiddenStemsOf } from "./myeongri/hidden-stems";
import { completeXing, type XingCompleteness, type XingKind } from "./myeongri/xing";
import { luckInterpretationFlags } from "./myeongri/luck-flags";
import { approvedPartnerRules, isPartnerRule } from "./myeongri-policy/partner-rules";

export type PairRelation = "일지육합" | "일지삼합" | "일지충" | "일지원진" | "일간합";

export interface RuleCondition {
  gender?: Gender[];
  dayMasterElement?: Ohaeng[];
  strength?: ("신강" | "중화" | "신약")[];
  /** 하나라도 있으면 켜진다 */
  shinsal?: ShinsalName[];
  /** dominantTenGods에 하나라도 있으면 */
  tenGodAny?: string[];
  /** 일지(배우자궁)에 앉은 십성 */
  dayBranchTenGod?: string[];
  /** 일지가 충을 맞는가 */
  dayBranchClashed?: boolean;
  missingElement?: Ohaeng[];
  relationKind?: ("천간합" | "지지충" | "지지육합" | "삼합")[];
  /** 대운·세운·월운 십성 */
  luckTenGodAny?: string[];
  /** 두 명식 사이의 관계 */
  pairRelation?: PairRelation[];
  /** 상대 명식이 있어야만 켜지는 규칙 */
  needsPartner?: boolean;

  // ── 상대 명식 ──────────────────────────────────────────
  //
  // 이 조건들이 없던 동안, 65개 규칙 전부가 me 만 읽었다. 상대를 보는 통로는
  // pairRelation 하나였고 그것도 일간 대 일간, 일지 대 일지뿐이었다. 그래서
  // 궁합 상품인데 두 명식을 잇는 축이 하나였고, 기준 케이스처럼 일주가 안 걸리는
  // 짝에서는 상대 쪽 검수 규칙이 **0개**가 됐다. 그런데도 리포트는 상대의 성향을
  // 열두 절 내내 말했다 — 전부 규칙 밖의 말이었다.
  //
  // 조건을 지원한다고 해서 서술이 열리는 것은 아니다. 이 조건을 쓰는 규칙은
  // PARTNER_RULE_REGISTRY(partner-rules.ts)에 출처와 함께 등재돼야 하고,
  // 등재 전에는 reading-guard 가 상대 성향 문장을 막는다.
  /** 상대의 강약 */
  partnerStrength?: ("신강" | "중화" | "신약")[];
  /** 상대 명식에 아예 없는 오행 */
  partnerMissingElement?: Ohaeng[];
  /** 상대의 대운·세운·월운 십성 */
  partnerLuckTenGodAny?: string[];
  /** 상대의 두드러진 십성 */
  partnerDominantTenGod?: string[];
  /** 상대의 일지(배우자궁)에 앉은 십성 */
  partnerDayBranchTenGod?: string[];
  /**
   * 상대 명식에 **지장간까지 열어도 없는** 오행.
   *
   * partnerMissingElement 는 겉으로 안 드러난 것까지 잡는다. 숨어 있는 것과
   * 아예 없는 것을 같은 말로 부르면 같은 해석이 나가므로 나눠 둔다.
   */
  partnerAbsentElement?: Ohaeng[];
  /** 상대 명식에서 지장간에만 있고 겉으로는 안 드러난 오행 */
  partnerHiddenOnlyElement?: Ohaeng[];
  /** 상대 명식의 신살 — 본인 쪽 SIN-* 이 쓰는 원리를 그대로 옮긴 것 */
  partnerShinsal?: ShinsalName[];
  /** 상대 지지 속에 숨어 있는 천간 — 드러나지 않은 자리를 볼 때 */
  partnerHiddenStem?: string[];
  /** 상대 명식에서 한 자리에 겹친 관계의 꼴 */
  partnerRelationBundle?: ("합+형" | "충+형" | "합+충")[];
  /** 한쪽에 없는 오행을 다른 쪽이 갖고 있는가 — 서로 메우는 자리 */
  pairElementComplement?: Ohaeng[];
  /** 월지끼리의 관계. 일지만 보던 궁합에 사회 자리를 더한다 */
  pairMonthBranchRelation?: ("육합" | "충" | "삼합" | "원진")[];
  /** 시주가 없을 때만 켜지는 규칙 */
  hourUnknown?: boolean;
  /**
   * 원국의 형(刑). 부분 삼형을 실질로 칠지는 XING_PARTIAL_POLICY 가 정하고
   * 여기서는 정하지 않는다.
   */
  xingKind?: XingKind[];
  /**
   * 형이 몇 글자로 섰는가.
   *
   * 완성 삼형의 상의(무은지형·지세지형)를 두 글자짜리에 그대로 씌우면
   * 명식에 없는 글자의 해석을 사용자에게 주게 된다. 그래서 상의를 쓰는 규칙은
   * ["complete"] 를 명시해야 하고, 두 글자용 규칙은 ["partial"] 로 따로 선다.
   * 비워 두면 예전처럼 둘 다 받는다 — 상의를 쓰지 않는 궁위 규칙이 그렇다.
   */
  xingCompleteness?: XingCompleteness[];
  /**
   * 실제로 선 두 글자 — "사신", "축미", "술미"...
   *
   * 삼형의 상의를 걷어내고 나니 두 글자짜리에 할 말이 없어졌다. 그런데 고전은
   * 원래 선 글자로 부르고 선 글자로 읽는다(巳刑申·戌刑未). 글자 쌍마다 성질이
   * 다르므로 — 사신은 육합이 겹치고 축미는 충이 겹친다 — 쌍을 조건으로 받는다.
   * 부분 성립에만 쓴다. 세 글자가 다 서면 그때는 국(局)의 이름으로 읽는다.
   */
  xingPair?: string[];
  /** 원국의 형이 일지(배우자궁)에 걸려 있는가 */
  xingAtDayBranch?: boolean;
  /** 운에서 들어온 형 — 어느 운의 글자가 끼었는가 */
  xingLuckScope?: ("대운" | "세운" | "월운")[];
  /**
   * 여자 상관운 후보 플래그가 붙었는가.
   * 정책(FEMALE_SHANGGUAN_POLICY)이 켜져 있고, 성별이 명시됐고,
   * 명식에 관성이 실제로 있을 때만 참이 된다.
   */
  femaleShangguanCandidate?: boolean;
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

// ── 상품 도메인 검토 (감사 후속) ─────────────────────────
//
// 속궁합 12절이 규칙 4개 위에 서 있었다. 그중 하나가 11개 절의 뼈대였다.
// 아래는 규칙마다 '이 상품의 물음에 이 판단이 답이 되는가'를 따져 넓힌 것이다.
//
//   TG-SANGGWAN                +jaehoe,sokgunghap
//     상관은 표현·발산의 자리다. 재회에서는 하고 싶은 말이 먼저 나가는 결로, 속궁합에서는 원하는 것을 말로 꺼내는 결로 그대로 닿는다.
//   TG-PYEONJAE                +jaehoe,sokgunghap
//     편재는 감각으로 움직이는 애정이다. 속궁합의 축이고, 재회에서는 마음이 한 곳에 안 머무는 결이다.
//   TG-GEOPJAE                 +jaehoe,sokgunghap
//     겁재는 나눠야 하는 자리다. 관계에서는 비교와 경쟁으로 드러나므로 두 상품 다에 걸린다.
//   SIN-HWAGAE                 +jaehoe,sokgunghap
//     화개는 혼자 있는 시간이 필요한 자리다. 재회에서 답장이 끊긴 밤의 근거가 되고, 속궁합에서는 가까워도 안으로 도는 결이 된다. 이 명식의 유일한 신살인데 두 상품 모두에서 빠져 있었다.
//   REL-CHUNG                  +sokgunghap
//     지지충은 자리끼리 부딪히는 것이라 가까운 사이에서 가장 크게 드러난다. 속궁합에서 뺄 이유가 없었다.
//   SIN-WONJIN                 +sokgunghap
//     원진은 까닭 없이 거슬리는 자리다. 몸이 가까울수록 도드라지므로 속궁합의 핵심에 가깝다.
//   LUCK-SIKSANG               +jaehoe,sokgunghap
//     식상운은 표현이 늘어나는 흐름이다. 지금 말이 어떻게 나가는지를 묻는 두 상품에 직접 닿는다.
//   SPOUSE-STAR-F              +sokgunghap
//     일지는 배우자궁이다. 그 자리의 배우자성을 속궁합에서 뺄 이유가 없다.
//   SPOUSE-STAR-M              +sokgunghap
//     일지는 배우자궁이다. 그 자리의 배우자성을 속궁합에서 뺄 이유가 없다.
//   XING-LUCK-NOW              +sokgunghap
//     지금 구간에만 겹치는 형은 '요즘 유독 걸린다'는 말이 된다. 속궁합에서도 유효하다.
//   XING-YINSISHEN             +sokgunghap,gyeolhon
//     완성 삼형이 섰을 때의 상의는 가까운 관계에서 가장 크게 나온다.
//   XING-CHOUXUWEI             +jaehoe,sokgunghap,bamgijil
//     완성 삼형이 섰을 때의 상의는 가까운 관계에서 가장 크게 나온다.
// ── 도메인을 넓히지 않기로 한 것 ────────────────────────
//   SIN-YEOKMA   역마는 이동·자리 옮김이다. 속궁합·재회의 물음과 축이 다르다.
//   SIN-YANGIN   양인은 힘이 과한 자리로 본다. 관계 상품에 바로 옮기면 성격 판정이 된다.
//   XING-SELF    자형은 혼자 안으로 도는 결이라 짝을 묻는 상품의 답이 되기 어렵다.
//   LUCK-BIGEOP  비겁운은 경쟁·나눔인데, 재회에서 '경쟁자가 있다'로 새기 쉽다.
// 절 수가 모자란 것과 그 규칙이 그 상품의 답이 되는 것은 다른 문제다.

// ── 이별 부검 도메인 검토 (출시 전 훑기 후속) ────────────
//
// 10절짜리인데 규칙이 평균 7~8개만 켜졌다 — 상대가 있어도 80% 조합에서 모자랐다.
// 절마다 딛을 것이 없으면 모델은 앞 절의 판단을 말만 바꿔 되풀이한다.
//
// 새 주장을 만들지 않았다. 이미 승인된 규칙 중 이 상품의 물음에 답이 되는 것을
// 골라 도메인을 넓혔다. 판단 기준은 하나다 — 이별 부검이 묻는 열 가지 중
// 어느 줄에 이 규칙이 실제로 닿는가.
//
//   REL-YUKHAP        +ibyeol   육합은 묶는 힘이다. "정리해야 할 때도 늦어진다" 는
//                               이 규칙의 본문이 곧 미련의 구조다(7절).
//   REL-CHEONHAP      +ibyeol   천간합은 본래 성정이 그대로 안 나오는 자리다.
//                               "왜 하필 그 사람이었나"(1절)와 "처음부터 있었던 균열"(2절)에 닿는다.
//   REL-SAMHAP        +ibyeol   한 축으로 모이면 다른 축이 얇아진다. 반복해서 걸리는 지점(6절).
//   SIN-HWAGAE        +ibyeol   붙어 있는 시간만으로 안 채워지는 결. 균열(2절)이자
//                               혼자 있는 시간에 정리된다는 회복(8절)의 근거다.
//                               재회·속궁합에 이미 같은 논리로 넣었다.
//   XING-SELF         +ibyeol   자형은 밖이 아니라 안에서 흔드는 것이다. 미련의 정체(7절)에
//                               정확히 닿는다. 속궁합에서 뺐던 이유("짝을 묻는 상품의 답이
//                               되기 어렵다")가 여기서는 반대로 든다 — 이 상품은 짝이 아니라
//                               자기를 되짚는다.
//   XING-LUCK-MONTH   +ibyeol   이달치 형이라는 단서. 회복 시점(8절)에서 "지금 힘든 것이
//                               이달의 것일 수 있다" 는 제동이 된다.
//   LUCK-GWAN-F/M     +ibyeol   관운에 관계의 형태가 표면으로 올라온다. 결정적이었던 시기(4절).
//   LUCK-JAE-F/M      +ibyeol   재운도 같은 자리에서 같은 일을 한다. 재회에 이미 있다.
//   LUCK-IN           +ibyeol   인성은 나를 생하는 것이라 안으로 정리하는 흐름이다.
//                               감정이 회복되는 시점(8절)의 직접 근거.
//   LUCK-SIKSANG      +ibyeol   말이 관계를 움직이는 흐름. 이별의 사인(3절)과 시기(4절).
//   SPOUSE-STAR-F/M   +ibyeol   일지 배우자성. 왜 그 관계가 삶의 중심이 됐는가(1절).
//   PAIR-YUKHAP       +ibyeol   두 배우자 자리가 서로 당기는데도 헤어졌다는 것 자체가
//   PAIR-SAMHAP       +ibyeol   부검의 재료다. 재회에 이미 걸려 있고 축이 같다.
//   PAIR-GANHAP       +ibyeol   두 일간이 묶이면 둘 앞에서만 다른 사람이 된다 —
//                               상대 명식에서 본 이별의 이유(5절).
//
// ── 넓히지 않기로 한 것 ──────────────────────────────────
//   TG-PYEONJAE   편재를 이별 부검에 넣으면 "한곳에 안 고여서 헤어졌다" 로 읽힌다.
//                 부검이 아니라 성격 판정이 된다.
//   SIN-DOHWA     도화를 이 상품에 넣으면 헤어진 사람에게 "끼가 있어서" 를 말하게 된다.
//   SIN-HONGYEOM  같은 이유.
//   SIN-YEOKMA    역마는 이동이다. 이별의 사인과 축이 다르다.

// ── 인연 타이밍 도메인 검토 (같은 훑기) ──────────────────
//
// 9절인데 이 상품 몫의 규칙이 12개였고, 솔로 상품이라 상대 규칙이 통째로 죽는다.
// 64% 조합에서 절 수를 못 채웠다.
//
//   SIN-DOHWA         +insun   도화는 사람이 모이는 자리다. 만나게 될 경로(4절)와
//                              인연을 앞당기는 처방(8절)의 고전적 근거가 여기다.
//                              솔로 상품에서 이게 빠져 있던 것이 이상하다.
//   SIN-HONGYEOM      +insun   오래 볼수록 번지는 끌림. 다음 인연의 윤곽(5절).
//   SIN-HWAGAE        +insun   혼자 있는 시간에 정리되는 결. 지금 솔로인 구간(1절).
//   SIN-WONJIN        +insun   사건 없이 마음이 멀어지는 구조 — 지난 인연들이
//                              스쳐간 이유(2절)에 그대로 닿는다.
//   SPOUSE-PALACE-CHUNG +insun 배우자 자리가 충을 맞으면 자리가 안 잡힌다.
//   XING-SPOUSE-PALACE  +insun 형도 같은 자리에서 같은 일을 한다. 둘 다 1·2절.
//   XING-SELF         +insun   혼자 되짚는 시간이 흔든다. 솔로 구간(1절)과 준비(6절).
//   XING-LUCK-MONTH   +insun   이달치라는 단서. 창이 닫히는 함정 구간(7절)에서
//                              "이건 이달의 것" 이라는 제동이 된다.
//   TG-PYEONJAE       +insun   여러 갈래가 들어오고 한곳에 안 고인다 — 스쳐간
//                              이유(2절) 그 자체다.
//   TG-SANGGWAN       +insun   틀을 다시 짜려는 결. 지난 인연이 스친 이유(2절).
//   TG-GEOPJAE        +insun   비교가 끼어들 때 흔들리는 자리. 같은 절.
//   REL-CHUNG         +insun   같은 지점에서 반복해 걸린다 — 2절의 뼈대.
//   REL-CHEONHAP      +insun   상대에 따라 다른 사람처럼 보이는 자리. 5절.
//
// ── 넓히지 않기로 한 것 ──────────────────────────────────
//   SIN-YANGIN     밀어붙이는 힘. 솔로에게 옮기면 "네 성격 때문에 혼자" 가 된다.
//   LUCK-BIGEOP    비겁운을 솔로 상품에 넣으면 "경쟁자가 있다" 로 새기 쉽다.
//   XING-YINSISHEN 삼형과 형 쌍은 전부 가까운 사이에서 부딪히는 이야기다.
//   XING-PAIR-*    지금 없는 관계를 두고 말하게 되므로 이 상품의 답이 아니다.
//   PAIR-*         상대 명식이 있어야 켜진다. 솔로 상품에서는 애초에 안 선다.

export const READING_RULES: ReadingRule[] = [
  // ── 일간 오행 × 강약 ────────────────────────────────────
  // 오행 성정(木 仁·뻗음 / 火 禮·확산 / 土 信·포용 / 金 義·수렴 / 水 智·흐름)에
  // 강약을 곱한다. 신강은 그 성정이 과하게 나오고, 신약은 성정은 있으나 지속이 안 된다.
  {
    id: "SELF-FIRE-WEAK",
    priority: 80,
    when: { dayMasterElement: ["화"], strength: ["신약"] },
    claim: "마음이 붙는 속도는 빠른데 그 열을 혼자 오래 유지하지 못해, 상대의 반응에 따라 온도가 크게 오르내리는 구조",
    safePhrasing: "그렇게 흔들리기 쉬운 결",
    forbidden: ["금방 식어서 오래 못 간다", "먼저 연락하면 반드시 실패한다"],
    source: "오행 성정 — 火는 확산·표현. 신약한 火는 스스로 불씨를 지키지 못하고 인성(木)의 도움에 좌우된다.",
  },
  {
    id: "SELF-FIRE-STRONG",
    priority: 78,
    when: { dayMasterElement: ["화"], strength: ["신강"] },
    claim: "감정을 크게 쓰고 표현도 앞서 나가, 상대가 따라오기 전에 혼자 먼저 달아오르는 편",
    safePhrasing: "그런 진폭을 가진",
    forbidden: ["금방 질려서 헤어진다"],
    source: "오행 성정 — 火 신강은 열이 과해 설기(土)나 극(水) 없이는 스스로 태운다.",
  },
  {
    id: "SELF-WATER-WEAK",
    priority: 80,
    when: { dayMasterElement: ["수"], strength: ["신약"] },
    claim: "상대의 기분을 먼저 읽느라 자기 요구를 뒤로 미루고, 그 미룬 것이 뒤늦게 서운함으로 남는 경향",
    safePhrasing: "그렇게 쌓이기 쉬운 자리",
    forbidden: ["항상 이용당한다"],
    source: "오행 성정 — 水는 智·감지. 신약하면 감지력은 남고 자기 흐름을 낼 힘이 부족하다.",
  },
  {
    id: "SELF-WATER-STRONG",
    priority: 78,
    when: { dayMasterElement: ["수"], strength: ["신강"] },
    claim: "속을 여러 겹으로 두고 필요한 만큼만 내보여, 가까운 사이에서도 마지막 한 겹을 남기는 편",
    safePhrasing: "그런 방식이 익숙한",
    forbidden: ["거짓말을 잘한다"],
    source: "오행 성정 — 水는 깊고 감춘다. 신강하면 그 깊이가 두꺼워진다.",
  },
  {
    id: "SELF-WOOD-WEAK",
    priority: 80,
    when: { dayMasterElement: ["목"], strength: ["신약"] },
    claim: "시작하는 마음은 곧게 서는데 밀고 갈 뿌리가 얕아, 관계도 초반을 지나면 힘이 빠지기 쉬운 구조",
    safePhrasing: "그럴 수 있는 결",
    forbidden: ["끝까지 못 간다"],
    source: "오행 성정 — 木은 시작·성장. 신약한 木은 뻗다 멈춘다.",
  },
  {
    id: "SELF-WOOD-STRONG",
    priority: 78,
    when: { dayMasterElement: ["목"], strength: ["신강"] },
    claim: "관계에서도 방향과 명분을 먼저 세우고, 그 방향이 흔들리면 관계 자체를 다시 보는 편",
    safePhrasing: "그런 자리에 서기 쉬운",
    forbidden: ["상대를 지배한다"],
    source: "오행 성정 — 木은 仁·곧음. 신강하면 굽히지 않는다.",
  },
  {
    id: "SELF-METAL-WEAK",
    priority: 80,
    when: { dayMasterElement: ["금"], strength: ["신약"] },
    claim: "기준은 안에서 분명한데 그 기준을 말로 세우지 못해 혼자 삼키고 판정만 쌓는 경향",
    safePhrasing: "그렇게 쌓이기 쉬운",
    forbidden: ["결국 폭발해서 관계가 끝난다"],
    source: "오행 성정 — 金은 義·결단. 신약하면 판단은 서되 끊어낼 힘이 부족하다.",
  },
  {
    id: "SELF-METAL-STRONG",
    priority: 78,
    when: { dayMasterElement: ["금"], strength: ["신강"] },
    claim: "선이 분명하고 그 선을 넘는 상대에게는 설명보다 정리가 먼저 나가는 편",
    safePhrasing: "그런 쪽으로 반응하기 쉬운",
    forbidden: ["차가워서 사랑받지 못한다"],
    source: "오행 성정 — 金 신강은 수렴·절제가 과해 단호함으로 나타난다.",
  },
  {
    id: "SELF-EARTH-WEAK",
    priority: 80,
    when: { dayMasterElement: ["토"], strength: ["신약"] },
    claim: "품으려는 마음이 앞서 상대의 자리를 넓혀주다 자기 자리를 좁히는 경향",
    safePhrasing: "그렇게 되기 쉬운",
    forbidden: ["호구가 된다"],
    source: "오행 성정 — 土는 信·포용. 신약하면 중심이 얇아 맞춰주는 쪽으로 기운다.",
  },
  {
    id: "SELF-EARTH-STRONG",
    priority: 78,
    when: { dayMasterElement: ["토"], strength: ["신강"] },
    claim: "속도를 늦추고 오래 지켜본 뒤에야 움직여, 상대에게는 뜸을 들이는 것처럼 보이기 쉬운 편",
    safePhrasing: "그런 리듬을 가진",
    forbidden: ["기회를 반드시 놓친다"],
    source: "오행 성정 — 土 신강은 무겁고 느리다.",
  },
  {
    id: "SELF-FIRE-EVEN",
    priority: 62,
    when: { dayMasterElement: ["화"], strength: ["중화"] },
    claim: "달아오르는 힘과 식히는 힘이 함께 있어, 감정을 크게 내되 스스로 거둬들일 줄도 아는 편",
    safePhrasing: "그렇게 조절되는 결",
    forbidden: ["감정 조절을 완벽하게 한다"],
    source: "오행 성정 + 강약 — 火가 중화면 확산과 수렴이 같이 선다. 火의 표현력은 남되 자기 소진이 덜하다.",
  },
  {
    id: "SELF-WATER-EVEN",
    priority: 62,
    when: { dayMasterElement: ["수"], strength: ["중화"] },
    claim: "상대를 읽는 눈과 자기 흐름을 낼 힘이 함께 있어, 맞춰주면서도 필요한 말은 하는 편",
    safePhrasing: "그런 균형을 가진",
    forbidden: ["절대 상처받지 않는다"],
    source: "오행 성정 + 강약 — 水가 중화면 감지력(智)은 남고 자기 물길을 낼 힘도 선다.",
  },
  {
    id: "SELF-WOOD-EVEN",
    priority: 62,
    when: { dayMasterElement: ["목"], strength: ["중화"] },
    claim: "시작하는 힘과 밀고 갈 뿌리가 함께 있어, 벌인 일을 끝까지 가져가는 편",
    safePhrasing: "그렇게 이어가는 결",
    forbidden: ["무엇이든 성공한다"],
    source: "오행 성정 + 강약 — 木이 중화면 시작(生)과 지속(根)이 같이 선다.",
  },
  {
    id: "SELF-METAL-EVEN",
    priority: 62,
    when: { dayMasterElement: ["금"], strength: ["중화"] },
    claim: "선을 그을 줄 알면서 그 선을 상대에게 설명할 여유도 있어, 단호함이 차갑게만 남지 않는 편",
    safePhrasing: "그런 결이 있는",
    forbidden: ["절대 상처를 주지 않는다"],
    source: "오행 성정 + 강약 — 金이 중화면 결단(義)이 서되 과하게 자르지 않는다.",
  },
  {
    id: "SELF-EARTH-EVEN",
    priority: 62,
    when: { dayMasterElement: ["토"], strength: ["중화"] },
    claim: "품는 힘과 밀어낼 힘이 함께 있어, 받아주되 감당 못 할 것은 미리 접는 편",
    safePhrasing: "그렇게 가려내는",
    forbidden: ["모든 사람과 잘 지낸다"],
    source: "오행 성정 + 강약 — 土가 중화면 포용(信)이 서되 무한정 받아 안지 않는다.",
  },
  {
    id: "SELF-BALANCED",
    // 오행별 중화 규칙(SELF-*-EVEN)이 먼저 잡히고, 이건 그 위에 얹는 일반 서술이다
    priority: 54,
    when: { strength: ["중화"] },
    claim: "한쪽으로 크게 기울지 않아 상황에 맞춰 태도를 바꿀 수 있고, 그만큼 자기 색이 늦게 드러나는 구조",
    safePhrasing: "폭이 넓은 편",
    forbidden: ["아무 문제가 없다"],
    source: "강약 — 중화는 특정 오행에 휘둘리지 않으나 뚜렷한 축도 약하다.",
  },

  // ── 없는 오행 ───────────────────────────────────────────
  // 원국에 없는 오행은 그 기운이 담당하는 기능이 약하다는 뜻이지, 평생 결핍이라는 뜻이 아니다.
  // 대운·세운에서 들어오면 채워지므로 safe_phrasing으로 반드시 폭을 둔다.
  {
    id: "MISS-FIRE",
    priority: 72,
    when: { missingElement: ["화"] },
    claim: "확신을 데워주는 기운이 비어 있어 머리로 답을 알아도 발이 늦게 떨어지는 구조",
    safePhrasing: "그런 자리",
    forbidden: ["평생 연애를 못 한다"],
    source: "오행 결자 — 火 부재는 추진·표현의 열이 부족한 것으로 본다.",
  },
  {
    id: "MISS-WATER",
    priority: 72,
    when: { missingElement: ["수"] },
    claim: "흘려보내는 기운이 없어 한 번 걸린 감정을 오래 쥐고, 같은 장면을 반복해 되감는 편",
    safePhrasing: "그렇게 되기 쉬운",
    forbidden: ["집착증이 있다"],
    source: "오행 결자 — 水 부재는 융통·해소가 약한 것으로 본다.",
  },
  {
    id: "MISS-WOOD",
    priority: 70,
    when: { missingElement: ["목"] },
    claim: "먼저 뻗어나가는 기운이 얇아 관계를 여는 쪽보다 응하는 쪽에 서기 쉬운 구조",
    safePhrasing: "그런 편",
    forbidden: ["먼저 고백하면 안 된다"],
    source: "오행 결자 — 木 부재는 시작·확장의 힘이 약한 것으로 본다.",
  },
  {
    id: "MISS-METAL",
    priority: 70,
    when: { missingElement: ["금"] },
    claim: "끊어내는 기운이 얇아 정리해야 할 관계를 필요 이상으로 길게 끄는 편",
    safePhrasing: "그렇게 되기 쉬운",
    forbidden: ["나쁜 사람만 만난다"],
    source: "오행 결자 — 金 부재는 결단·절단이 약한 것으로 본다.",
  },
  {
    id: "MISS-EARTH",
    priority: 70,
    when: { missingElement: ["토"] },
    claim: "관계를 눌러 담아둘 바닥이 얇아 상황이 바뀔 때 마음도 함께 흔들리는 구조",
    safePhrasing: "그런 자리",
    forbidden: ["결혼하면 실패한다"],
    source: "오행 결자 — 土 부재는 안정·중재의 바탕이 약한 것으로 본다.",
  },

  // ── 십성 우세 ───────────────────────────────────────────
  // 십성은 일간을 기준으로 한 관계 코드다. 관계 리딩에서는 관성·재성·식상·인성·비겁이
  // 각각 "매이는 힘 / 취하는 힘 / 내보내는 힘 / 받는 힘 / 나누는 힘"으로 읽힌다.
  {
    id: "TG-JEONGGWAN",
    priority: 76,
    when: { tenGodAny: ["정관"] },
    claim: "관계를 형태와 약속으로 지키려 하고, 형태가 흐릿한 상태를 오래 못 견디는 성향",
    safePhrasing: "그쪽을 중요하게 보는",
    forbidden: ["반드시 결혼한다"],
    source: "십성 — 정관은 나를 정당하게 극하는 자리. 규범·책임·명예.",
  },
  {
    id: "TG-PYEONGWAN",
    priority: 76,
    when: { tenGodAny: ["편관"] },
    claim: "긴장이 있는 관계에서 몰입이 커지고, 편안하기만 한 관계에서는 오히려 마음이 식는 경향",
    safePhrasing: "그런 쪽에 끌리기 쉬운",
    forbidden: ["나쁜 남자만 만난다"],
    source: "십성 — 편관(칠살)은 나를 강하게 극하는 자리. 압박·자극.",
  },
  {
    id: "TG-JEONGJAE",
    priority: 74,
    when: { tenGodAny: ["정재"] },
    claim: "현실 조건과 지속 가능성을 먼저 계산하고, 계산이 서야 마음을 마저 내는 편",
    safePhrasing: "그 축을 먼저 보는",
    forbidden: ["돈만 본다"],
    source: "십성 — 정재는 내가 정당하게 극하는 자리. 안정·성실.",
  },
  {
    id: "TG-PYEONJAE",
    priority: 74,
    when: { tenGodAny: ["편재"] , domains: ["baramgi", "dohwasal", "hwanseung", "pyeongsaeng", "bamgijil", "sseom", "jaehoe", "sokgunghap", "insun"] },
    claim: "인연의 폭이 넓게 열려 여러 갈래가 동시에 들어오고, 그만큼 한곳에 고이지 않는 구조",
    safePhrasing: "그렇게 열려 있는",
    forbidden: ["바람을 피운다"],
    source: "십성 — 편재는 유동적으로 취하는 자리. 넓은 인연·유통.",
  },
  {
    id: "TG-SIKSIN",
    priority: 72,
    when: { tenGodAny: ["식신"] },
    claim: "표현으로 마음을 풀어내며 관계를 데우고, 말이 막히면 관계도 함께 막히는 편",
    safePhrasing: "그런 방식이 편한",
    forbidden: ["말만 앞선다"],
    source: "십성 — 식신은 내가 생하는 자리. 표현·여유·베풂.",
  },
  {
    id: "TG-SANGGWAN",
    priority: 74,
    when: { tenGodAny: ["상관"] , domains: ["baramgi", "ibyeol", "dohwasal", "gwontaegi", "pyeongsaeng", "bamgijil", "sseom", "jjak", "jaehoe", "sokgunghap", "insun"] },
    claim: "정해진 틀을 답답해하고 관계의 규칙을 다시 짜려 해, 상대에게는 반박처럼 들리기 쉬운 경향",
    safePhrasing: "그런 쪽으로 기우는",
    forbidden: ["관계를 반드시 망친다"],
    source: "십성 — 상관은 정관을 극한다. 재능·비판·틀 거부.",
  },
  {
    id: "TG-JEONGIN",
    priority: 72,
    when: { tenGodAny: ["정인"] },
    claim: "보살핌으로 애정을 확인하고, 받는 자리에 있을 때 관계가 안정되는 편",
    safePhrasing: "그렇게 채워지는",
    forbidden: ["의존적이라 사랑받지 못한다"],
    source: "십성 — 정인은 나를 정당하게 생하는 자리. 보호·수용.",
  },
  {
    id: "TG-PYEONIN",
    priority: 70,
    when: { tenGodAny: ["편인"] },
    claim: "혼자 정리하는 시간을 확보해야 관계로 돌아올 수 있고, 그 시간이 상대에게는 거리로 읽히는 구조",
    safePhrasing: "그런 리듬이 필요한",
    forbidden: ["연애에 관심이 없다"],
    source: "십성 — 편인은 편중된 생. 직관·고독·내향.",
  },
  {
    id: "TG-BIGYEON",
    priority: 66,
    when: { tenGodAny: ["비견"] },
    claim: "대등함이 지켜질 때 관계가 오래 가고, 한쪽이 기울면 애정보다 자존이 먼저 반응하는 편",
    safePhrasing: "그 조건이 중요한",
    forbidden: ["고집 때문에 헤어진다"],
    source: "십성 — 비견은 같은 오행 같은 음양. 대등·자립.",
  },
  {
    id: "TG-GEOPJAE",
    priority: 72,
    when: { tenGodAny: ["겁재"] , domains: ["hwanseung", "baramgi", "ibyeol", "pyeongsaeng", "bamgijil", "sseom", "jjak", "jaehoe", "sokgunghap", "insun"] },
    claim: "비교와 경쟁이 개입할 때 관계의 온도가 흔들리고, 가진 것을 나눠야 하는 자리에서 특히 예민해지는 구조",
    safePhrasing: "그렇게 흔들리기 쉬운",
    forbidden: ["빼앗긴다", "삼각관계가 생긴다"],
    source: "십성 — 겁재는 재를 나눈다(奪財). 경쟁·분할.",
  },

  // ── 배우자궁(일지) ──────────────────────────────────────
  // 일지는 배우자가 앉는 자리로 본다. 그 자리에 무엇이 앉았는지, 그 자리가 충을 맞는지가
  // 관계 리딩에서 가장 직접적인 근거다. 배우자성은 여자 관성, 남자 재성.
  {
    id: "SPOUSE-STAR-F",
    priority: 86,
    when: { gender: ["F"], dayBranchTenGod: ["정관", "편관"] , domains: ["gyeolhon", "jaehoe", "insun", "pyeongsaeng", "sokgunghap", "ibyeol"] },
    claim: "배우자 자리에 배우자를 뜻하는 글자가 앉아, 관계가 삶의 중심으로 들어오기 쉬운 구조",
    safePhrasing: "그렇게 놓인 자리",
    forbidden: ["좋은 남편을 만난다", "반드시 결혼한다"],
    source: "궁위 — 일지는 배우자궁. 여자 사주에서 관성이 배우자성.",
  },
  {
    id: "SPOUSE-STAR-M",
    priority: 86,
    when: { gender: ["M"], dayBranchTenGod: ["정재", "편재"] , domains: ["gyeolhon", "jaehoe", "insun", "pyeongsaeng", "sokgunghap", "ibyeol"] },
    claim: "배우자 자리에 배우자를 뜻하는 글자가 앉아, 관계가 삶의 중심으로 들어오기 쉬운 구조",
    safePhrasing: "그렇게 놓인 자리",
    forbidden: ["좋은 아내를 만난다", "반드시 결혼한다"],
    source: "궁위 — 일지는 배우자궁. 남자 사주에서 재성이 배우자성.",
  },
  {
    id: "SPOUSE-PALACE-CHUNG",
    priority: 88,
    when: { dayBranchClashed: true , domains: ["gyeolhon", "ibyeol", "gwontaegi", "jaehoe", "pyeongsaeng", "bamgijil", "insun"] },
    claim: "배우자 자리가 충을 맞아, 가까운 사이일수록 같은 지점에서 크게 부딪히는 구조",
    safePhrasing: "그 자리가 흔들리는",
    forbidden: ["이혼한다", "결혼하면 안 된다"],
    source: "궁위 — 일지 충은 배우자궁이 흔들리는 것으로 본다.",
  },

  {
    // 여자 명식에서 관성은 배우자성이고 상관이 그 관성을 극한다(상관견관).
    // 이 규칙이 여자 상관운 정책이 실제로 말할 수 있는 전부다 — 플래그 하나에
    // 규칙 하나. 여기 없는 말은 정책이 켜져 있어도 나가지 않는다.
    id: "LUCK-SANGGWAN-GYEONGWAN-F",
    priority: 83,
    when: {
      gender: ["F"],
      femaleShangguanCandidate: true,
      domains: ["ibyeol", "gwontaegi", "gyeolhon", "jaehoe", "yeonae"],
    },
    claim: "지금 흐름이 하고 싶은 말을 밀어내는 쪽으로 서 있어, 참아 온 말이 관계의 규칙과 부딪히기 쉬운 때",
    safePhrasing: "그렇게 부딪히기 쉬운",
    forbidden: [
      "남편과 싸운다",
      "이혼한다",
      "관계가 끝난다",
      "남자 복이 없다",
      "말을 참아야 한다",
    ],
    source:
      "십성 + 운 — 상관견관. 여자 사주에서 관성은 배우자성이고 상관이 그것을 극한다. " +
      "명식에 관성이 실제로 있을 때만 성립하며(luck-flags.ts), 결과가 아니라 마찰의 방향으로만 읽는다.",
  },

  // ── 형(刑) ─────────────────────────────────────────────
  // 형은 충처럼 한 번에 깨지 않고 안에서 긁는다. 그래서 관계에서는
  // "터졌다"가 아니라 "같은 자리에서 반복해 걸린다"로 읽는다.
  // 부분 삼형(두 글자)을 실질로 볼지는 XING_PARTIAL_POLICY 가 정한다.
  {
    id: "XING-YINSISHEN",
    priority: 80,
    when: {
      xingKind: ["yin_si_shen_three_xing"],
      // 무은지형은 세 글자가 다 선 삼형의 상의다. 두 글자에 씌우면 명식에 없는
      // 글자의 해석을 주게 된다 — 감사에서 잡힌 이론 오적용이 정확히 이것이다.
      xingCompleteness: ["complete"],
      domains: ["ibyeol", "gwontaegi", "jaehoe", "pyeongsaeng", "bamgijil", "sokgunghap", "gyeolhon"],
    },
    claim: "들인 만큼이 그대로 돌아오지 않는 자리라, 애쓴 쪽이 먼저 지치기 쉬운 구조",
    safePhrasing: "그렇게 어긋나는",
    forbidden: ["배신당한다", "이용당한다", "손해를 본다"],
    source: "형 — 인사신 삼형(무은지형). 은혜가 은혜로 돌아오지 않는 어긋남으로 본다. 세 글자가 다 설 때만.",
  },
  // ── 두 글자만 선 형 ───────────────────────────────────
  //
  // 삼형의 상의(무은지형·지세지형)를 걷어내고 나니 두 글자짜리에 할 말이 없어졌다.
  // 그런데 그건 해석이 없어서가 아니라 뭉뚱그려 불렀기 때문이다. 고전은 선 글자로
  // 부르고 선 글자로 읽는다. 여섯 쌍은 성질이 제각기 다르다 —
  // 사신은 육합이 겹치고, 인신·축미는 충이 겹치고, 축술·술미는 창고끼리 부딪힌다.
  //
  // 무게는 완성 삼형(80)보다 낮게, 궁위의 형(86)보다도 낮게 둔다. 국이 서지 않았다.
  {
    id: "XING-PAIR-SASIN",
    // 여섯 쌍 중 이것만 무게가 한 칸 높다. 육합이 함께 걸린 자리라 형 단독보다
    // 관계에서 크게 작동한다 — 걸리는데 벗어나지지가 않는다.
    priority: 73,
    when: {
      xingPair: ["사신"],
      xingCompleteness: ["partial"],
      domains: ["ibyeol", "gwontaegi", "jaehoe", "sokgunghap", "gyeolhon", "pyeongsaeng", "bamgijil"],
    },
    claim: "붙드는 힘과 걸리는 결이 같은 자리에서 나와, 쉽게 놓지도 못하면서 가까울수록 같은 대목에 걸리는 구조",
    safePhrasing: "그렇게 놓지도 편하지도 못한",
    forbidden: ["배신당한다", "이용당한다", "손해를 본다", "삼형이다", "결국 갈라선다"],
    source:
      "형 — 巳刑申. 이 쌍은 육합이 함께 걸린 자리라 합중유형(合中有刑)으로 본다. " +
      "巳中庚金과 申中丙火가 서로를 극하니, 묶여 있으면서 안에서 긁는다.",
  },
  {
    id: "XING-PAIR-INSA",
    priority: 70,
    when: {
      xingPair: ["인사"],
      xingCompleteness: ["partial"],
      domains: ["ibyeol", "gwontaegi", "jaehoe", "sokgunghap", "pyeongsaeng", "bamgijil"],
    },
    claim: "도우려고 낸 힘이 그대로 돌아오지 않아, 먼저 마음 쓴 쪽이 서운함을 안고 가는 구조",
    safePhrasing: "그렇게 어긋나기 쉬운",
    forbidden: ["배신당한다", "이용당한다", "손해를 본다", "삼형이다"],
    source:
      "형 — 寅刑巳. 목이 화를 생하는 상생 관계인데도 형이 선다. 寅中戊土와 巳中庚金이 " +
      "어긋나는 자리라, 준 것과 돌아오는 것의 결이 달라진다.",
  },
  {
    id: "XING-PAIR-INSIN",
    priority: 72,
    when: {
      xingPair: ["인신"],
      xingCompleteness: ["partial"],
      domains: ["ibyeol", "gwontaegi", "jaehoe", "sokgunghap", "hwanseung", "pyeongsaeng", "bamgijil"],
    },
    claim: "부딪히면 그 자리에 머물지 않고 상황 자체가 크게 움직여, 갈등이 곧 자리 이동으로 이어지는 구조",
    safePhrasing: "그렇게 크게 움직이는",
    forbidden: ["헤어진다", "떠나게 된다", "삼형이다", "이사한다"],
    source:
      "형 — 寅刑申. 이 쌍은 인신충이 함께 걸린 자리다. 둘 다 역마(驛馬)의 글자라 " +
      "충과 형이 겹치면 마찰이 정지가 아니라 이동으로 나간다.",
  },
  {
    id: "XING-CHOUXUWEI",
    priority: 80,
    when: {
      xingKind: ["chou_xu_wei_three_xing"],
      xingCompleteness: ["complete"],
      domains: ["gwontaegi", "ibyeol", "gyeolhon", "pyeongsaeng", "jaehoe", "sokgunghap", "bamgijil"],
    },
    claim: "서로 물러설 근거가 있어서 오히려 안 굽히는 자리라, 옳고 그름을 가리다 사이가 상하는 구조",
    safePhrasing: "그렇게 맞부딪히는",
    forbidden: ["싸움이 끊이지 않는다", "결국 갈라선다"],
    source: "형 — 축술미 삼형(지세지형). 각자 세력을 믿고 밀어붙이는 충돌로 본다. 세 글자가 다 설 때만.",
  },
  {
    id: "XING-PAIR-CHUKMI",
    priority: 71,
    when: {
      xingPair: ["축미"],
      xingCompleteness: ["partial"],
      domains: ["gwontaegi", "ibyeol", "gyeolhon", "jaehoe", "sokgunghap", "pyeongsaeng", "bamgijil"],
    },
    claim: "밀어내면서도 결국 같은 자리라 완전히 갈라지지는 않고, 같은 다툼이 같은 대목에서 되돌아오는 구조",
    safePhrasing: "그렇게 되돌아오는",
    forbidden: ["싸움이 끊이지 않는다", "결국 갈라선다", "세력 싸움이다", "삼형이다"],
    source:
      "형 — 丑刑未. 이 쌍은 축미충이 함께 걸린 자리다. 둘 다 토라 충으로 밀어내도 " +
      "성질이 같아 멀리 못 간다. 丑中辛金·癸水와 未中丁火·乙木이 서로 극하니 안에서 긁힌다.",
  },
  {
    id: "XING-PAIR-CHUKSUL",
    priority: 69,
    when: {
      xingPair: ["축술"],
      xingCompleteness: ["partial"],
      domains: ["gwontaegi", "ibyeol", "gyeolhon", "jaehoe", "sokgunghap", "bimil", "pyeongsaeng"],
    },
    claim: "묻어 두었던 것이 부딪히는 순간 한꺼번에 열려, 오래된 이야기가 지금 다툼에 섞여 나오는 구조",
    safePhrasing: "그렇게 열리는",
    forbidden: ["과거가 발목을 잡는다", "비밀이 드러난다", "삼형이다", "결국 갈라선다"],
    source:
      "형 — 丑刑戌. 축토는 금의 고지, 술토는 화의 고지다. 창고끼리 부딪히면 " +
      "안에 갈무리해 둔 것이 나온다고 본다(개고, 開庫).",
  },
  {
    id: "XING-PAIR-SULMI",
    priority: 69,
    when: {
      xingPair: ["술미"],
      xingCompleteness: ["partial"],
      domains: ["gwontaegi", "ibyeol", "gyeolhon", "jaehoe", "sokgunghap", "pyeongsaeng", "bamgijil"],
    },
    claim: "둘 다 무를 자리가 없어 한번 부딪히면 완충 없이 그대로 닿는, 말이 곧장 세게 가는 구조",
    safePhrasing: "그렇게 곧장 닿는",
    forbidden: ["싸움이 끊이지 않는다", "성격이 나쁘다", "삼형이다", "결국 갈라선다"],
    source:
      "형 — 戌刑未. 술과 미는 둘 다 조토(燥土)다. 축·진 같은 습토가 사이에 없으면 " +
      "부딪힘을 눅여 줄 자리가 없다고 본다.",
  },
  {
    id: "XING-ZIMAO",
    priority: 82,
    when: {
      xingKind: ["zi_mao_mutual_xing"],
      domains: ["ibyeol", "gwontaegi", "sokgunghap", "bamgijil", "pyeongsaeng"],
    },
    claim: "가까워질수록 말이 거칠어지는 자리라, 감정보다 말투가 먼저 사이를 깎는 구조",
    safePhrasing: "그렇게 날이 서는",
    forbidden: ["폭언한다", "성격이 나쁘다", "헤어진다"],
    source: "형 — 자묘 상형(무례지형). 예의가 무너지는 방향으로 본다.",
  },
  {
    id: "XING-SELF",
    priority: 74,
    when: {
      xingKind: [
        "chen_chen_self_xing",
        "wu_wu_self_xing",
        "you_you_self_xing",
        "hai_hai_self_xing",
      ],
      domains: ["gwontaegi", "sseom", "jjak", "bimil", "pyeongsaeng", "yeonae", "ibyeol", "insun"],
    },
    claim: "밖에서 온 문제보다 혼자 되짚는 시간이 관계를 더 흔드는 구조",
    safePhrasing: "그렇게 안으로 도는",
    forbidden: ["자학한다", "우울증이 있다", "정신적으로 문제가 있다"],
    source: "형 — 자형(自刑). 같은 글자가 겹쳐 밖이 아니라 안에서 긁는 것으로 본다.",
  },
  {
    id: "XING-SPOUSE-PALACE",
    priority: 86,
    when: {
      xingAtDayBranch: true,
      domains: ["gyeolhon", "ibyeol", "gwontaegi", "jaehoe", "sokgunghap", "pyeongsaeng", "insun"],
    },
    claim: "배우자 자리가 형에 걸려, 다른 관계에선 안 나오는 문제가 가까운 사이에서만 반복되는 구조",
    safePhrasing: "그 자리에 걸려 있는",
    forbidden: ["이혼한다", "결혼 운이 없다", "배우자가 문제다"],
    source: "궁위 + 형 — 일지는 배우자궁. 그 자리의 형은 관계 안에서만 드러나는 마찰로 본다.",
  },
  {
    id: "XING-LUCK-NOW",
    // 무작위 명식 768건에서 63.0% 발화한다(부분 삼형 off 면 43.8%). 계산은 정확하다 —
    // 대운·세운이 지지 셋을 더하니 그만큼 겹칠 자리가 늘어난다. 다만 3분의 2가 공유하는
    // 신호를 맨 앞에 세우면 리딩이 서로 비슷해지므로, 명식 고유의 형(80~86)보다
    // 뒤에 세운다. 계산이 아니라 노출의 문제다(docs/myeongri/rule-boundaries.md).
    priority: 79,
    when: {
      xingLuckScope: ["대운", "세운"],
      domains: ["ibyeol", "jaehoe", "gwontaegi", "hwanseung", "insun", "yeonae", "sokgunghap"],
    },
    claim: "지금 지나는 흐름이 명식의 글자와 형을 이뤄, 평소엔 넘어가던 지점이 이 구간에만 크게 걸리는 때",
    safePhrasing: "지금 그렇게 겹치는",
    forbidden: ["올해 헤어진다", "이 시기에 반드시 일이 생긴다", "지금 만나면 안 된다"],
    source: "형 + 운 — 대운·세운의 지지가 원국 지지와 형을 이룰 때. 지나가는 것이라 원국의 형과 무게를 나눈다.",
  },
  {
    id: "XING-LUCK-MONTH",
    priority: 70,
    when: {
      xingLuckScope: ["월운"],
      domains: ["jaehoe", "sseom", "yeonae", "hwanseung", "ibyeol", "insun"],
    },
    claim: "이달만 유독 같은 대목에서 걸리는 흐름이라, 길게 볼 신호로 삼기엔 이른 때",
    safePhrasing: "이달에 겹치는",
    forbidden: ["이번 달에 연락이 온다", "이번 달에 끝난다"],
    source: "형 + 월운 — 월운의 형은 가장 짧게 지나므로 구조로 읽지 않는다.",
  },

  // ── 신살 ───────────────────────────────────────────────
  {
    id: "SIN-DOHWA",
    priority: 84,
    when: { shinsal: ["도화"] , domains: ["dohwasal", "baramgi", "sokgunghap", "sseom", "yeonae", "pyeongsaeng", "bamgijil", "insun"] },
    claim: "사람을 끌어당기는 기운이 명식에 앉아, 의도하지 않아도 눈길이 모이는 자리",
    safePhrasing: "그런 기운이 앉은",
    forbidden: ["바람기가 있다", "이성이 끊이지 않는다"],
    source: "신살 — 도화(년살)는 삼합 생지의 다음 글자. 매력·인기로 본다.",
  },
  {
    id: "SIN-HONGYEOM",
    priority: 82,
    when: { shinsal: ["홍염"] , domains: ["dohwasal", "baramgi", "sokgunghap", "jjak", "sseom", "pyeongsaeng", "bamgijil", "insun"] },
    claim: "첫인상보다 오래 볼수록 번지는 색이 있어, 시간이 지나며 끌림이 커지는 결",
    safePhrasing: "그런 색이 도는",
    forbidden: ["유혹을 잘한다"],
    source: "신살 — 홍염살은 일간 기준. 도화가 드러난 매력이면 홍염은 은근한 매력으로 구분한다.",
  },
  {
    id: "SIN-YEOKMA",
    priority: 78,
    when: { shinsal: ["역마"] , domains: ["insun", "hwanseung", "yeonae", "pyeongsaeng", "bamgijil"] },
    claim: "자리와 환경이 바뀔 때 인연도 함께 움직여, 관계의 전환점이 이동과 겹치는 구조",
    safePhrasing: "그렇게 걸려 있는",
    forbidden: ["멀리 사는 사람과 반드시 만난다"],
    source: "신살 — 역마는 삼합 생지의 충. 이동·변동으로 본다.",
  },
  {
    id: "SIN-HWAGAE",
    // 3,000개 명식에서 66% 발화한다. 삼합의 고지(진술축미)가 넉 자 중 하나만 걸려도
    // 잡히고, 연지·일지가 그 자체로 고지면 스스로 화개가 되기 때문이다.
    // 이것은 계산 오류가 아니라 화개의 성질이므로 우선순위를 낮추지 않는다.
    // 화면에서 얼마나 앞세울지는 노출 정책의 문제다(docs/myeongri/rule-boundaries.md).
    priority: 76,
    when: { shinsal: ["화개"] , domains: ["bimil", "gwontaegi", "bamgijil", "pyeongsaeng", "jaehoe", "sokgunghap", "ibyeol", "insun"] },
    claim: "혼자 있는 시간에 기운이 정리되는 편이라, 붙어 있는 시간만으로는 애정이 채워지지 않는 구조",
    safePhrasing: "그런 간격이 필요한",
    forbidden: ["연애를 못 한다"],
    source: "신살 — 화개는 삼합의 고지. 고독·예술·수렴으로 본다.",
  },
  {
    id: "SIN-YANGIN",
    priority: 78,
    when: { shinsal: ["양인"] , domains: ["baramgi", "ibyeol", "gwontaegi", "pyeongsaeng", "bamgijil"] },
    claim: "밀어붙이는 힘이 강해 결정적인 순간에 관계를 단번에 밀거나 단번에 끊는 경향",
    safePhrasing: "그런 힘이 실린",
    forbidden: ["폭력적이다"],
    source: "신살 — 양인은 양간의 겁재 자리. 극왕(極旺)의 칼로 본다.",
  },
  {
    id: "SIN-WONJIN",
    priority: 80,
    when: { shinsal: ["원진"] , domains: ["ibyeol", "gwontaegi", "jaehoe", "hwanseung", "pyeongsaeng", "bamgijil", "sokgunghap", "insun"] },
    claim: "이유를 대기 어려운 거슬림이 관계 안에 깔려, 사건 없이도 마음이 멀어지는 구조",
    safePhrasing: "그렇게 걸리는 자리",
    forbidden: ["반드시 헤어진다", "악연이다"],
    source: "신살 — 원진은 지지의 미워하되 이유를 모르는 조합(자미·축오·인유·묘신·진해·사술).",
  },

  // ── 형충회합 ───────────────────────────────────────────
  {
    id: "REL-CHUNG",
    priority: 80,
    when: { relationKind: ["지지충"] , domains: ["ibyeol", "gwontaegi", "jaehoe", "pyeongsaeng", "bamgijil", "bimil", "sokgunghap", "insun"] },
    claim: "명식 안에 정면으로 부딪히는 자리가 있어, 같은 지점에서 반복해 걸려 넘어지는 구조",
    safePhrasing: "그 자리가 자주 걸리는",
    forbidden: ["관계가 깨진다"],
    source: "형충회합 — 지지충은 마주 보는 두 지지가 서로를 친다.",
  },
  {
    id: "REL-YUKHAP",
    priority: 76,
    when: { relationKind: ["지지육합"] , domains: ["sokgunghap", "gyeolhon", "insun", "pyeongsaeng", "bamgijil", "jjak", "sseom", "ibyeol"] },
    claim: "붙잡아두는 힘이 있어 한 번 맺은 관계를 길게 유지하고, 정리해야 할 때도 늦어지는 편",
    safePhrasing: "그런 힘이 있는",
    forbidden: ["절대 헤어지지 않는다"],
    source: "형충회합 — 육합은 두 지지가 묶여 서로를 붙든다.",
  },
  {
    id: "REL-SAMHAP",
    priority: 74,
    when: { relationKind: ["삼합"] , domains: ["sokgunghap", "gyeolhon", "insun", "pyeongsaeng", "bamgijil", "jjak", "sseom", "ibyeol"] },
    claim: "세 글자가 한 방향으로 모여 그 축의 일이 크게 벌어지고, 다른 축은 상대적으로 얇아지는 구조",
    safePhrasing: "그쪽으로 쏠리는",
    forbidden: ["뭐든 이룬다"],
    source: "형충회합 — 삼합은 생지·왕지·고지가 모여 한 국(局)을 이룬다.",
  },
  {
    id: "REL-CHEONHAP",
    priority: 72,
    when: { relationKind: ["천간합"] , domains: ["sokgunghap", "jjak", "bimil", "pyeongsaeng", "bamgijil", "sseom", "ibyeol", "insun"] },
    claim: "천간이 서로 묶여 본래의 성정이 그대로 나오지 못하는 자리가 있어, 상대에 따라 다른 사람처럼 보이는 구조",
    safePhrasing: "그렇게 묶이는",
    forbidden: ["이중인격이다"],
    source: "형충회합 — 천간합은 합화(合化)하거나 기반(羈絆)되어 본래 작용이 묶인다.",
  },

  // ── 운(대운·세운) ──────────────────────────────────────
  // 같은 십성운도 남녀에 따라 관계에서의 의미가 갈린다. 배우자성이 다르기 때문이다.
  {
    id: "LUCK-GWAN-F",
    priority: 90,
    when: { gender: ["F"], luckTenGodAny: ["정관", "편관"] , domains: ["jaehoe", "gyeolhon", "insun", "yeonae", "pyeongsaeng", "bamgijil", "ibyeol"] },
    claim: "지금 구간은 배우자성이 들어와 인연과 관계의 형태가 표면으로 올라오는 흐름",
    safePhrasing: "그런 결이 도는 구간",
    forbidden: ["올해 반드시 결혼한다", "곧 인연이 나타난다"],
    source: "운 — 여자 사주에서 관성은 배우자성. 관성운에 관계 사안이 부각된다.",
  },
  {
    id: "LUCK-GWAN-M",
    priority: 84,
    when: { gender: ["M"], luckTenGodAny: ["정관", "편관"] , domains: ["jaehoe", "gyeolhon", "insun", "yeonae", "pyeongsaeng", "bamgijil", "ibyeol"] },
    claim: "지금 구간은 책임과 평가가 커져, 관계보다 자기 위치를 지키는 쪽으로 힘이 쏠리는 흐름",
    safePhrasing: "그런 무게가 실린 구간",
    forbidden: ["연애할 시간이 없다"],
    source: "운 — 남자 사주에서 관성은 직위·책임. 배우자성이 아니다.",
  },
  {
    id: "LUCK-JAE-M",
    priority: 90,
    when: { gender: ["M"], luckTenGodAny: ["정재", "편재"] , domains: ["jaehoe", "gyeolhon", "insun", "yeonae", "pyeongsaeng", "bamgijil", "ibyeol"] },
    claim: "지금 구간은 배우자성이 들어와 만남의 기회가 늘고 선택지가 벌어지는 흐름",
    safePhrasing: "그렇게 열리는 구간",
    forbidden: ["곧 인연이 나타난다", "여러 명을 만난다"],
    source: "운 — 남자 사주에서 재성은 배우자성. 재성운에 인연 사안이 부각된다.",
  },
  {
    id: "LUCK-JAE-F",
    priority: 84,
    when: { gender: ["F"], luckTenGodAny: ["정재", "편재"] , domains: ["jaehoe", "gyeolhon", "insun", "yeonae", "pyeongsaeng", "bamgijil", "ibyeol"] },
    claim: "지금 구간은 바깥일과 활동이 늘어, 관계에 쓸 여력이 줄고 우선순위가 밀리기 쉬운 흐름",
    safePhrasing: "그렇게 바빠지는 구간",
    forbidden: ["돈은 벌지만 사랑은 못 한다"],
    source: "운 — 여자 사주에서 재성은 활동·재물. 배우자성이 아니다.",
  },
  {
    id: "LUCK-IN",
    priority: 82,
    when: { luckTenGodAny: ["정인", "편인"] , domains: ["insun", "yeonae", "gwontaegi", "pyeongsaeng", "bamgijil", "jjak", "bimil", "ibyeol"] },
    claim: "지금 구간은 밖으로 벌이기보다 안으로 정리하는 쪽에 힘이 실려, 관계도 확장보다 점검에 맞는 흐름",
    safePhrasing: "그런 시기",
    forbidden: ["연애운이 없다"],
    source: "운 — 인성운은 수용·학습·휴식. 확장보다 축적의 구간으로 본다.",
  },
  {
    id: "LUCK-SIKSANG",
    priority: 82,
    when: { luckTenGodAny: ["식신", "상관"] , domains: ["insun", "yeonae", "sseom", "dohwasal", "pyeongsaeng", "bamgijil", "jjak", "bimil", "jaehoe", "sokgunghap", "ibyeol"] },
    claim: "지금 구간은 말과 표현이 관계를 크게 움직여, 한 마디가 평소보다 멀리 가는 흐름",
    safePhrasing: "그런 힘이 실린 구간",
    forbidden: ["말하면 반드시 이루어진다"],
    source: "운 — 식상운은 내보내는 기운. 표현이 커진다.",
  },
  {
    id: "LUCK-BIGEOP",
    priority: 84,
    when: { luckTenGodAny: ["비견", "겁재"] , domains: ["hwanseung", "baramgi", "ibyeol", "yeonae", "pyeongsaeng", "bamgijil"] },
    claim: "지금 구간은 사람이 끼어들며 관계의 지분이 흔들리기 쉬워, 둘 사이의 일이 셋의 일이 되는 흐름",
    safePhrasing: "그렇게 흔들릴 수 있는 구간",
    forbidden: ["삼각관계가 생긴다", "빼앗긴다"],
    source: "운 — 비겁운은 나눔·경쟁. 재(財)를 나누는 자리로 본다.",
  },

  // ── 두 명식 사이 ───────────────────────────────────────
  // 일지끼리의 관계가 궁합의 뼈대다. 일간끼리의 합은 태도의 변화로 읽는다.
  {
    id: "PAIR-YUKHAP",
    priority: 92,
    when: { needsPartner: true, pairRelation: ["일지육합"] , domains: ["sokgunghap", "gyeolhon", "jjak", "sseom", "jaehoe", "bimil", "ibyeol"] },
    claim: "두 사람의 배우자 자리가 서로를 붙잡는 조합이라, 떨어져도 다시 당겨지는 구조",
    safePhrasing: "그렇게 맞물린",
    forbidden: ["천생연분이다", "반드시 이어진다"],
    source: "궁합 — 일지 육합은 배우자궁끼리 묶이는 조합.",
  },
  {
    id: "PAIR-SAMHAP",
    priority: 90,
    when: { needsPartner: true, pairRelation: ["일지삼합"] , domains: ["sokgunghap", "gyeolhon", "jjak", "sseom", "jaehoe", "bimil", "ibyeol"] },
    claim: "두 배우자 자리가 같은 국에 들어 방향이 같은 쪽으로 모이는 구조",
    safePhrasing: "그쪽으로 함께 기우는",
    forbidden: ["운명적인 만남이다"],
    source: "궁합 — 일지가 같은 삼합국에 속하면 지향이 겹친다.",
  },
  {
    id: "PAIR-CHUNG",
    priority: 92,
    when: { needsPartner: true, pairRelation: ["일지충"] , domains: ["sokgunghap", "ibyeol", "gwontaegi", "jaehoe", "hwanseung", "jjak", "sseom"] },
    claim: "두 사람의 배우자 자리가 정면으로 부딪히는 조합이라, 가까워질수록 같은 지점에서 크게 갈리는 구조",
    safePhrasing: "그 자리가 걸리는",
    forbidden: ["만나면 안 되는 사이다", "반드시 헤어진다"],
    source: "궁합 — 일지 충은 배우자궁끼리 마주쳐 부딪히는 조합.",
  },
  {
    id: "PAIR-WONJIN",
    priority: 88,
    when: { needsPartner: true, pairRelation: ["일지원진"] , domains: ["ibyeol", "gwontaegi", "hwanseung", "baramgi"] },
    claim: "설명하기 어려운 거슬림이 두 사람 사이에 깔려, 다툴 일이 없는데도 마음이 식는 구간이 생기는 구조",
    safePhrasing: "그렇게 걸리기 쉬운",
    forbidden: ["악연이다"],
    source: "궁합 — 일지 원진은 이유 없는 거슬림으로 본다.",
  },
  {
    id: "PAIR-GANHAP",
    priority: 88,
    when: { needsPartner: true, pairRelation: ["일간합"] , domains: ["sokgunghap", "gyeolhon", "jjak", "bimil", "jaehoe", "ibyeol"] },
    claim: "두 일간이 묶이는 조합이라 서로 앞에서만 태도가 달라지고, 제3자가 보는 모습과 차이가 나는 구조",
    safePhrasing: "그렇게 반응하는",
    forbidden: ["서로밖에 없다"],
    source: "궁합 — 일간 천간합은 두 사람이 서로에게 기반(羈絆)되는 조합.",
  },

  // ── 계산의 한계 ────────────────────────────────────────
  {
    id: "META-NO-HOUR",
    priority: 96,
    when: { hourUnknown: true },
    claim: "출생 시각이 없어 시주가 서지 않으므로, 시주에 기댄 해석은 범위를 넓게 잡아야 함",
    safePhrasing: "단정하지 않고 폭을 두는",
    forbidden: ["시주로 보면", "시주가 말해주듯"],
    source: "계산 한계 — 시주 미상. saju_facts.fourPillars.hour가 null이다.",
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

/** 일지가 명식 안에서 충을 맞는가 */
function dayBranchClashed(facts: SajuFacts): boolean {
  const day = facts.fourPillars.day.branch;
  return facts.notableRelations.some(
    (relation) => relation.kind === "지지충" && relation.members.includes(day)
  );
}

function matches(rule: ReadingRule, me: SajuFacts, partner: SajuFacts | null, productId: string): boolean {
  const w = rule.when;
  if (w.domains && !w.domains.includes(productId)) return false;
  if (w.needsPartner && !partner) return false;
  if (w.gender && !w.gender.includes(me.gender)) return false;

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
  if (w.dayBranchClashed !== undefined && w.dayBranchClashed !== dayBranchClashed(me)) return false;

  if (w.dayBranchTenGod) {
    const seated = me.tenGods.find((t) => t.position === "일지")?.tenGod;
    if (!seated || !w.dayBranchTenGod.includes(seated)) return false;
  }
  if (w.luckTenGodAny) {
    const running = [
      me.luckContext.majorLuck?.currentTenGod,
      me.luckContext.yearly.tenGod,
      me.luckContext.monthly.tenGod,
    ].filter(Boolean) as string[];
    if (!w.luckTenGodAny.some((t) => running.includes(t))) return false;
  }
  if (w.femaleShangguanCandidate !== undefined) {
    // gender 는 사용자가 입력해야만 생기는 값이라 명시된 성별로 본다.
    // 미입력 경로가 생기면 여기서 "unspecified" 를 넘겨야 한다.
    const flags = luckInterpretationFlags(me, me.gender === "F" ? "female" : "male");
    const candidate = flags.some((f) => f.flag === "female_shangguan_relationship_policy_candidate");
    if (w.femaleShangguanCandidate !== candidate) return false;
  }
  if (w.xingKind || w.xingCompleteness) {
    let active = completeXing(me.xing);
    if (w.xingCompleteness) {
      active = active.filter((x) => w.xingCompleteness!.includes(x.completeness));
    }
    if (w.xingKind && !w.xingKind.some((k) => active.some((x) => x.kind === k))) return false;
    if (!w.xingKind && active.length === 0) return false;
  }
  if (w.xingPair) {
    // 두 글자만 선 것에서만 쌍을 본다. 세 글자가 다 서면 국의 이름으로 읽는다.
    const pairs = completeXing(me.xing)
      .filter((x) => x.completeness === "partial")
      .map((x) => [...new Set(x.branches)].join(""));
    if (!w.xingPair.some((pair) => pairs.includes(pair))) return false;
  }
  if (w.xingAtDayBranch !== undefined) {
    const onDay = completeXing(me.xing).some((x) => x.pillarPositions.includes("일지"));
    if (w.xingAtDayBranch !== onDay) return false;
  }
  if (w.xingLuckScope) {
    const active = completeXing(me.xingLuck);
    if (!w.xingLuckScope.some((s) => active.some((x) => x.luckSources?.includes(s)))) return false;
  }
  if (w.pairRelation) {
    const relations = pairRelationsOf(me, partner);
    if (!w.pairRelation.some((r) => relations.includes(r))) return false;
  }

  // ── 상대 명식 ──
  const needsPartnerFacts =
    w.partnerStrength ||
    w.partnerMissingElement ||
    w.partnerLuckTenGodAny ||
    w.partnerDominantTenGod ||
    w.partnerHiddenStem ||
    w.partnerAbsentElement ||
    w.partnerHiddenOnlyElement ||
    w.partnerShinsal ||
    w.partnerDayBranchTenGod ||
    w.partnerRelationBundle ||
    w.pairElementComplement ||
    w.pairMonthBranchRelation;
  if (needsPartnerFacts && !partner) return false;
  if (partner) {
    if (w.partnerStrength && !w.partnerStrength.includes(partner.strength.label)) return false;
    if (w.partnerMissingElement && !w.partnerMissingElement.some((e) => partner.missingElements.includes(e))) {
      return false;
    }
    if (w.partnerDominantTenGod && !w.partnerDominantTenGod.some((t) => partner.dominantTenGods.includes(t))) {
      return false;
    }
    if (w.partnerDayBranchTenGod) {
      const seated = partner.tenGods.find((t) => t.position === "일지")?.tenGod;
      if (!seated || !w.partnerDayBranchTenGod.includes(seated)) return false;
    }
    if (w.partnerAbsentElement && !w.partnerAbsentElement.some((e) => partner.absentElements.includes(e))) {
      return false;
    }
    if (
      w.partnerHiddenOnlyElement &&
      !w.partnerHiddenOnlyElement.some((e) => partner.hiddenOnlyElements.includes(e))
    ) {
      return false;
    }
    if (w.partnerShinsal && !w.partnerShinsal.some((name) => partner.shinsal.some((x) => x.name === name))) {
      return false;
    }
    if (w.partnerLuckTenGodAny) {
      const running = [
        partner.luckContext.majorLuck?.currentTenGod,
        partner.luckContext.yearly.tenGod,
        partner.luckContext.monthly.tenGod,
      ].filter(Boolean) as string[];
      if (!w.partnerLuckTenGodAny.some((t) => running.includes(t))) return false;
    }
    if (w.partnerHiddenStem && !w.partnerHiddenStem.some((stem) => hiddenStemsIn(partner).includes(stem))) {
      return false;
    }
    if (w.partnerRelationBundle && !w.partnerRelationBundle.some((shape) => bundleShapes(partner).includes(shape))) {
      return false;
    }
    // 한쪽에 없는 오행을 다른 쪽이 갖고 있는가. 방향은 양쪽 다 본다 —
    // 내가 못 채우는 것을 상대가 채우는 것도, 그 반대도 같은 자리의 일이다.
    if (w.pairElementComplement) {
      const complements = (a: SajuFacts, b: SajuFacts) =>
        a.missingElements.filter((e) => b.elementBalance[e] > 0);
      const both = [...complements(me, partner), ...complements(partner, me)];
      if (!w.pairElementComplement.some((e) => both.includes(e))) return false;
    }
    if (w.pairMonthBranchRelation) {
      const found = monthBranchRelations(me, partner);
      if (!w.pairMonthBranchRelation.some((r) => found.includes(r))) return false;
    }
  }
  return true;
}

/** 상대 지지에 숨어 있는 천간 전부 */
function hiddenStemsIn(facts: SajuFacts): string[] {
  const branches = [
    facts.fourPillars.year.branch,
    facts.fourPillars.month.branch,
    facts.fourPillars.day.branch,
    facts.fourPillars.hour?.branch,
  ].filter(Boolean) as string[];
  return [
    ...new Set(
      branches.flatMap((b) => {
        const idx = JIJI.indexOf(b as (typeof JIJI)[number]);
        return idx < 0 ? [] : hiddenStemsOf(idx).map((h) => h.stem);
      })
    ),
  ];
}

/** 한 자리에 겹친 관계의 꼴 — 번들이 이미 세어 둔 것을 이름으로 옮긴다 */
function bundleShapes(facts: SajuFacts): string[] {
  const out: string[] = [];
  for (const bundle of facts.relationBundles) {
    const kinds = new Set(bundle.relations.map((r) => r.kind));
    const combo = kinds.has("지지육합") || kinds.has("삼합");
    if (kinds.has("형") && combo) out.push("합+형");
    if (kinds.has("형") && kinds.has("지지충")) out.push("충+형");
    if (kinds.has("지지충") && combo) out.push("합+충");
  }
  return out;
}

/** 월지끼리의 관계 — 일지가 배우자 자리라면 월지는 두 사람이 함께 선 사회 자리다 */
function monthBranchRelations(me: SajuFacts, partner: SajuFacts): string[] {
  const a = JIJI.indexOf(me.fourPillars.month.branch as (typeof JIJI)[number]);
  const b = JIJI.indexOf(partner.fourPillars.month.branch as (typeof JIJI)[number]);
  if (a < 0 || b < 0) return [];
  const pairHit = (pairs: [number, number][]) =>
    pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  const out: string[] = [];
  if (pairHit(BRANCH_SIX_COMBOS)) out.push("육합");
  if (pairHit(BRANCH_CLASHES)) out.push("충");
  if (pairHit(WONJIN)) out.push("원진");
  if (a !== b && BRANCH_TRIPLES.some(([members]) => members.includes(a) && members.includes(b))) {
    out.push("삼합");
  }
  return out;
}

/**
 * 이 명식에서 켜지는 규칙을 우선순위 순으로. 모델에는 상위 몇 개만 실어
 * 한 리포트가 감당할 수 있는 만큼만 주장하게 한다.
 */
/**
 * 상대 규칙에 남겨 두는 최소 자리.
 *
 * 상대 규칙의 무게는 본인 규칙보다 낮게 잡혀 있다(60~68). 그게 맞다 — 이 리포트를
 * 사는 사람은 본인이다. 그런데 우선순위로만 자르면 상대 규칙이 **통째로 밀려난다.**
 * 궁합 상품에서 그것은 두 사람 중 한 사람이 사라진다는 뜻이다.
 * 그래서 자리를 조금 남겨 둔다. 남길 뿐이고, 없으면 안 채운다.
 */
const PARTNER_RULE_FLOOR = 5;

export function matchRules(
  me: SajuFacts,
  partner: SajuFacts | null,
  productId: string,
  limit = 12
): ReadingRule[] {
  // 상대 규칙은 등재부에서 승인된 것만 들어온다. 조건이 계산된다고 켜지지 않는다 —
  // 상대는 이 자리에 없는 사람이라 틀려도 아무도 못 잡는다(myeongri-policy/partner-rules.ts).
  const pool = [...READING_RULES, ...approvedPartnerRules()];
  const matched = pool
    .filter((rule) => matches(rule, me, partner, productId))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  if (matched.length <= limit) return matched;

  const partnerMatched = matched.filter((rule) => isPartnerRule(rule.id));
  const reserved = Math.min(PARTNER_RULE_FLOOR, partnerMatched.length, Math.floor(limit / 3));
  if (reserved === 0) return matched.slice(0, limit);

  const head = matched.slice(0, limit - reserved);
  const taken = new Set(head.map((rule) => rule.id));
  const filled = [...head];
  for (const rule of partnerMatched) {
    if (filled.length >= limit) break;
    if (taken.has(rule.id)) continue;
    filled.push(rule);
    taken.add(rule.id);
  }
  // 자리를 남겨 뒀는데 상대 규칙이 이미 앞자리에 다 들어와 있으면 그만큼 되돌려 채운다.
  for (const rule of matched) {
    if (filled.length >= limit) break;
    if (taken.has(rule.id)) continue;
    filled.push(rule);
    taken.add(rule.id);
  }
  return filled.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
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
