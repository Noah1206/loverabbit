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
    id: "SELF-BALANCED",
    priority: 58,
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
    when: { tenGodAny: ["편재"] },
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
    when: { tenGodAny: ["상관"] },
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
    when: { tenGodAny: ["겁재"] },
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
    when: { gender: ["F"], dayBranchTenGod: ["정관", "편관"] },
    claim: "배우자 자리에 배우자를 뜻하는 글자가 앉아, 관계가 삶의 중심으로 들어오기 쉬운 구조",
    safePhrasing: "그렇게 놓인 자리",
    forbidden: ["좋은 남편을 만난다", "반드시 결혼한다"],
    source: "궁위 — 일지는 배우자궁. 여자 사주에서 관성이 배우자성.",
  },
  {
    id: "SPOUSE-STAR-M",
    priority: 86,
    when: { gender: ["M"], dayBranchTenGod: ["정재", "편재"] },
    claim: "배우자 자리에 배우자를 뜻하는 글자가 앉아, 관계가 삶의 중심으로 들어오기 쉬운 구조",
    safePhrasing: "그렇게 놓인 자리",
    forbidden: ["좋은 아내를 만난다", "반드시 결혼한다"],
    source: "궁위 — 일지는 배우자궁. 남자 사주에서 재성이 배우자성.",
  },
  {
    id: "SPOUSE-PALACE-CHUNG",
    priority: 88,
    when: { dayBranchClashed: true },
    claim: "배우자 자리가 충을 맞아, 가까운 사이일수록 같은 지점에서 크게 부딪히는 구조",
    safePhrasing: "그 자리가 흔들리는",
    forbidden: ["이혼한다", "결혼하면 안 된다"],
    source: "궁위 — 일지 충은 배우자궁이 흔들리는 것으로 본다.",
  },

  // ── 신살 ───────────────────────────────────────────────
  {
    id: "SIN-DOHWA",
    priority: 84,
    when: { shinsal: ["도화"] },
    claim: "사람을 끌어당기는 기운이 명식에 앉아, 의도하지 않아도 눈길이 모이는 자리",
    safePhrasing: "그런 기운이 앉은",
    forbidden: ["바람기가 있다", "이성이 끊이지 않는다"],
    source: "신살 — 도화(년살)는 삼합 생지의 다음 글자. 매력·인기로 본다.",
  },
  {
    id: "SIN-HONGYEOM",
    priority: 82,
    when: { shinsal: ["홍염"] },
    claim: "첫인상보다 오래 볼수록 번지는 색이 있어, 시간이 지나며 끌림이 커지는 결",
    safePhrasing: "그런 색이 도는",
    forbidden: ["유혹을 잘한다"],
    source: "신살 — 홍염살은 일간 기준. 도화가 드러난 매력이면 홍염은 은근한 매력으로 구분한다.",
  },
  {
    id: "SIN-YEOKMA",
    priority: 78,
    when: { shinsal: ["역마"] },
    claim: "자리와 환경이 바뀔 때 인연도 함께 움직여, 관계의 전환점이 이동과 겹치는 구조",
    safePhrasing: "그렇게 걸려 있는",
    forbidden: ["멀리 사는 사람과 반드시 만난다"],
    source: "신살 — 역마는 삼합 생지의 충. 이동·변동으로 본다.",
  },
  {
    id: "SIN-HWAGAE",
    priority: 76,
    when: { shinsal: ["화개"] },
    claim: "혼자 있는 시간에 기운이 정리되는 편이라, 붙어 있는 시간만으로는 애정이 채워지지 않는 구조",
    safePhrasing: "그런 간격이 필요한",
    forbidden: ["연애를 못 한다"],
    source: "신살 — 화개는 삼합의 고지. 고독·예술·수렴으로 본다.",
  },
  {
    id: "SIN-YANGIN",
    priority: 78,
    when: { shinsal: ["양인"] },
    claim: "밀어붙이는 힘이 강해 결정적인 순간에 관계를 단번에 밀거나 단번에 끊는 경향",
    safePhrasing: "그런 힘이 실린",
    forbidden: ["폭력적이다"],
    source: "신살 — 양인은 양간의 겁재 자리. 극왕(極旺)의 칼로 본다.",
  },
  {
    id: "SIN-WONJIN",
    priority: 80,
    when: { shinsal: ["원진"] },
    claim: "이유를 대기 어려운 거슬림이 관계 안에 깔려, 사건 없이도 마음이 멀어지는 구조",
    safePhrasing: "그렇게 걸리는 자리",
    forbidden: ["반드시 헤어진다", "악연이다"],
    source: "신살 — 원진은 지지의 미워하되 이유를 모르는 조합(자미·축오·인유·묘신·진해·사술).",
  },

  // ── 형충회합 ───────────────────────────────────────────
  {
    id: "REL-CHUNG",
    priority: 80,
    when: { relationKind: ["지지충"] },
    claim: "명식 안에 정면으로 부딪히는 자리가 있어, 같은 지점에서 반복해 걸려 넘어지는 구조",
    safePhrasing: "그 자리가 자주 걸리는",
    forbidden: ["관계가 깨진다"],
    source: "형충회합 — 지지충은 마주 보는 두 지지가 서로를 친다.",
  },
  {
    id: "REL-YUKHAP",
    priority: 76,
    when: { relationKind: ["지지육합"] },
    claim: "붙잡아두는 힘이 있어 한 번 맺은 관계를 길게 유지하고, 정리해야 할 때도 늦어지는 편",
    safePhrasing: "그런 힘이 있는",
    forbidden: ["절대 헤어지지 않는다"],
    source: "형충회합 — 육합은 두 지지가 묶여 서로를 붙든다.",
  },
  {
    id: "REL-SAMHAP",
    priority: 74,
    when: { relationKind: ["삼합"] },
    claim: "세 글자가 한 방향으로 모여 그 축의 일이 크게 벌어지고, 다른 축은 상대적으로 얇아지는 구조",
    safePhrasing: "그쪽으로 쏠리는",
    forbidden: ["뭐든 이룬다"],
    source: "형충회합 — 삼합은 생지·왕지·고지가 모여 한 국(局)을 이룬다.",
  },
  {
    id: "REL-CHEONHAP",
    priority: 72,
    when: { relationKind: ["천간합"] },
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
    when: { gender: ["F"], luckTenGodAny: ["정관", "편관"] },
    claim: "지금 구간은 배우자성이 들어와 인연과 관계의 형태가 표면으로 올라오는 흐름",
    safePhrasing: "그런 결이 도는 구간",
    forbidden: ["올해 반드시 결혼한다", "곧 인연이 나타난다"],
    source: "운 — 여자 사주에서 관성은 배우자성. 관성운에 관계 사안이 부각된다.",
  },
  {
    id: "LUCK-GWAN-M",
    priority: 84,
    when: { gender: ["M"], luckTenGodAny: ["정관", "편관"] },
    claim: "지금 구간은 책임과 평가가 커져, 관계보다 자기 위치를 지키는 쪽으로 힘이 쏠리는 흐름",
    safePhrasing: "그런 무게가 실린 구간",
    forbidden: ["연애할 시간이 없다"],
    source: "운 — 남자 사주에서 관성은 직위·책임. 배우자성이 아니다.",
  },
  {
    id: "LUCK-JAE-M",
    priority: 90,
    when: { gender: ["M"], luckTenGodAny: ["정재", "편재"] },
    claim: "지금 구간은 배우자성이 들어와 만남의 기회가 늘고 선택지가 벌어지는 흐름",
    safePhrasing: "그렇게 열리는 구간",
    forbidden: ["곧 인연이 나타난다", "여러 명을 만난다"],
    source: "운 — 남자 사주에서 재성은 배우자성. 재성운에 인연 사안이 부각된다.",
  },
  {
    id: "LUCK-JAE-F",
    priority: 84,
    when: { gender: ["F"], luckTenGodAny: ["정재", "편재"] },
    claim: "지금 구간은 바깥일과 활동이 늘어, 관계에 쓸 여력이 줄고 우선순위가 밀리기 쉬운 흐름",
    safePhrasing: "그렇게 바빠지는 구간",
    forbidden: ["돈은 벌지만 사랑은 못 한다"],
    source: "운 — 여자 사주에서 재성은 활동·재물. 배우자성이 아니다.",
  },
  {
    id: "LUCK-IN",
    priority: 82,
    when: { luckTenGodAny: ["정인", "편인"] },
    claim: "지금 구간은 밖으로 벌이기보다 안으로 정리하는 쪽에 힘이 실려, 관계도 확장보다 점검에 맞는 흐름",
    safePhrasing: "그런 시기",
    forbidden: ["연애운이 없다"],
    source: "운 — 인성운은 수용·학습·휴식. 확장보다 축적의 구간으로 본다.",
  },
  {
    id: "LUCK-SIKSANG",
    priority: 82,
    when: { luckTenGodAny: ["식신", "상관"] },
    claim: "지금 구간은 말과 표현이 관계를 크게 움직여, 한 마디가 평소보다 멀리 가는 흐름",
    safePhrasing: "그런 힘이 실린 구간",
    forbidden: ["말하면 반드시 이루어진다"],
    source: "운 — 식상운은 내보내는 기운. 표현이 커진다.",
  },
  {
    id: "LUCK-BIGEOP",
    priority: 84,
    when: { luckTenGodAny: ["비견", "겁재"] },
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
    when: { needsPartner: true, pairRelation: ["일지육합"] },
    claim: "두 사람의 배우자 자리가 서로를 붙잡는 조합이라, 떨어져도 다시 당겨지는 구조",
    safePhrasing: "그렇게 맞물린",
    forbidden: ["천생연분이다", "반드시 이어진다"],
    source: "궁합 — 일지 육합은 배우자궁끼리 묶이는 조합.",
  },
  {
    id: "PAIR-SAMHAP",
    priority: 90,
    when: { needsPartner: true, pairRelation: ["일지삼합"] },
    claim: "두 배우자 자리가 같은 국에 들어 방향이 같은 쪽으로 모이는 구조",
    safePhrasing: "그쪽으로 함께 기우는",
    forbidden: ["운명적인 만남이다"],
    source: "궁합 — 일지가 같은 삼합국에 속하면 지향이 겹친다.",
  },
  {
    id: "PAIR-CHUNG",
    priority: 92,
    when: { needsPartner: true, pairRelation: ["일지충"] },
    claim: "두 사람의 배우자 자리가 정면으로 부딪히는 조합이라, 가까워질수록 같은 지점에서 크게 갈리는 구조",
    safePhrasing: "그 자리가 걸리는",
    forbidden: ["만나면 안 되는 사이다", "반드시 헤어진다"],
    source: "궁합 — 일지 충은 배우자궁끼리 마주쳐 부딪히는 조합.",
  },
  {
    id: "PAIR-WONJIN",
    priority: 88,
    when: { needsPartner: true, pairRelation: ["일지원진"] },
    claim: "설명하기 어려운 거슬림이 두 사람 사이에 깔려, 다툴 일이 없는데도 마음이 식는 구간이 생기는 구조",
    safePhrasing: "그렇게 걸리기 쉬운",
    forbidden: ["악연이다"],
    source: "궁합 — 일지 원진은 이유 없는 거슬림으로 본다.",
  },
  {
    id: "PAIR-GANHAP",
    priority: 88,
    when: { needsPartner: true, pairRelation: ["일간합"] },
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
