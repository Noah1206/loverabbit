/*
  결제 수단의 이름.

  리딩 결제와 대화권 결제가 같은 수단을 다른 말로 부르면, 두 번째 결제에서
  같은 것을 또 배워야 한다. 이름은 한 곳에 둔다.
*/
export type PayMethod = "manual" | "toss";

export const METHOD_LABEL: Record<PayMethod, { title: string; detail: string }> = {
  manual: { title: "직접 송금", detail: "계좌로 보내고 확인 후 열림" },
  toss: { title: "카드·간편결제", detail: "토스페이먼츠 결제창" },
};

/*
  지금 열어 둔 결제 수단.

  키가 설정돼 있는가로만 판단하면, 키가 살아 있는 한 결제는 계속 그리로 간다.
  실제로 받을 수 있는가는 별개라서 여기서 따로 적는다.

  포트원(KG이니시스)은 2026-09-09 에 걷어냈다. 상점이 개시되지 않아 결제창이
  문 앞에서 돌려보내는데(MX2002), 화면만 닫아 두고 서버는 그대로 열어 둬서
  주문만 만들어지고 결제는 안 되는 유령 주문이 쌓였다 — 회원 #466 의 212~215.
  다시 열려면 결제 경로를 되살리는 게 아니라, 서버 게이트를 함께 두고 열어야
  한다.

  manual(직접 송금): 열림. 토스뱅크로 보내고 관리자가 입금을 확인한다.
    지금 실제로 돈이 들어오는 유일한 길이다.

  닫히면 토스페이먼츠 위젯이 마지막 수단으로 선다.
*/
export const PAYMENT_METHOD_OPEN: Record<PayMethod, boolean> = {
  manual: true,
  toss: true,
};
