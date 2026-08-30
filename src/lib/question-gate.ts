// 질문을 팔 수 있는가.
//
// 화면은 "내 사주와 이미 받은 리딩을 바탕으로" 라고 약속한다. 그 약속을 못
// 지키는 상태에서 크레딧을 가져가면 안 된다 — 무료 크레딧을 없앤 뒤로 그
// 5장은 손님이 돈 주고 산 것이다.
//
// 판단을 여기 모아 둔다. /api/question 과 /ask 가 같은 규칙을 봐야 하고,
// 한쪽만 고치는 사고를 막으려면 규칙이 한 곳에 있어야 한다.

import { QUESTION_COST } from "@/lib/credits";

export interface AskState {
  /** 로그인했는가 */
  signedIn: boolean;
  /** 내 사주(명식)가 저장돼 있는가 */
  hasProfile: boolean;
  /** 지금 잔액 */
  balance: number;
}

export type AskBlock = "signup" | "profile" | "credits" | null;

/**
 * 막아야 할 이유. 없으면 null.
 *
 * 순서가 규칙이다. 로그인 → 명식 → 잔액. 명식을 잔액보다 먼저 보는 이유는,
 * 명식이 없는 사람에게 "충전하세요" 를 먼저 말하면 충전한 뒤에 다시 막히기
 * 때문이다.
 */
export function askBlock(state: AskState): AskBlock {
  if (!state.signedIn) return "signup";
  if (!state.hasProfile) return "profile";
  if (state.balance < QUESTION_COST) return "credits";
  return null;
}

export function canAsk(state: AskState): boolean {
  return askBlock(state) === null;
}
