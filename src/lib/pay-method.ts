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
  지금 열어 둔 결제 수단.

  키가 설정돼 있는가로만 판단하면, 키가 살아 있는 한 결제는 계속 그리로 간다.
  실제로 받을 수 있는가는 별개라서 여기서 따로 적는다.

  portone(KG이니시스): 닫힘. 상점이 아직 개시되지 않아 결제창이 문 앞에서
    돌려보낸다 — "[01] 상점 서비스가 개시 상태가 아닙니다.(MX2002)"
    (2026-08-26 운영 확인). 이니시스 상점이 개시되면 true 로 바꾼다.

  manual(직접 송금): 열림. 토스뱅크로 보내고 관리자가 입금을 확인한다.
    지금 실제로 돈이 들어오는 유일한 길이다.

  둘 다 닫히면 토스페이먼츠 위젯이 마지막 수단으로 선다.
*/
export const PAYMENT_METHOD_OPEN: Record<PayMethod, boolean> = {
  portone: false,
  manual: true,
  toss: true,
};
