"use client";

import { useEffect, useState } from "react";
import PortOneTransferForm, {
  PORTONE_TRANSFER_CONFIGURED,
} from "@/components/PortOneTransferForm";

const KAKAOBANK_LINK = "kakaobank://";
import type { TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY?.trim() ?? "";
const CUSTOMER_KEY_STORAGE = "loverabbit_toss_customer_key_v1";
const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME?.trim() ?? "";
const BANK_ACCOUNT = process.env.NEXT_PUBLIC_BANK_ACCOUNT?.trim() ?? "";
const BANK_HOLDER = process.env.NEXT_PUBLIC_BANK_HOLDER?.trim() ?? "";

function getCustomerKey() {
  const stored = sessionStorage.getItem(CUSTOMER_KEY_STORAGE);
  if (stored) return stored;
  const created = `lr_${crypto.randomUUID()}`;
  sessionStorage.setItem(CUSTOMER_KEY_STORAGE, created);
  return created;
}

export default function PaymentModal({
  readingId,
  price,
  userToken,
  customerEmail,
  depositorCode,
  paying: transferSubmitting = false,
  onTransferSubmitted,
  onClose,
}: {
  readingId: string;
  price: number;
  userToken: string;
  customerEmail: string;
  depositorCode?: string;
  paying?: boolean;
  onTransferSubmitted?: () => void;
  onClose: () => void;
}) {
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  // 계좌번호 복사 버튼의 짧은 피드백 - 아이콘만 있는 버튼이라 눌렸는지 보여야 한다
  const [copied, setCopied] = useState(false);
  const transferConfigured = Boolean(BANK_NAME && BANK_ACCOUNT && depositorCode && onTransferSubmitted);
  const tossLink = `supertoss://send?bank=${encodeURIComponent(BANK_NAME)}&accountNo=${BANK_ACCOUNT.replace(/-/g, "")}&amount=${price}&origin=linkgen`;

  useEffect(() => {
    // 이체가 기본 결제인 동안은 토스 SDK 를 아예 부르지 않는다 — 안 그리는
    // 위젯을 위해 스크립트만 내려받는다.
    if (!TOSS_CLIENT_KEY || PORTONE_TRANSFER_CONFIGURED || transferConfigured) return;
    let active = true;

    const setup = async () => {
      try {
        const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
        const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
        const nextWidgets = tossPayments.widgets({ customerKey: getCustomerKey() });
        await nextWidgets.setAmount({ currency: "KRW", value: price });
        await Promise.all([
          nextWidgets.renderPaymentMethods({ selector: "#toss-payment-methods", variantKey: "DEFAULT" }),
          nextWidgets.renderAgreement({ selector: "#toss-payment-agreement", variantKey: "AGREEMENT" }),
        ]);
        if (active) {
          setWidgets(nextWidgets);
          setReady(true);
        }
      } catch (reason) {
        console.error("토스 결제창 초기화 실패:", reason);
        if (active) setError("결제창을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    };

    void setup();
    return () => {
      active = false;
    };
  }, [price]);

  const requestPayment = async () => {
    if (!widgets) return;
    setPaying(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingId, userToken }),
      });
      const checkout = (await response.json().catch(() => ({}))) as {
        orderId?: string;
        amount?: number;
        orderName?: string;
        error?: string;
      };
      if (!response.ok || !checkout.orderId || checkout.amount !== price) {
        throw new Error(checkout.error ?? "결제 주문을 만들지 못했어요.");
      }

      await widgets.setAmount({ currency: "KRW", value: checkout.amount });
      const readingParam = encodeURIComponent(readingId);
      await widgets.requestPayment({
        orderId: checkout.orderId,
        orderName: checkout.orderName ?? "러브레빗 사주 전문 리딩",
        customerEmail,
        successUrl: `${window.location.origin}/payment/success?readingId=${readingParam}`,
        failUrl: `${window.location.origin}/payment/fail?readingId=${readingParam}`,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "결제를 시작하지 못했어요.");
      setPaying(false);
    }
  };

  return (
    <div
      className="app-modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      onClick={onClose}
    >
      <div className="card toss-payment-modal" onClick={(event) => event.stopPropagation()}>
        <span className="badge">안전한 결제</span>
        <h3 id="payment-modal-title">전문 리딩 열기</h3>
        <p className="toss-payment-price">{price.toLocaleString()}원</p>
        <p className="toss-payment-intro">결제가 승인된 뒤에만 결론과 전문이 열립니다.</p>

        {/* 계좌이체가 기본이다 — 운영자 결정 (2026-08-21). 토스 PG 결제는 토스
            승인 API 를 거치는데, 승인 중 새로고침이 겹치면 결제한 사람이 실패
            화면을 볼 수 있는 레이스가 있다. 이체는 관리자가 입금을 눈으로 확인해
            승인하는 흐름이라 그 문제 자체가 없다. 토스 위젯은 이체 계좌가
            설정되지 않은 환경에서만 나온다. */}
        {PORTONE_TRANSFER_CONFIGURED ? (
          <PortOneTransferForm
            amount={price}
            customerEmail={customerEmail}
            checkoutEndpoint="/api/checkout"
            checkoutBody={{ readingId, userToken }}
            redirectPath={`/payment/success?readingId=${encodeURIComponent(readingId)}`}
            buttonLabel={`${price.toLocaleString()}원 계좌이체하고 전문 보기`}
          />
        ) : transferConfigured ? (
          <div className="transfer-payment-fallback">
            <p className="toss-payment-config-error">
              계좌이체로 결제해요. 관리자가 실제 입금을 확인하면 전문이 열립니다.
            </p>
            {/* 이체 앱 두 개를 가로로 나란히. 토스는 계좌·금액까지 채워 열리고,
                카카오뱅크는 이체 딥링크가 공개돼 있지 않아 앱만 연다 - 대신 누르는
                순간 계좌번호를 클립보드에 실어 두어 앱에서 붙여넣으면 된다. */}
            <div className="transfer-pay-apps">
              <a className="transfer-pay-app" href={tossLink}>
                <strong>토스</strong>
                <span>계좌이체</span>
              </a>
              <a
                className="transfer-pay-app"
                href={KAKAOBANK_LINK}
                onClick={() => void navigator.clipboard.writeText(BANK_ACCOUNT).catch(() => {})}
              >
                <strong>카카오뱅크</strong>
                <span>계좌이체</span>
              </a>
            </div>
            <div className="transfer-pay-account">
              <p>
                <strong>{BANK_NAME}</strong> {BANK_ACCOUNT}
                {BANK_HOLDER && <> · {BANK_HOLDER}</>}
              </p>
              <button
                type="button"
                className="transfer-pay-copy"
                aria-label="계좌번호 복사"
                onClick={() => {
                  void navigator.clipboard.writeText(BANK_ACCOUNT).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? (
                  "복사됨"
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
                  </svg>
                )}
              </button>
            </div>
            <p className="transfer-pay-memo">입금 메모에 <strong>{depositorCode}</strong> 를 꼭 적어주세요</p>
            <button
              className="transfer-pay-confirm"
              onClick={onTransferSubmitted}
              disabled={transferSubmitting}
            >
              {transferSubmitting ? "확인 요청 보내는 중…" : "입금을 마쳤어요"}
              <span aria-hidden>→</span>
            </button>
          </div>
        ) : TOSS_CLIENT_KEY ? (
          <>
            <div id="toss-payment-methods" className="toss-payment-widget" />
            <div id="toss-payment-agreement" className="toss-payment-widget" />
            <button className="btn toss-payment-submit" onClick={() => void requestPayment()} disabled={!ready || paying}>
              {paying ? "결제창 여는 중…" : `${price.toLocaleString()}원 결제하고 전문 보기`}
            </button>
          </>
        ) : (
          <p className="toss-payment-config-error" role="alert">
            결제 수단 설정이 아직 완료되지 않았어요. 관리자에게 문의해주세요.
          </p>
        )}

        {error && <p className="toss-payment-error" role="alert">{error}</p>}
        <button className="btn btn-ghost toss-payment-close" onClick={onClose}>닫기</button>
        <p className="toss-payment-note">
          {transferConfigured
            ? "입금 확인 요청을 누르면 승인 대기 화면에서 자동으로 확인해드려요."
            : PORTONE_TRANSFER_CONFIGURED
              ? "결제 완료는 포트원 서버 검증과 KG이니시스 웹훅으로 안전하게 확인해요."
              : "토스페이먼츠 결제창에서 카드·간편결제를 선택할 수 있어요."}
        </p>
      </div>
    </div>
  );
}
