/*
  결제 수단의 이름.

  리딩 결제와 대화권 결제가 같은 수단을 다른 말로 부르면, 두 번째 결제에서
  같은 것을 또 배워야 한다. 이름은 한 곳에 둔다.

  앞의 둘은 똑같이 계좌이체다. 다른 것은 확인 방식뿐이라 그 차이를 이름에
  적는다 — 바로 열리는가, 사람이 확인할 때까지 기다리는가.
*/
export type PayMethod = "portone" | "manual" | "toss";

export const METHOD_LABEL: Record<PayMethod, { title: string; detail: string }> = {
  portone: { title: "계좌이체", detail: "결제창에서 은행 선택 · 바로 열림" },
  manual: { title: "직접 송금", detail: "계좌로 보내고 확인 후 열림" },
  toss: { title: "카드·간편결제", detail: "토스페이먼츠 결제창" },
};

/*
  직접 송금을 결제창에 함께 내보낼 것인가.

  지금은 닫혀 있다 (2026-08-26 운영자 결정). 포트원 계좌이체가 설정돼 있으면
  그것 하나만 나가고, 결제 수단 선택줄도 서지 않는다 — 예전과 같은 모양이다.

  코드는 지운 게 아니라 닫아 둔 것이다. 다시 열려면 이 값만 true 로 바꾼다.
  포트원이 아예 설정되지 않은 환경에서는 이 값과 무관하게 직접 송금이 나온다 —
  그때는 그게 유일한 결제 수단이라 닫으면 결제가 통째로 막힌다.
*/
export const OFFER_MANUAL_TRANSFER = false;
