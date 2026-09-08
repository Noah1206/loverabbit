// 관계 리포트를 문구 표에서 조립한다 — 모델을 부르지 않는다.
//
// 왜 이렇게 바꿨나 (2026-09-08):
//
// 관계 상태를 고를 때마다 모델을 한 번씩 불렀다. 사람당 한 번이니 작아 보이지만,
// 이 기능의 목적은 사람을 다섯 명 열 명 넣게 만드는 것이다. **바이럴이 성공할수록
// 값이 오르는 구조**였다. 친구 1,000명 추가 = 호출 1,000번.
//
// 여기서 나오는 문장은 전부 미리 적어 둔 것이다. 고르는 방법이 핵심이다:
//
//   · 무작위로 뽑지 않는다. 같은 두 사람이 내일 다시 열었을 때 다른 말이 나오면
//     그건 해석이 아니라 뽑기다. 참여자 id 와 역할·구간에서 해시를 만들어 고른다.
//   · 조립식이다. 라벨·설명·강점·주의를 따로 두고 조합한다. 문장을 통으로 쌓으면
//     같은 수의 문구로 만들 수 있는 경우의 수가 훨씬 적다.
//
// 유료 상세(WHY)는 그대로 기존 리딩 파이프라인이 맡는다. 여기는 무료(WHAT)다.

import { GUIN_DISCLAIMER, type GuinAiReport, type GuinRelStatus, type GuinRole } from "@/lib/guin-map";

/** 같은 입력이면 같은 값. 문구를 고르는 유일한 손잡이다. */
function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 표에서 하나를 결정적으로 고른다 */
function pick<T>(list: readonly T[], seed: string): T {
  return list[hashOf(seed) % list.length];
}

/** 점수 구간 — 문구를 가르는 두 번째 열쇠 */
export type ScoreBand = "high" | "mid" | "low";

export function bandOf(score: number): ScoreBand {
  if (score >= 78) return "high";
  if (score >= 55) return "mid";
  return "low";
}

/* ── 역할 × 구간 문구 ───────────────────────────────────────────────────
   역할은 계산이 정한다(guin-calc). 여기서는 그 역할에 말을 입힐 뿐이다.
   없는 사실을 만들지 않는다 — 전부 "이 역할이면 이런 결" 수준의 표현이다. */

type RoleKey = GuinRole;

const SUMMARY: Record<RoleKey, Record<ScoreBand, readonly string[]>> = {
  right_hand: {
    high: [
      "중요한 순간마다 현실적인 힘이 되어주는 인연이에요.",
      "함께할수록 일이 실제로 굴러가는 관계예요.",
      "막막할 때 방법을 같이 찾아주는 사람이에요.",
    ],
    mid: [
      "필요할 때 손을 보태주는 편안한 관계예요.",
      "서로의 부족한 자리를 조금씩 메워주는 사이예요.",
    ],
    low: [
      "도움을 주고받는 방식이 서로 조금 달라요.",
      "각자의 방식이 뚜렷해서 맞춰가는 시간이 필요해요.",
    ],
  },
  comforter: {
    high: [
      "함께 있으면 긴장이 풀리는 인연이에요.",
      "말을 고르지 않아도 편한 몇 안 되는 사람이에요.",
      "곁에 있는 것만으로 숨이 놓이는 관계예요.",
    ],
    mid: [
      "서로의 속도를 이해하기 쉬운 사이예요.",
      "오래 있어도 부담이 적은 관계예요.",
    ],
    low: [
      "편해지기까지 서로 시간이 조금 필요한 사이예요.",
      "가까워질수록 서로의 리듬을 맞춰야 하는 관계예요.",
    ],
  },
  communicator: {
    high: [
      "말이 잘 통해서 생각이 정리되는 인연이에요.",
      "대화를 하다 보면 답이 나오는 관계예요.",
      "서로의 생각을 꺼내기 쉬운 사람이에요.",
    ],
    mid: [
      "이야기를 주고받으며 가까워지는 사이예요.",
      "대화가 관계의 중심이 되는 관계예요.",
    ],
    low: [
      "같은 말을 서로 다르게 듣기 쉬운 사이예요.",
      "표현하는 방식이 달라 한 번 더 물어야 하는 관계예요.",
    ],
  },
  growth_teacher: {
    high: [
      "혼자서는 안 하던 시도를 하게 만드는 인연이에요.",
      "생각의 반경이 넓어지는 관계예요.",
      "함께하면 성장 속도가 빨라지는 사람이에요.",
    ],
    mid: [
      "새로운 시각을 하나씩 열어주는 사이예요.",
      "익숙한 방식에서 조금씩 벗어나게 하는 관계예요.",
    ],
    low: [
      "속도가 서로 달라 잠깐씩 페이스를 맞춰야 하는 사이예요.",
      "자극이 큰 만큼 쉬어가는 시간도 필요한 관계예요.",
    ],
  },
  // 옛(guin-1) 역할 — 저장된 지도를 그대로 그리기 위해 남긴다
  benefactor: {
    high: ["필요한 순간에 이상하게 도움이 되는 인연이에요."],
    mid: ["기대지 않아도 곁에 있어주는 관계예요."],
    low: ["도움의 결이 서로 조금 다른 사이예요."],
  },
  mirror: {
    high: ["설명하지 않아도 통하는 것이 많은 인연이에요."],
    mid: ["닮은 구석이 있어 편한 관계예요."],
    low: ["닮은 만큼 같은 자리에서 부딪히기도 하는 사이예요."],
  },
  stimulator: {
    high: ["함께 있으면 새로운 것을 시도하게 되는 인연이에요."],
    mid: ["서로에게 자극이 되는 관계예요."],
    low: ["자극이 큰 만큼 쉬어가는 시간이 필요한 사이예요."],
  },
  neutral: {
    high: ["결이 달라 오히려 배울 것이 많은 인연이에요."],
    mid: ["서로 다른 시선이라 대화가 새로운 관계예요."],
    low: ["다름을 알아가는 시간이 필요한 사이예요."],
  },
};

/** 역할이 왜 그렇게 나왔는지 — 계산이 본 축을 말로 옮긴 것 */
const ROLE_WHY: Record<RoleKey, readonly string[]> = {
  right_hand: [
    "두 사람의 기운이 서로의 부족한 자리를 채우는 쪽으로 놓여 있어요.",
    "생각을 행동으로 옮기는 결이 잘 맞물려요.",
  ],
  comforter: [
    "서로의 기운이 부딪히지 않고 가라앉는 자리에 있어요.",
    "속도와 온도가 비슷해서 함께 있을 때 힘이 덜 들어요.",
  ],
  communicator: [
    "말이 오가는 자리가 두 사람 사이에서 가장 넓게 열려 있어요.",
    "서로의 생각을 꺼내게 만드는 기운이 있어요.",
  ],
  growth_teacher: [
    "서로에게 없는 기운을 가지고 있어 자극이 오가요.",
    "익숙한 자리 밖으로 서로를 밀어내는 결이에요.",
  ],
  benefactor: ["필요한 자리에 마침 놓여 있는 기운이에요."],
  mirror: ["비슷한 기운이 겹쳐 있어 서로가 잘 읽혀요."],
  stimulator: ["서로 다른 기운이 부딪히며 움직임을 만들어요."],
  neutral: ["서로 다른 기운이라 겹치는 자리가 적어요."],
};

const STRENGTHS: Record<RoleKey, readonly [string, string][]> = {
  right_hand: [
    ["막막할 때 구체적인 방법이 나와요", "서로의 일을 실제로 덜어줄 수 있어요"],
    ["결정이 필요할 때 기댈 수 있어요", "말보다 행동으로 도움이 오가요"],
  ],
  comforter: [
    ["함께 있을 때 긴장이 풀려요", "무리해서 맞추지 않아도 돼요"],
    ["오래 있어도 지치지 않아요", "서로의 속도를 존중하기 쉬워요"],
  ],
  communicator: [
    ["대화를 하다 보면 생각이 정리돼요", "말을 꺼내기가 어렵지 않아요"],
    ["서로의 해석을 들어볼 수 있어요", "오해가 생겨도 풀기 쉬운 편이에요"],
  ],
  growth_teacher: [
    ["안 하던 시도를 하게 돼요", "시야가 넓어지는 자극이 있어요"],
    ["서로를 한 단계 밀어줘요", "새로운 방향이 자주 보여요"],
  ],
  benefactor: [["필요한 순간에 힘이 되어줘요", "기대하지 않은 도움이 와요"]],
  mirror: [["설명이 짧아도 통해요", "같이 있는 것이 편해요"]],
  stimulator: [["새로운 것을 함께 하게 돼요", "서로를 움직이게 만들어요"]],
  neutral: [["서로 다른 시선을 배울 수 있어요", "대화가 새로워요"]],
};

const CAUTION: Record<RoleKey, readonly string[]> = {
  right_hand: [
    "도움을 주고받는 방식을 말로 정해두면 서로 편해져요.",
    "한쪽만 계속 챙기는 자리가 되지 않게 살펴보세요.",
  ],
  comforter: [
    "편한 만큼 할 말을 미루기 쉬워요. 작은 것부터 꺼내보세요.",
    "문제를 바로 풀려 하기보다 먼저 들어주는 편이 나아요.",
  ],
  communicator: [
    "정답을 정하기보다 각자의 해석을 먼저 말해보세요.",
    "말이 많아질수록 듣는 시간을 같이 늘려보세요.",
  ],
  growth_teacher: [
    "속도가 다른 날에는 잠깐 페이스를 맞춰보세요.",
    "다름을 곧바로 충돌로 읽지 않는 게 좋아요.",
  ],
  benefactor: ["고마움을 표현할 자리를 만들어보세요."],
  mirror: ["닮은 만큼 같은 지점에서 고집이 세질 수 있어요."],
  stimulator: ["쉬어가는 시간을 서로 챙겨주세요."],
  neutral: ["다름을 틀림으로 읽지 않게 한 박자 쉬어가요."],
};

/** 상태(참여자가 고른 지금 관계)가 붙었을 때 더하는 한 줄 */
const STATUS_LINE: Record<GuinRelStatus, string> = {
  crush: "지금은 서로를 알아가는 자리라, 속도를 맞추는 게 가장 중요해요.",
  dating: "지금 함께인 만큼, 위의 강점이 실제로 오가는지 한 번 살펴보세요.",
  conflict: "지금 부딪히고 있다면, 아래 살펴볼 점부터 하나만 손대보세요.",
  no_contact: "연락이 줄어든 지금은 무리해서 당기기보다 자리를 두는 편이 나아요.",
  reunion: "다시 만날지 고민 중이라면, 강점보다 살펴볼 점을 먼저 읽어보세요.",
  friend: "친구로 오래 가는 자리예요. 서로의 결을 알아두면 더 편해져요.",
  family: "가족이라 더 가깝고, 그만큼 조율이 필요한 자리예요.",
  coworker: "일로 만난 사이라면 위의 강점이 특히 잘 쓰여요.",
  unclear: "아직 이름 붙이기 어려운 자리라면, 서두르지 않아도 괜찮아요.",
};

const ACTION: Record<RoleKey, readonly string[]> = {
  right_hand: ["요즘 가장 도움받고 싶은 것 하나를 구체적으로 말해보세요."],
  comforter: ["최근에 편했던 순간을 그대로 전해보세요."],
  communicator: ["미뤄둔 이야기 하나를 오늘 꺼내보세요."],
  growth_teacher: ["서로 덕분에 처음 해 본 것을 세어보세요."],
  benefactor: ["고맙다고 말할 자리를 한 번 만들어보세요."],
  mirror: ["둘만 아는 습관을 이야기해보세요."],
  stimulator: ["다음에 같이 해볼 것을 하나 정해보세요."],
  neutral: ["서로 가장 다르다고 느끼는 지점을 말해보세요."],
};

export const GUIN_TEMPLATE_VERSION = "guin-tpl-1";

/**
 * 관계 리포트 한 장. **모델을 부르지 않는다.**
 *
 * 같은 (참여자, 역할, 구간, 상태) 면 언제나 같은 문장이 나온다 — 오늘 본 해석과
 * 내일 본 해석이 다르면 그건 해석이 아니다.
 */
export function buildGuinReport(input: {
  participantId: string;
  participantNickname: string;
  role: GuinRole;
  score: number;
  status: GuinRelStatus | null;
  conversationPrompt?: string;
}): GuinAiReport {
  const band = bandOf(input.score);
  const seed = `${input.participantId}:${input.role}:${band}`;

  const strengths = pick(STRENGTHS[input.role], `${seed}:s`);
  const statusLine = input.status ? STATUS_LINE[input.status] : "";

  return {
    summary: pick(SUMMARY[input.role][band], seed),
    roleExplanation: pick(ROLE_WHY[input.role], `${seed}:w`),
    strengths: [strengths[0], strengths[1]],
    caution: pick(CAUTION[input.role], `${seed}:c`),
    // 상태를 안 골랐으면 이 칸은 비운다 — 지어내지 않는다.
    currentContext: statusLine,
    suggestedAction: pick(ACTION[input.role], `${seed}:a`),
    conversationPrompt: input.conversationPrompt ?? "",
    disclaimer: GUIN_DISCLAIMER,
  };
}
