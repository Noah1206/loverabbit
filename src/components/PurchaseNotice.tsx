import Link from "next/link";

/*
  결제 전 고지 — 전자상거래법 제17조 제2항 제5호.

  콘텐츠는 "생성하는 순간" 이용이 시작되므로 그때부터 청약철회가 막힌다.
  법은 그 사실을 **결제 전에** 알리기를 요구하고, 우리 약관 5조도 "결제
  화면에서 이 점을 다시 안내합니다" 라고 이미 적어 두었다 — 안 적으면
  약관이 거짓말이 된다.

  한 곳에 두고 결제 화면들이 같이 쓴다. 두 벌로 적으면 한쪽만 고쳐지는
  날이 오고, 그날 고지가 서로 다른 말을 한다.
*/

export default function PurchaseNotice({ kind }: { kind: "reading" | "credits" }) {
  return (
    <p className="purchase-notice">
      {kind === "reading" ? (
        <>여는 순간 나만을 위한 글이 만들어져 <strong>열람 후에는 환불되지 않아요.</strong></>
      ) : (
        <>충전한 러빗은 <strong>쓰지 않았다면 7일 안에 환불</strong>받을 수 있어요. 사주를 연
        뒤에는 그 러빗은 환불되지 않아요.</>
      )}{" "}
      <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link>
    </p>
  );
}
