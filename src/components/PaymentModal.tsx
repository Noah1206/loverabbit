"use client";

import { useEffect, useState } from "react";
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
  const transferConfigured = Boolean(BANK_NAME && BANK_ACCOUNT && depositorCode && onTransferSubmitted);
  const tossLink = `supertoss://send?bank=${encodeURIComponent(BANK_NAME)}&accountNo=${BANK_ACCOUNT.replace(/-/g, "")}&amount=${price}&origin=linkgen`;

  useEffect(() => {
    if (!TOSS_CLIENT_KEY) return;
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

        {TOSS_CLIENT_KEY ? (
          <>
            <div id="toss-payment-methods" className="toss-payment-widget" />
            <div id="toss-payment-agreement" className="toss-payment-widget" />
            <button className="btn toss-payment-submit" onClick={() => void requestPayment()} disabled={!ready || paying}>
              {paying ? "결제창 여는 중…" : `${price.toLocaleString()}원 결제하고 전문 보기`}
            </button>
          </>
        ) : transferConfigured ? (
          <div className="transfer-payment-fallback">
            <p className="toss-payment-config-error">
              카드 결제는 준비 중이에요. 계좌이체는 관리자가 실제 입금을 확인한 뒤 전문이 열립니다.
            </p>
            <div className="card transfer-payment-account">
              <p><strong>{BANK_NAME}</strong> {BANK_ACCOUNT}</p>
              {BANK_HOLDER && <p>예금주 {BANK_HOLDER}</p>}
              <p>입금 메모 <strong>{depositorCode}</strong></p>
            </div>
            <a className="btn toss-payment-submit" href={tossLink}>토스로 이체하기</a>
            <button
              className="btn btn-ghost toss-payment-submit"
              onClick={() => {
                void navigator.clipboard.writeText(
                  `${BANK_NAME} ${BANK_ACCOUNT} ${price}원 (메모: ${depositorCode})`
                );
              }}
            >
              계좌정보 복사
            </button>
            <button
              className="btn toss-payment-submit"
              onClick={onTransferSubmitted}
              disabled={transferSubmitting}
            >
              {transferSubmitting ? "승인 요청 중…" : "이체했어요 · 입금 확인 요청"}
            </button>
          </div>
        ) : (
          <p className="toss-payment-config-error" role="alert">
            결제 수단 설정이 아직 완료되지 않았어요. 관리자에게 문의해주세요.
          </p>
        )}

        {error && <p className="toss-payment-error" role="alert">{error}</p>}
        <button className="btn btn-ghost toss-payment-close" onClick={onClose}>닫기</button>
        <p className="toss-payment-note">토스페이먼츠 결제창에서 카드·간편결제를 선택할 수 있어요.</p>
      </div>
    </div>
  );
}
