// 오늘의 사주 액션 — 계산된 흐름 하나를 오늘 할 행동 하나로 옮긴다.
//
// 왜 모델을 부르지 않는가.
//
// 리딩은 명식이 사람마다 달라 경우의 수가 사실상 무한하다. 그래서 모델이
// 필요하다. 여기는 다르다. 축이 둘뿐이다 — 오늘의 십성 10종 × 영역 8종.
// 80칸이면 표가 끝난다. 표로 끝나는 것을 모델에 맡기면 얻는 게 없고 잃는 게
// 많다: 같은 날 같은 사람에게 다른 문장이 나가고, 캐시와 폴백과 가드가 전부
// 필요해지고, 무엇보다 CLAUDE.md 의 첫 두 규칙(승인된 사실 밖으로 나가지
// 않는다 / 값을 지어내지 않는다)을 매 호출마다 다시 지켜야 한다.
//
// 문장을 사람이 미리 써 두면 그 세 문제가 한꺼번에 없어진다. 이 파일의
// 문자열은 전부 검수를 거친 것으로 본다 — 여기를 고치는 것이 곧 검수다.
//
// 계산은 하나도 새로 하지 않는다. computeSaju 로 명식을, dayPillarOf 로
// 오늘의 일진을, tenGodOf 로 그 둘의 관계를 잰다. manseryeok.ts:303 이
// 이미 같은 세 줄을 쓰고 있다.

import { CHEONGAN, computeSaju, dayPillarOf, pillarLabel } from "@/lib/saju";
import { stemElement, tenGodOf } from "@/lib/saju-facts";

/** 십성 열 가지 — 규칙 표와 같은 표기 */
export type TenGod =
  | "비견" | "겁재" | "식신" | "상관" | "편재"
  | "정재" | "편관" | "정관" | "편인" | "정인";

export type FortuneDomain =
  | "love"
  | "money"
  | "study"
  | "career"
  | "business"
  | "relationship"
  | "health"
  | "growth";

export const DOMAIN_LABEL: Record<FortuneDomain, string> = {
  love: "연애운",
  money: "재물운",
  study: "학업운",
  career: "직업운",
  business: "사업운",
  relationship: "인간관계",
  health: "건강관리",
  growth: "자기계발",
};

export const DOMAINS = Object.keys(DOMAIN_LABEL) as FortuneDomain[];

export interface DailySajuAction {
  id: string;
  date: string;
  domain: FortuneDomain;
  title: string;
  action: string;
  reason: string;
  avoidAction: string;
  durationMinutes?: number;
  completionType: "check" | "count" | "note";
  sajuBasis: {
    label: string;
    description: string;
  };
  disclaimer?: string;
  completedAt?: string | null;
}

// ── 오늘의 흐름 ────────────────────────────────────────────
//
// 십성을 그대로 화면에 쓰지 않는다. 십성은 열 개지만 행동으로 옮길 때의
// 결은 다섯 갈래다 — 같은 인성운이면 정인이든 편인이든 "안으로 정리하는"
// 쪽이다. 그 다섯을 흐름(flow)이라 부르고 표의 축으로 쓴다.
export type Flow = "비겁" | "식상" | "재성" | "관성" | "인성";

export const FLOW_OF: Record<TenGod, Flow> = {
  비견: "비겁", 겁재: "비겁",
  식신: "식상", 상관: "식상",
  편재: "재성", 정재: "재성",
  편관: "관성", 정관: "관성",
  편인: "인성", 정인: "인성",
};

/**
 * 흐름이 뜻하는 것 — 화면의 "왜 이 행동인가" 첫 문장이 여기서 나온다.
 *
 * 전부 방향에 대한 서술이지 결과에 대한 예언이 아니다. "확장보다 점검"은
 * 되고 "돈이 들어온다"는 안 된다.
 */
const FLOW_MEANING: Record<Flow, string> = {
  비겁: "오늘은 사람과 힘이 나뉘는 흐름입니다. 혼자 끌어안기보다 몫을 분명히 해두는 쪽이 어울립니다.",
  식상: "오늘은 안에 있던 것이 밖으로 나가는 흐름입니다. 표현하고 시작하는 일에 힘이 실립니다.",
  재성: "오늘은 손에 잡히는 것으로 눈이 가는 흐름입니다. 벌이기보다 이미 가진 것을 헤아리기 좋습니다.",
  관성: "오늘은 형태와 책임이 또렷해지는 흐름입니다. 새로 벌이기보다 맡은 것의 경계를 정하기 좋습니다.",
  인성: "오늘은 밖으로 벌이기보다 안으로 정리하는 흐름입니다. 확장보다 점검과 채움에 맞습니다.",
};

/**
 * 흐름이 가장 잘 붙는 영역의 우선순위.
 *
 * 관심 영역을 아직 저장하지 않으므로(프로필에 칸이 없다) 오늘의 흐름이
 * 영역을 고른다. 나중에 관심 영역이 생기면 이 목록과 교집합을 잡으면 된다 —
 * 순서가 이미 선호도라 그대로 쓸 수 있다.
 */
const DOMAIN_PRIORITY: Record<Flow, FortuneDomain[]> = {
  비겁: ["relationship", "business", "money", "career", "love", "growth", "health", "study"],
  식상: ["love", "growth", "business", "relationship", "study", "career", "health", "money"],
  재성: ["money", "career", "business", "health", "study", "love", "relationship", "growth"],
  관성: ["career", "study", "money", "business", "health", "relationship", "love", "growth"],
  인성: ["study", "health", "growth", "money", "career", "relationship", "love", "business"],
};

interface ActionCopy {
  title: string;
  action: string;
  reason: string;
  avoid: string;
  minutes: number;
}

/**
 * 40칸 표 — 흐름 5 × 영역 8.
 *
 * 행동이 지켜야 하는 것: 오늘 안에 되고, 돈이 안 들고, 끝난 걸 본인이 알 수
 * 있고, "마음을 열어보세요" 같은 추상이 아닐 것. 동사와 대상과 수가 있어야
 * 한다 — "1개", "25분", "한 가지".
 *
 * 재물·건강은 특히 조심한다. 재물은 벌이는 쪽을 권하지 않고 점검만,
 * 건강은 생활 습관까지만 — 진단도 처방도 아니다.
 */
const ACTIONS: Record<Flow, Record<FortuneDomain, ActionCopy>> = {
  비겁: {
    love: {
      title: "둘 사이의 일로 되돌리기",
      action: "오늘은 두 사람 사이의 일을 제3자에게 상의하기 전에, 상대에게 먼저 한 가지를 물어보세요.",
      reason: "사람이 끼어들며 관계의 지분이 흔들리기 쉬운 흐름입니다. 셋의 일이 되기 전에 둘 사이에서 확인하는 편이 오늘의 흐름을 잘 쓰는 방법입니다.",
      avoid: "오늘은 다른 사람의 말을 근거로 상대에 대한 결론을 정하지 마세요.",
      minutes: 10,
    },
    money: {
      title: "나눠 낸 돈 정리하기",
      action: "오늘은 다른 사람과 함께 쓰거나 빌려준 돈 1건의 금액과 날짜를 적어두세요.",
      reason: "몫이 섞이기 쉬운 흐름입니다. 금액을 적어 경계를 눈에 보이게 두는 것이 오늘에 어울립니다.",
      avoid: "오늘은 금액이나 조건을 정하지 않은 채로 돈이 오가게 두지 마세요.",
      minutes: 15,
    },
    study: {
      title: "혼자 붙잡던 문제 하나 꺼내기",
      action: "오늘은 혼자 막혀 있던 문제 1개를 정리해서 물어볼 수 있는 곳에 올리세요.",
      reason: "혼자 끌어안기보다 힘이 나뉘는 흐름입니다. 막힌 자리를 밖으로 꺼내는 편이 오늘 더 멀리 갑니다.",
      avoid: "오늘은 남의 진도와 내 진도를 견주며 계획을 통째로 갈아엎지 마세요.",
      minutes: 20,
    },
    career: {
      title: "내 몫의 경계 적어두기",
      action: "오늘은 함께 하는 일 1개에서 내가 맡은 범위를 한 문장으로 적어 상대에게 확인받으세요.",
      reason: "일의 지분이 흐려지기 쉬운 흐름입니다. 경계를 먼저 적어두면 나중에 겹치는 자리를 줄일 수 있습니다.",
      avoid: "오늘은 누가 할지 정하지 않은 일을 말없이 떠맡지 마세요.",
      minutes: 15,
    },
    business: {
      title: "동업 조건 한 줄 확인",
      action: "오늘은 함께 일하는 사람과의 조건 1가지를 문서나 메시지로 남겨두세요.",
      reason: "몫이 나뉘는 흐름입니다. 말로 지나간 조건을 글로 옮겨두기에 오늘이 맞습니다.",
      avoid: "오늘은 구두로만 합의한 조건 위에서 새 약속을 더 얹지 마세요.",
      minutes: 20,
    },
    relationship: {
      title: "미뤄둔 답장 하나",
      action: "오늘은 답하지 못하고 넘어간 안부 연락 1개에 답을 보내세요.",
      reason: "사람과의 거리가 움직이는 흐름입니다. 새 자리를 만들기보다 이미 열려 있던 대화를 닫아두는 편이 오늘에 어울립니다.",
      avoid: "오늘은 여러 사람이 얽힌 이야기에 중간에서 말을 옮기지 마세요.",
      minutes: 10,
    },
    health: {
      title: "약속 사이에 쉬는 자리 만들기",
      action: "오늘은 사람을 만나는 일정 사이에 20분 혼자 있는 시간을 달력에 넣으세요.",
      reason: "밖으로 힘이 나뉘기 쉬운 흐름입니다. 회복할 자리를 미리 비워두는 것이 오늘의 흐름을 견디는 방법입니다.",
      avoid: "오늘은 컨디션을 확인하지 않은 채로 약속을 하나 더 잡지 마세요.",
      minutes: 20,
    },
    growth: {
      title: "비교 대신 내 기록 보기",
      action: "오늘은 지난 한 달 내가 남긴 기록 1개를 다시 열어보고 달라진 점을 한 줄 적으세요.",
      reason: "옆을 보게 되기 쉬운 흐름입니다. 기준을 밖에 두지 않고 내 기록에 두면 오늘의 힘이 안으로 모입니다.",
      avoid: "오늘은 남의 속도를 기준으로 내 계획을 다시 짜지 마세요.",
      minutes: 15,
    },
  },
  식상: {
    love: {
      title: "고마웠던 일 한 가지 말하기",
      action: "오늘은 상대에게 고마웠던 일 한 가지를 구체적으로 표현해보세요.",
      reason: "말과 표현이 관계를 크게 움직여, 한 마디가 평소보다 멀리 가는 흐름입니다. 담아두었던 말 한 가지를 꺼내기에 오늘이 맞습니다.",
      avoid: "오늘은 감정이 올라온 상태에서 관계의 결론을 확정하지 마세요.",
      minutes: 10,
    },
    money: {
      title: "지출 계획을 말로 꺼내기",
      action: "오늘은 사려고 마음먹은 것 1개를 왜 필요한지 한 문장으로 적어보세요.",
      reason: "안에 있던 것이 밖으로 나가는 흐름입니다. 쓰고 싶은 마음도 같이 나가기 쉬우니, 사기 전에 이유를 글로 세워두는 편이 좋습니다.",
      avoid: "오늘은 기분이 좋아진 김에 예정에 없던 결제를 하지 마세요.",
      minutes: 10,
    },
    study: {
      title: "배운 것 한 줄로 설명하기",
      action: "오늘은 최근 공부한 내용 1개를 아무것도 모르는 사람에게 설명하듯 세 문장으로 적어보세요.",
      reason: "내보내는 기운이 강한 흐름입니다. 넣기보다 꺼내볼 때 무엇이 비어 있는지가 오늘 더 잘 보입니다.",
      avoid: "오늘은 새 교재나 새 강의를 추가로 벌이지 마세요.",
      minutes: 25,
    },
    career: {
      title: "막힌 일 한 건 공유하기",
      action: "오늘은 진행이 멈춘 일 1개의 상황을 세 줄로 정리해 관련된 사람에게 보내세요.",
      reason: "표현이 일을 움직이는 흐름입니다. 혼자 붙들고 있던 것을 꺼내면 오늘은 그 말이 평소보다 멀리 갑니다.",
      avoid: "오늘은 확정되지 않은 계획을 확정된 것처럼 말하지 마세요.",
      minutes: 15,
    },
    business: {
      title: "고객 한 명에게 직접 묻기",
      action: "오늘은 고객이나 사용자 1명에게 무엇이 불편했는지 직접 물어보세요.",
      reason: "밖으로 나가는 힘이 실린 흐름입니다. 안에서 추측하기보다 한 사람에게 직접 묻는 편이 오늘에 어울립니다.",
      avoid: "오늘은 반응을 확인하기 전에 다음 기능이나 상품을 먼저 벌이지 마세요.",
      minutes: 20,
    },
    relationship: {
      title: "생각났던 사람에게 먼저",
      action: "오늘은 떠올랐지만 연락하지 못한 사람 1명에게 짧은 안부를 보내세요.",
      reason: "먼저 내보내는 쪽에 힘이 실리는 흐름입니다. 미뤄둔 연락 하나가 오늘은 평소보다 자연스럽게 닿습니다.",
      avoid: "오늘은 하고 싶은 말이 많더라도 한 번에 쏟아내지 마세요.",
      minutes: 10,
    },
    health: {
      title: "몸을 밖으로 내보내기",
      action: "오늘은 20분 걷고, 오늘 잘 시간을 미리 정해두세요.",
      reason: "안에 쌓인 것을 내보내는 흐름입니다. 앉아 있는 시간을 줄이고 몸을 움직이는 쪽이 오늘에 맞습니다.",
      avoid: "오늘은 늦은 시간까지 이야기나 화면을 이어가며 잠을 미루지 마세요.",
      minutes: 20,
    },
    growth: {
      title: "만들던 것 한 조각 내놓기",
      action: "오늘은 혼자 만들던 것 1개를 완성되지 않은 채로 한 사람에게 보여주세요.",
      reason: "내보내는 흐름입니다. 다 만든 뒤에 보여주려던 것을 오늘 조금 일찍 꺼내면 방향을 빨리 고칠 수 있습니다.",
      avoid: "오늘은 반응이 오기 전에 결과를 미리 단정하지 마세요.",
      minutes: 20,
    },
  },
  재성: {
    love: {
      title: "함께 쓰는 것 한 가지 정하기",
      action: "오늘은 두 사람이 함께 쓰는 돈이나 시간 1가지에 대해 서로의 기준을 물어보세요.",
      reason: "손에 잡히는 것으로 눈이 가는 흐름입니다. 마음보다 조건을 이야기하기에 오늘이 덜 어색합니다.",
      avoid: "오늘은 상대의 마음을 돈이나 선물의 크기로 재지 마세요.",
      minutes: 15,
    },
    money: {
      title: "새는 돈 1개 찾기",
      action: "오늘은 지난달 고정비 목록을 열어 지금 쓰지 않는 항목 1개를 찾아 표시해두세요.",
      reason: "이미 가진 것을 헤아리기 좋은 흐름입니다. 늘리는 쪽보다 빠져나가는 자리를 보는 편이 오늘에 어울립니다.",
      avoid: "오늘은 기분에 따라 예정에 없던 큰 지출이나 투자 결정을 하지 마세요.",
      minutes: 15,
    },
    study: {
      title: "가진 자료부터 끝내기",
      action: "오늘은 이미 사둔 교재나 강의 중 가장 오래 미룬 것의 첫 단원만 25분 시작하세요.",
      reason: "이미 가진 것으로 눈이 가는 흐름입니다. 새로 마련하기보다 손에 있는 것을 쓰기에 오늘이 맞습니다.",
      avoid: "오늘은 새 교재나 새 강의를 결제하지 마세요.",
      minutes: 25,
    },
    career: {
      title: "일의 값 확인하기",
      action: "오늘은 맡은 일 1개에 실제로 들어간 시간을 적어보세요.",
      reason: "손에 잡히는 값으로 눈이 가는 흐름입니다. 느낌으로 알던 것을 숫자로 옮겨두기에 오늘이 맞습니다.",
      avoid: "오늘은 조건을 확인하지 않은 채로 새 일을 받지 마세요.",
      minutes: 15,
    },
    business: {
      title: "숫자 하나 확인하기",
      action: "오늘은 매출이나 비용 항목 1개를 열어 지난달과 비교해보세요.",
      reason: "이미 있는 것을 헤아리는 흐름입니다. 새 시도보다 지금 돌아가는 숫자를 보는 편이 오늘에 어울립니다.",
      avoid: "오늘은 숫자를 확인하기 전에 새로운 지출을 결정하지 마세요.",
      minutes: 20,
    },
    relationship: {
      title: "빌린 것 돌려주기",
      action: "오늘은 빌린 물건이나 갚기로 한 것 1가지를 정리해 알리세요.",
      reason: "주고받은 것이 또렷해지는 흐름입니다. 미뤄둔 정산을 닫아두기에 오늘이 맞습니다.",
      avoid: "오늘은 부담이 되는 부탁을 거절하지 못한 채 미루지 마세요.",
      minutes: 10,
    },
    health: {
      title: "먹은 것 적어보기",
      action: "오늘은 하루 동안 먹은 것을 그대로 적어보세요.",
      reason: "이미 하고 있는 것을 헤아리기 좋은 흐름입니다. 바꾸기 전에 지금을 보는 편이 오늘에 어울립니다.",
      avoid: "오늘은 갑자기 끼니를 거르거나 식단을 통째로 바꾸지 마세요.",
      minutes: 10,
    },
    growth: {
      title: "쌓아둔 것 하나 꺼내기",
      action: "오늘은 저장만 해두고 읽지 않은 자료 1개를 10분만 읽으세요.",
      reason: "가진 것으로 눈이 가는 흐름입니다. 새로 모으기보다 이미 모아둔 것을 여는 편이 오늘에 맞습니다.",
      avoid: "오늘은 읽지 않은 것이 쌓인 채로 새 자료를 더 모으지 마세요.",
      minutes: 10,
    },
  },
  관성: {
    love: {
      title: "말하지 못한 선 하나 정하기",
      action: "오늘은 관계에서 불편했던 것 1가지를 비난 없이 한 문장으로 적어보세요.",
      reason: "관계의 형태가 표면으로 올라오는 흐름입니다. 참아온 자리를 문장으로 만들어두기에 오늘이 맞습니다.",
      avoid: "오늘은 감정이 올라온 상태에서 관계의 결론을 통보하지 마세요.",
      minutes: 15,
    },
    money: {
      title: "지출 규칙 하나 세우기",
      action: "오늘은 이번 달 남은 기간 동안 지킬 지출 기준 1가지를 정해 적어두세요.",
      reason: "형태와 경계가 또렷해지는 흐름입니다. 새 결정을 내리기보다 지킬 선을 정해두기에 오늘이 맞습니다.",
      avoid: "오늘은 새로운 지출이나 투자 결정을 서두르지 마세요.",
      minutes: 15,
    },
    study: {
      title: "마감 조건 정하기",
      action: "오늘은 공부 중인 것 1개에 대해 언제까지 어디까지 할지를 정해 적어두세요.",
      reason: "책임과 형태가 또렷해지는 흐름입니다. 범위를 정하지 않은 계획이 오늘 가장 먼저 흔들립니다.",
      avoid: "오늘은 끝내는 조건을 정하지 않은 채로 새 과목을 시작하지 마세요.",
      minutes: 20,
    },
    career: {
      title: "완료 조건 명확히 하기",
      action: "오늘은 진행 중인 일 1개의 마감 조건을 한 문장으로 정하고 관련된 사람에게 확인하세요.",
      reason: "형태와 책임이 또렷해지는 흐름입니다. 더 벌이기보다 맡은 것의 끝을 정해두는 편이 오늘에 어울립니다.",
      avoid: "오늘은 일을 더 벌이거나 새 프로젝트를 맡지 마세요.",
      minutes: 15,
    },
    business: {
      title: "약속한 것 하나 지키기",
      action: "오늘은 고객이나 동료에게 약속했는데 미뤄둔 것 1가지를 처리하거나 새 기한을 알리세요.",
      reason: "책임이 표면으로 올라오는 흐름입니다. 밀린 약속을 오늘 닫아두면 나중에 커지지 않습니다.",
      avoid: "오늘은 지킬 수 있는지 확인하지 않은 채로 새 기한을 약속하지 마세요.",
      minutes: 20,
    },
    relationship: {
      title: "거절 한 번 하기",
      action: "오늘은 부담스러웠던 부탁 1가지에 대해 할 수 있는 범위를 분명히 알리세요.",
      reason: "경계가 또렷해지는 흐름입니다. 애매하게 남겨둔 자리를 정리하기에 오늘이 덜 어렵습니다.",
      avoid: "오늘은 마음에 없는 승낙으로 자리를 넘기지 마세요.",
      minutes: 10,
    },
    health: {
      title: "잘 시간 정해두기",
      action: "오늘은 잘 시간을 정해 알람으로 맞춰두세요.",
      reason: "형태를 정하기 좋은 흐름입니다. 의지로 버티기보다 시간을 정해두는 편이 오늘에 맞습니다.",
      avoid: "오늘은 무리한 일정으로 쉬는 시간을 밀어내지 마세요.",
      minutes: 5,
    },
    growth: {
      title: "습관 하나에 시간 붙이기",
      action: "오늘은 만들고 싶은 습관 1개를 하루 중 정확히 몇 시에 할지 정해 적어두세요.",
      reason: "형태가 또렷해지는 흐름입니다. 하겠다는 마음보다 시각을 정하는 편이 오늘 더 오래 갑니다.",
      avoid: "오늘은 여러 습관을 한꺼번에 시작하지 마세요.",
      minutes: 10,
    },
  },
  인성: {
    love: {
      title: "확인 하나 먼저",
      action: "오늘은 결론을 내리기 전에, 상대에게 사실 1가지를 물어 확인하세요.",
      reason: "밖으로 벌이기보다 안으로 정리하는 흐름입니다. 관계도 확장보다 점검에 맞는 날입니다.",
      avoid: "오늘은 짐작만으로 관계의 결론을 정하지 마세요.",
      minutes: 10,
    },
    money: {
      title: "이번 주 지출 미리 보기",
      action: "오늘은 이번 주에 나갈 예정인 지출을 한 번 적어 정리하세요.",
      reason: "확장보다 점검에 맞는 흐름입니다. 늘리는 결정을 보류하고 예정된 것을 헤아리기에 오늘이 맞습니다.",
      avoid: "오늘은 새로운 지출이나 투자를 결정하지 말고 다음으로 미루세요.",
      minutes: 15,
    },
    study: {
      title: "가장 미룬 것의 첫 단원만",
      action: "오늘은 가장 미뤄온 과목의 첫 단원만 25분 시작하세요.",
      reason: "안으로 채우는 쪽에 힘이 실리는 흐름입니다. 크게 계획하기보다 이미 알고 있는 일을 바로 시작하기에 좋습니다.",
      avoid: "오늘은 여러 과목을 동시에 시작하지 마세요.",
      minutes: 25,
    },
    career: {
      title: "쌓인 것 하나 정리하기",
      action: "오늘은 밀린 문서나 메일 중 1개를 정리해 닫으세요.",
      reason: "벌이기보다 정리하는 흐름입니다. 새 일을 여는 대신 열려 있던 것을 닫기에 오늘이 맞습니다.",
      avoid: "오늘은 새 프로젝트를 시작하거나 큰 결정을 서두르지 마세요.",
      minutes: 20,
    },
    business: {
      title: "지난 기록 되짚기",
      action: "오늘은 지난달 잘 되지 않았던 시도 1가지를 열어 이유를 두 줄로 적어보세요.",
      reason: "안으로 정리하는 흐름입니다. 다음 시도를 벌이기 전에 지난 것을 닫아두기에 오늘이 맞습니다.",
      avoid: "오늘은 검증하지 않은 채로 새 사업 결정을 내리지 마세요.",
      minutes: 20,
    },
    relationship: {
      title: "고마웠던 일 떠올려 적기",
      action: "오늘은 최근 도움을 받은 사람 1명을 떠올려 무엇이 고마웠는지 적거나 전하세요.",
      reason: "받은 것으로 눈이 가는 흐름입니다. 새 자리를 만들기보다 이미 받은 것을 헤아리기에 오늘이 맞습니다.",
      avoid: "오늘은 여러 모임이나 새 약속을 한꺼번에 잡지 마세요.",
      minutes: 10,
    },
    health: {
      title: "먼저 쉬기",
      action: "오늘은 20분 일찍 눕고, 자기 전 화면을 보지 않는 시간을 정하세요.",
      reason: "채우고 회복하는 쪽에 힘이 실리는 흐름입니다. 더 하기보다 덜 하는 편이 오늘에 맞습니다.",
      avoid: "오늘은 잠을 줄여 일정을 늘리지 마세요.",
      minutes: 20,
    },
    growth: {
      title: "10분 읽기",
      action: "오늘은 관심 있는 주제의 자료를 10분만 읽으세요.",
      reason: "안으로 채우는 흐름입니다. 결과를 내려 하기보다 넣어두는 편이 오늘에 어울립니다.",
      avoid: "오늘은 배운 것을 바로 결과로 만들려고 서두르지 마세요.",
      minutes: 10,
    },
  },
};

/** 영역별 안내 문구 — 예언이 아니라 참고 자료임을 화면에서 못박는다 */
const DISCLAIMER: Partial<Record<FortuneDomain, string>> = {
  money: "재물 관련 내용은 예언이 아니라 소비 습관을 돌아보는 참고 자료입니다. 투자 판단은 본인의 몫입니다.",
  health: "건강 관련 내용은 생활 습관 제안일 뿐, 진단이나 치료를 대신하지 않습니다.",
  business: "사업 관련 내용은 의사결정을 대신하지 않는 참고 자료입니다.",
};

export interface DailyActionInput {
  /** "1995-03-14" */
  birthdate: string;
  /** 0-23, 시간 미상이면 null */
  birthHour: number | null;
  /** 오늘 (Asia/Seoul 기준의 ISO 날짜) */
  today: string;
  /** 이 영역들은 최근에 이미 나갔다 — 가능하면 피한다 */
  recentDomains?: FortuneDomain[];
  /** 사용자가 직접 고른 영역. 지금은 "다른 운세 보기"가 쓴다. */
  domain?: FortuneDomain;
}

export interface DailyFlow {
  /** 오늘의 일진 "병오" */
  dayGanji: string;
  /** 내 일간 "갑" */
  dayMaster: string;
  tenGod: TenGod;
  flow: Flow;
}

function isYang(ganIdx: number): boolean {
  return ganIdx % 2 === 0;
}

/** ISO 날짜를 그 날 UTC 자정으로 — dayPillarOf 가 그 단위로 센다 */
function utcMidnightOf(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * 오늘의 흐름 — 내 일간이 오늘의 일진 천간을 어떻게 보는가.
 *
 * 일간(내 것)과 일진 천간(오늘 것) 두 글자만 있으면 정해진다. 시간 미상이어도
 * 값이 흔들리지 않는다 — 일주는 날짜에서 나오고 시주는 여기 들어가지 않는다.
 * manseryeok.ts:303 이 쓰는 것과 같은 계산이다.
 */
export function dailyFlowOf(birthdate: string, birthHour: number | null, todayISO: string): DailyFlow {
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const chart = computeSaju({
    year: by,
    month: bm,
    day: bd,
    hour: birthHour,
  });
  const todayPillar = dayPillarOf(utcMidnightOf(todayISO));

  const tenGod = tenGodOf(
    stemElement(chart.day.ganIdx),
    isYang(chart.day.ganIdx),
    stemElement(todayPillar.ganIdx),
    isYang(todayPillar.ganIdx)
  ) as TenGod;

  return {
    dayGanji: pillarLabel(todayPillar),
    dayMaster: CHEONGAN[chart.day.ganIdx],
    tenGod,
    flow: FLOW_OF[tenGod],
  };
}

/**
 * 오늘의 영역 하나.
 *
 * 흐름이 매긴 우선순위에서, 최근에 나갔던 영역을 건너뛰고 첫 번째를 고른다.
 * 전부 최근에 나갔으면 우선순위 1번으로 돌아간다 — 중복 회피 때문에 흐름과
 * 안 맞는 영역을 내보내는 것이 더 나쁘다.
 */
export function pickDomain(flow: Flow, recentDomains: FortuneDomain[] = []): FortuneDomain {
  const order = DOMAIN_PRIORITY[flow];
  const recent = new Set(recentDomains);
  return order.find((d) => !recent.has(d)) ?? order[0];
}

/**
 * 오늘의 사주 액션 하나.
 *
 * 같은 생년월일·같은 날짜·같은 이력이면 항상 같은 값이 나온다. 무작위가
 * 없어서 캐시가 필요 없다 — 다시 계산하면 같은 것이 나온다.
 */
export function buildDailyAction(input: DailyActionInput): { action: DailySajuAction; flow: DailyFlow } {
  const flow = dailyFlowOf(input.birthdate, input.birthHour, input.today);
  const domain = input.domain ?? pickDomain(flow.flow, input.recentDomains);
  const copy = ACTIONS[flow.flow][domain];

  return {
    flow,
    action: {
      id: `${input.today}:${domain}:${flow.flow}`,
      date: input.today,
      domain,
      title: copy.title,
      action: copy.action,
      reason: copy.reason,
      avoidAction: copy.avoid,
      durationMinutes: copy.minutes,
      completionType: "check",
      sajuBasis: {
        label: `오늘의 일진 ${flow.dayGanji} · 내 일간 ${flow.dayMaster} 기준 ${flow.tenGod}`,
        description: FLOW_MEANING[flow.flow],
      },
      disclaimer: DISCLAIMER[domain],
      completedAt: null,
    },
  };
}

/** "다른 운세 보기" — 오늘의 흐름으로 나머지 영역까지 전부 */
export function buildAllDomains(input: DailyActionInput): DailySajuAction[] {
  return DOMAINS.map((domain) => buildDailyAction({ ...input, domain }).action);
}

/** Asia/Seoul 기준 오늘 (ISO 날짜). 서버가 어느 지역에 있든 같은 날을 가리킨다. */
export function seoulToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 테스트가 표 전체를 훑는 데 쓴다 */
export const FLOWS: Flow[] = ["비겁", "식상", "재성", "관성", "인성"];
export { ACTIONS as DAILY_ACTION_TABLE };
