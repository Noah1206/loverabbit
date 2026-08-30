// 리딩 주소를 열었을 때 결제 화면으로 돌려보낼 것인가.
//
// 여기서 한 줄을 잘못 읽으면 돈 낸 사람이 결제 화면을 다시 본다. 실제로 그랬다:
// 승인 라우트에 시간 제한 선언이 없어 승인 직후 생성이 잘렸고, 그 리딩은 본문이
// 빈 채로 남았다. 화면은 본문(full)이 없다는 이유로 "안 산 사람"으로 읽고
// /checkout 으로 보냈다 — 이미 낸 사람에게 두 번 내라는 말이었다.
//
// 그래서 본문과 권리를 나눠 본다. 본문은 늦을 수 있지만 권리는 이미 확정이다.

export interface GateState {
  /** 이 기기에 본문이 있는가 (보관함의 full) */
  hasFull: boolean;
  /** DB 가 "해금됨"이라고 답했는가. 본문이 아직이어도 참일 수 있다. */
  paidUnlocked: boolean;
  /** 서버에 해금 여부를 물어보는 일이 끝났는가 */
  unlockChecked: boolean;
  /** 승인 대기 중인 주문 번호 */
  pendingOrderId?: number;
}

export type GateDecision =
  | { kind: "stay" }
  | { kind: "pending"; orderId: number }
  | { kind: "checkout" };

/**
 * 묻기 전에는 아무 데도 보내지 않는다(stay). 답을 들은 뒤에만 가른다.
 *
 * - 본문이 있으면 읽는 중이다.
 * - 본문이 없어도 이미 샀으면 여기 둔다 — "준비 중" 안내가 화면에 있다.
 * - 승인 대기 주문이 있으면 그 화면이 제자리다.
 * - 그 밖에는 아직 안 산 리딩이다.
 */
export function gateDecision(state: GateState): GateDecision {
  if (!state.unlockChecked) return { kind: "stay" };
  if (state.hasFull) return { kind: "stay" };
  if (state.paidUnlocked) return { kind: "stay" };
  if (state.pendingOrderId) return { kind: "pending", orderId: state.pendingOrderId };
  return { kind: "checkout" };
}
