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

import { CHEONGAN, computeSaju, dayPillarOf, pillarLabel, type Ohaeng } from "@/lib/saju";
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
  /** 오늘의 흐름에 반응하는 토끼 — 움직임, 정지 그림, 첫 마디 */
  rabbit: {
    /** 투명 배경 webm. 재생이 막히면 art 가 그 자리에 남는다. */
    video: string;
    art: string;
    line: string;
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
 * 토끼의 얼굴과 첫 마디.
 *
 * 화면에서 토끼가 "반응한다"고 느껴지려면 흐름마다 다른 모습이어야 한다.
 * 오늘이 어떤 날이든 같은 그림이 나오면, 움직이는 장식이지 반응이 아니다.
 *
 * line 은 결과 카드 위에서 토끼가 건네는 말이다. 근거 문장(FLOW_MEANING)은
 * 설명이고 이쪽은 말이라 더 짧고 사람 말투에 가깝다. 둘이 같은 것을 두 번
 * 말하지 않도록, line 은 "그래서 오늘 뭘 하자"는 쪽으로만 간다.
 */
const FLOW_RABBIT: Record<Flow, { video: string; art: string; line: string }> = {
  비겁: {
    video: "/assets/today/rabbit-bigyeop.webm",
    art: "/assets/today/rabbit-bigyeop.webp",
    line: "오늘은 혼자 다 안고 가지 말자. 몫을 나눠두면 편해져.",
  },
  식상: {
    video: "/assets/today/rabbit-siksang.webm",
    art: "/assets/today/rabbit-siksang.webp",
    line: "오늘은 말이 잘 닿는 날이야. 담아뒀던 한마디, 지금 꺼내보자.",
  },
  재성: {
    video: "/assets/today/rabbit-jaeseong.webm",
    art: "/assets/today/rabbit-jaeseong.webp",
    line: "오늘은 늘리는 날이 아니라 세어보는 날이야. 같이 한번 확인해볼까?",
  },
  관성: {
    video: "/assets/today/rabbit-gwanseong.webm",
    art: "/assets/today/rabbit-gwanseong.webp",
    line: "오늘은 하나만 분명히 정해두자. 그거면 충분해.",
  },
  인성: {
    video: "/assets/today/rabbit-inseong.webm",
    art: "/assets/today/rabbit-inseong.webp",
    line: "오늘은 좀 천천히 가도 돼. 채우는 것도 하는 일이야.",
  },
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
      action: "오늘은 둘 사이의 일을 남에게 묻기 전에, 상대에게 먼저 하나 물어보자.",
      reason: "사람이 끼어들기 쉬운 날이다. 셋의 일이 되기 전에 둘이서 확인하는 게 맞다.",
      avoid: "오늘은 남의 말로 상대에 대한 결론을 내리지 마.",
      minutes: 10,
    },
    money: {
      title: "나눠 낸 돈 정리하기",
      action: "오늘은 남과 얽힌 돈 1건의 금액과 날짜를 적어두자.",
      reason: "몫이 섞이기 쉬운 날이다. 적어두면 경계가 생긴다.",
      avoid: "오늘은 금액을 정하지 않은 채 돈이 오가게 두지 마.",
      minutes: 15,
    },
    study: {
      title: "혼자 붙잡던 문제 하나 꺼내기",
      action: "오늘은 혼자 막힌 문제 1개를 정리해 물어볼 곳에 올리자.",
      reason: "혼자 끌 필요가 없는 날이다. 꺼내는 쪽이 더 멀리 간다.",
      avoid: "오늘은 남의 진도에 흔들려 계획을 갈아엎지 마.",
      minutes: 20,
    },
    career: {
      title: "내 몫의 경계 적어두기",
      action: "오늘은 함께 하는 일 1개에서 내 몫을 한 문장으로 적어 확인받자.",
      reason: "일의 지분이 흐려지기 쉬운 날이다. 경계를 먼저 적는 게 맞다.",
      avoid: "오늘은 주인 없는 일을 말없이 떠맡지 마.",
      minutes: 15,
    },
    business: {
      title: "동업 조건 한 줄 확인",
      action: "오늘은 동업자와의 조건 1가지를 글로 남기자.",
      reason: "몫이 나뉘는 날이다. 말로 지나간 조건을 글로 못박자.",
      avoid: "오늘은 구두 합의 위에 새 약속을 얹지 마.",
      minutes: 20,
    },
    relationship: {
      title: "미뤄둔 답장 하나",
      action: "오늘은 미뤄둔 답장 1개를 보내자.",
      reason: "거리가 움직이는 날이다. 열려 있던 대화부터 닫는 게 맞다.",
      avoid: "오늘은 남들 사이에서 말을 옮기지 마.",
      minutes: 10,
    },
    health: {
      title: "약속 사이에 쉬는 자리 만들기",
      action: "오늘은 약속 사이에 혼자 있는 20분을 달력에 넣자.",
      reason: "밖으로 힘이 새는 날이다. 회복 자리를 미리 비워두자.",
      avoid: "오늘은 컨디션 확인 없이 약속을 더 잡지 마.",
      minutes: 20,
    },
    growth: {
      title: "비교 대신 내 기록 보기",
      action: "오늘은 지난달 내 기록 1개를 열어 달라진 점을 한 줄 적자.",
      reason: "옆을 보게 되는 날이다. 기준을 내 기록에 두면 힘이 모인다.",
      avoid: "오늘은 남의 속도로 내 계획을 다시 짜지 마.",
      minutes: 15,
    },
  },
  식상: {
    love: {
      title: "고마웠던 일 한 가지 말하기",
      action: "오늘은 고마웠던 일 하나를 상대에게 그대로 말하자.",
      reason: "말이 멀리 가는 날이다. 담아둔 한마디를 꺼내기 딱 좋다.",
      avoid: "오늘은 감정이 오른 채로 관계의 결론을 내리지 마.",
      minutes: 10,
    },
    money: {
      title: "지출 계획을 말로 꺼내기",
      action: "오늘은 사려는 것 1개의 이유를 한 문장으로 적어보자.",
      reason: "쓰고 싶은 마음도 같이 나가는 날이다. 이유부터 글로 세우자.",
      avoid: "오늘은 기분에 얹혀 예정에 없던 결제를 하지 마.",
      minutes: 10,
    },
    study: {
      title: "배운 것 한 줄로 설명하기",
      action: "오늘은 최근 배운 것 1개를 모르는 사람에게 설명하듯 세 문장으로 적자.",
      reason: "내보내는 힘이 센 날이다. 꺼내보면 빈 곳이 보인다.",
      avoid: "오늘은 새 교재나 강의를 더 벌이지 마.",
      minutes: 25,
    },
    career: {
      title: "막힌 일 한 건 공유하기",
      action: "오늘은 멈춘 일 1개의 상황을 세 줄로 정리해 보내자.",
      reason: "말이 일을 움직이는 날이다. 혼자 쥔 걸 꺼내자.",
      avoid: "오늘은 확정 안 된 계획을 확정처럼 말하지 마.",
      minutes: 15,
    },
    business: {
      title: "고객 한 명에게 직접 묻기",
      action: "오늘은 고객 1명에게 뭐가 불편했는지 직접 묻자.",
      reason: "밖으로 나가는 힘이 실린 날이다. 추측 말고 물어보는 게 맞다.",
      avoid: "오늘은 반응을 보기 전에 다음 걸 벌이지 마.",
      minutes: 20,
    },
    relationship: {
      title: "생각났던 사람에게 먼저",
      action: "오늘은 생각난 사람 1명에게 짧은 안부를 보내자.",
      reason: "먼저 내보내는 쪽에 힘이 실리는 날이다. 미룬 연락이 자연스럽게 닿는다.",
      avoid: "오늘은 하고 싶은 말을 한 번에 쏟지 마.",
      minutes: 10,
    },
    health: {
      title: "몸을 밖으로 내보내기",
      action: "오늘은 20분 걷고 잘 시간을 미리 정하자.",
      reason: "쌓인 걸 내보내는 날이다. 몸을 움직이는 게 맞다.",
      avoid: "오늘은 화면 붙잡고 잠을 미루지 마.",
      minutes: 20,
    },
    growth: {
      title: "만들던 것 한 조각 내놓기",
      action: "오늘은 만들던 것 1개를 미완성인 채로 한 사람에게 보여주자.",
      reason: "내보내는 날이다. 일찍 꺼내면 방향을 빨리 고친다.",
      avoid: "오늘은 반응이 오기 전에 결과를 단정하지 마.",
      minutes: 20,
    },
  },
  재성: {
    love: {
      title: "함께 쓰는 것 한 가지 정하기",
      action: "오늘은 둘이 함께 쓰는 돈이나 시간 1가지의 기준을 물어보자.",
      reason: "손에 잡히는 걸 보는 날이다. 마음보다 조건 얘기가 덜 어색하다.",
      avoid: "오늘은 상대 마음을 돈이나 선물 크기로 재지 마.",
      minutes: 15,
    },
    money: {
      title: "새는 돈 1개 찾기",
      action: "오늘은 지난달 고정비에서 안 쓰는 항목 1개를 찾아 표시하자.",
      reason: "가진 걸 세는 날이다. 늘리기보다 새는 곳을 보는 게 맞다.",
      avoid: "오늘은 기분으로 큰 지출이나 투자 결정을 하지 마.",
      minutes: 15,
    },
    study: {
      title: "가진 자료부터 끝내기",
      action: "오늘은 사둔 교재 중 제일 미룬 것의 첫 단원만 25분 하자.",
      reason: "가진 것에 눈이 가는 날이다. 새로 사지 말고 손에 있는 걸 쓰자.",
      avoid: "오늘은 새 교재나 강의를 결제하지 마.",
      minutes: 25,
    },
    career: {
      title: "일의 값 확인하기",
      action: "오늘은 맡은 일 1개에 실제로 든 시간을 적어보자.",
      reason: "값이 보이는 날이다. 느낌을 숫자로 옮기자.",
      avoid: "오늘은 조건 확인 없이 새 일을 받지 마.",
      minutes: 15,
    },
    business: {
      title: "숫자 하나 확인하기",
      action: "오늘은 매출이나 비용 1개를 지난달과 비교해보자.",
      reason: "돌아가는 숫자를 보는 날이다. 새 시도는 그 다음이다.",
      avoid: "오늘은 숫자 확인 전에 지출을 정하지 마.",
      minutes: 20,
    },
    relationship: {
      title: "빌린 것 돌려주기",
      action: "오늘은 빌린 것이나 갚을 것 1가지를 정리해 알리자.",
      reason: "주고받음이 또렷해지는 날이다. 미룬 정산을 닫자.",
      avoid: "오늘은 부담스러운 부탁을 거절 못한 채 미루지 마.",
      minutes: 10,
    },
    health: {
      title: "먹은 것 적어보기",
      action: "오늘은 하루 먹은 걸 그대로 적어보자.",
      reason: "지금을 세어보는 날이다. 바꾸기 전에 먼저 보자.",
      avoid: "오늘은 끼니를 거르거나 식단을 통째로 바꾸지 마.",
      minutes: 10,
    },
    growth: {
      title: "쌓아둔 것 하나 꺼내기",
      action: "오늘은 저장만 해둔 자료 1개를 10분만 읽자.",
      reason: "모아둔 걸 여는 날이다. 새로 모으는 건 그 다음이다.",
      avoid: "오늘은 안 읽은 게 쌓인 채 새 자료를 더 모으지 마.",
      minutes: 10,
    },
  },
  관성: {
    love: {
      title: "말하지 못한 선 하나 정하기",
      action: "오늘은 관계에서 불편했던 것 1가지를 비난 없이 한 문장으로 적자.",
      reason: "형태가 또렷해지는 날이다. 참아온 자리를 문장으로 만들자.",
      avoid: "오늘은 감정이 오른 채 결론을 통보하지 마.",
      minutes: 15,
    },
    money: {
      title: "지출 규칙 하나 세우기",
      action: "오늘은 이번 달 남은 기간의 지출 기준 1가지를 정해 적자.",
      reason: "선이 서는 날이다. 새 결정보다 지킬 선이 먼저다.",
      avoid: "오늘은 새 지출이나 투자 결정을 서두르지 마.",
      minutes: 15,
    },
    study: {
      title: "마감 조건 정하기",
      action: "오늘은 공부 중인 것 1개의 기한과 범위를 정해 적자.",
      reason: "틀이 서는 날이다. 범위 없는 계획이 제일 먼저 흔들린다.",
      avoid: "오늘은 끝낼 조건 없이 새 과목을 열지 마.",
      minutes: 20,
    },
    career: {
      title: "완료 조건 명확히 하기",
      action: "오늘은 진행 중인 일 1개의 마감 조건을 한 문장으로 정해 확인받자.",
      reason: "책임이 또렷해지는 날이다. 벌이기보다 끝을 정하는 게 맞다.",
      avoid: "오늘은 일을 더 벌리거나 새로 맡지 마.",
      minutes: 15,
    },
    business: {
      title: "약속한 것 하나 지키기",
      action: "오늘은 미뤄둔 약속 1가지를 처리하거나 새 기한을 알리자.",
      reason: "책임이 떠오르는 날이다. 오늘 닫으면 안 커진다.",
      avoid: "오늘은 지킬 수 있는지 모르는 기한을 약속하지 마.",
      minutes: 20,
    },
    relationship: {
      title: "거절 한 번 하기",
      action: "오늘은 부담스러웠던 부탁 1가지에 되는 범위를 분명히 말하자.",
      reason: "경계가 서는 날이다. 애매한 자리를 정리하기 덜 어렵다.",
      avoid: "오늘은 마음에 없는 승낙으로 넘기지 마.",
      minutes: 10,
    },
    health: {
      title: "잘 시간 정해두기",
      action: "오늘은 잘 시간을 정해 알람을 맞추자.",
      reason: "형태를 정하기 좋은 날이다. 의지 말고 시간에 맡기자.",
      avoid: "오늘은 일정으로 쉬는 시간을 밀어내지 마.",
      minutes: 5,
    },
    growth: {
      title: "습관 하나에 시간 붙이기",
      action: "오늘은 만들고 싶은 습관 1개를 몇 시에 할지 정해 적자.",
      reason: "틀이 서는 날이다. 마음보다 시각이 오래 간다.",
      avoid: "오늘은 습관 여러 개를 한꺼번에 열지 마.",
      minutes: 10,
    },
  },
  인성: {
    love: {
      title: "확인 하나 먼저",
      action: "오늘은 결론 내리기 전에 상대에게 사실 1가지를 확인하자.",
      reason: "안으로 정리하는 날이다. 관계도 확장보다 점검이 맞다.",
      avoid: "오늘은 짐작만으로 결론을 정하지 마.",
      minutes: 10,
    },
    money: {
      title: "이번 주 지출 미리 보기",
      action: "오늘은 이번 주 나갈 지출을 한 번 적어 정리하자.",
      reason: "점검의 날이다. 늘리는 결정은 미루는 게 맞다.",
      avoid: "오늘은 새 지출이나 투자를 오늘 정하지 마.",
      minutes: 15,
    },
    study: {
      title: "가장 미룬 것의 첫 단원만",
      action: "오늘은 가장 미룬 과목의 첫 단원만 25분 하자.",
      reason: "채우는 날이다. 계획 말고 아는 것부터 바로 시작하자.",
      avoid: "오늘은 여러 과목을 동시에 열지 마.",
      minutes: 25,
    },
    career: {
      title: "쌓인 것 하나 정리하기",
      action: "오늘은 밀린 문서나 메일 1개를 정리해 닫자.",
      reason: "정리의 날이다. 새 일보다 열린 걸 닫는 게 맞다.",
      avoid: "오늘은 새 프로젝트나 큰 결정을 서두르지 마.",
      minutes: 20,
    },
    business: {
      title: "지난 기록 되짚기",
      action: "오늘은 지난달 안 됐던 시도 1가지의 이유를 두 줄로 적자.",
      reason: "되짚는 날이다. 다음 시도 전에 지난 걸 닫자.",
      avoid: "오늘은 검증 없이 새 결정을 내리지 마.",
      minutes: 20,
    },
    relationship: {
      title: "고마웠던 일 떠올려 적기",
      action: "오늘은 도움받은 사람 1명에게 뭐가 고마웠는지 적거나 전하자.",
      reason: "받은 걸 세는 날이다. 새 자리보다 받은 걸 헤아리자.",
      avoid: "오늘은 모임이나 약속을 한꺼번에 잡지 마.",
      minutes: 10,
    },
    health: {
      title: "먼저 쉬기",
      action: "오늘은 20분 일찍 눕고 자기 전 화면 끊는 시간을 정하자.",
      reason: "회복의 날이다. 더하기보다 덜기가 맞다.",
      avoid: "오늘은 잠을 줄여 일정을 늘리지 마.",
      minutes: 20,
    },
    growth: {
      title: "10분 읽기",
      action: "오늘은 관심 주제 자료를 10분만 읽자.",
      reason: "넣어두는 날이다. 결과는 다음에 내자.",
      avoid: "오늘은 배운 걸 바로 결과로 만들려 서두르지 마.",
      minutes: 10,
    },
  },
};

/** 영역별 안내 문구 — 예언이 아니라 참고 자료임을 화면에서 못박는다 */
const DISCLAIMER: Partial<Record<FortuneDomain, string>> = {
  money: "재물 얘기는 예언이 아니라 소비 습관을 돌아보는 참고다. 투자 판단은 네 몫이다.",
  health: "건강 얘기는 생활 습관 제안까지다. 진단도 처방도 아니다.",
  business: "사업 얘기는 참고까지다. 결정은 네 몫이다.",
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
  /** 내 일간의 오행 — 깃발이 오행 생극을 재는 데 쓴다 */
  myElement: Ohaeng;
  /** 오늘 일진 천간의 오행 */
  todayElement: Ohaeng;
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
    myElement: stemElement(chart.day.ganIdx),
    todayElement: stemElement(todayPillar.ganIdx),
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
      rabbit: FLOW_RABBIT[flow.flow],
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

/** 첫 화면에서 인사하는 토끼 — 흐름과 무관하게 늘 같다.
    한복(조끼) 입은 러브레빗 전신 인사 컷 (2026-09-03, 힉스필드 생성).
    영상 쌍이 아직 없어 정지 그림만 쓴다 — 화면에서는 bob 으로 움직인다. */
export const GREETING_RABBIT_ART = "/assets/today/rabbit-hello-hanbok.webp";

/** 테스트가 표 전체를 훑는 데 쓴다 */
export const FLOWS: Flow[] = ["비겁", "식상", "재성", "관성", "인성"];
export { ACTIONS as DAILY_ACTION_TABLE, FLOW_RABBIT };
