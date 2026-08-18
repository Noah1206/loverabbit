"use client";

import { useEffect, useState } from "react";
import type { TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";

import { chatDepositorCode, type ChatProduct } from "@/lib/chat-products";

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

export default function ChatPaymentModal({
  product,
  characterId,
  userToken,
  customerEmail,
  onTransferSubmitted,
  onClose,
}: {
  product: ChatProduct;
  characterId: string;
  userToken: string;
  customerEmail: string;
  onTransferSubmitted: (orderId: number) => void;
  onClose: () => void;
}) {
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const depositorCode = chatDepositorCode(userToken);
  const transferConfigured = Boolean(BANK_NAME && BANK_ACCOUNT);
  const tossLink = `supertoss://send?bank=${encodeURIComponent(BANK_NAME)}&accountNo=${BANK_ACCOUNT.replace(/-/g, "")}&amount=${product.price}&origin=linkgen`;

  useEffect(() => {
    if (!TOSS_CLIENT_KEY) return;
    let active = true;
    const setup = async () => {
      try {
        const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
        const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
        const nextWidgets = tossPayments.widgets({ customerKey: getCustomerKey() });
        await nextWidgets.setAmount({ currency: "KRW", value: product.price });
        await Promise.all([
          nextWidgets.renderPaymentMethods({ selector: "#chat-toss-payment-methods", variantKey: "DEFAULT" }),
          nextWidgets.renderAgreement({ selector: "#chat-toss-payment-agreement", variantKey: "AGREEMENT" }),
        ]);
        if (active) {
          setWidgets(nextWidgets);
          setReady(true);
        }
      } catch (reason) {
        console.error("캐릭터챗 결제창 초기화 실패:", reason);
        if (active) setError("결제창을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    };
    void setup();
    return () => {
      active = false;
    };
  }, [product.price]);

  const requestPayment = async () => {
    if (!widgets) return;
    setPaying(true);
    setError("");
    try {
      const response = await fetch("/api/chat-payment/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, userToken }),
      });
      const checkout = (await response.json().catch(() => ({}))) as {
        orderId?: string;
        amount?: number;
        orderName?: string;
        error?: string;
      };
      if (!response.ok || !checkout.orderId || checkout.amount !== product.price) {
        throw new Error(checkout.error ?? "대화권 주문을 만들지 못했어요.");
      }

      await widgets.setAmount({ currency: "KRW", value: checkout.amount });
      const characterParam = encodeURIComponent(characterId);
      const productParam = encodeURIComponent(product.id);
      await widgets.requestPayment({
        orderId: checkout.orderId,
        orderName: checkout.orderName ?? product.name,
        customerEmail,
        successUrl: `${window.location.origin}/payment/chat-success?characterId=${characterParam}&productId=${productParam}`,
        failUrl: `${window.location.origin}/payment/chat-fail?characterId=${characterParam}`,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "결제를 시작하지 못했어요.");
      setPaying(false);
    }
  };

  const submitTransfer = async () => {
    setPaying(true);
    setError("");
    try {
      const response = await fetch("/api/chat-payment/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          userToken,
          depositorCode,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        orderId?: number;
        error?: string;
      };
      if (!response.ok || !Number.isSafeInteger(Number(data.orderId))) {
        throw new Error(data.error ?? "입금 확인 요청을 저장하지 못했어요.");
      }
      const orderId = Number(data.orderId);
      setSubmittedOrderId(orderId);
      onTransferSubmitted(orderId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "입금 확인 요청을 저장하지 못했어요.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="app-modal-layer" role="dialog" aria-modal="true" aria-labelledby="chat-payment-title" onClick={onClose}>
      <div className="card toss-payment-modal" onClick={(event) => event.stopPropagation()}>
        <span className="badge">대화 이어가기</span>
        <h3 id="chat-payment-title">캐릭터챗 대화권 {product.credits}회</h3>
        <p className="toss-payment-price">{product.price.toLocaleString()}원</p>
        <p className="toss-payment-intro">결제가 승인되면 지금 대화하던 캐릭터에게 바로 이어서 말할 수 있어요.</p>

        {submittedOrderId ? (
          <div className="transfer-payment-fallback">
            <p className="toss-payment-config-error">입금 확인 요청이 접수됐어요. 관리자가 실제 입금을 확인하면 대화권이 지급됩니다.</p>
            <p className="payment-order-reference">주문번호 #{submittedOrderId}</p>
          </div>
        ) : TOSS_CLIENT_KEY ? (
          <>
            <div id="chat-toss-payment-methods" className="toss-payment-widget" />
            <div id="chat-toss-payment-agreement" className="toss-payment-widget" />
            <button className="btn toss-payment-submit" onClick={() => void requestPayment()} disabled={!ready || paying}>
              {paying ? "결제창 여는 중…" : `${product.price.toLocaleString()}원 결제하기`}
            </button>
          </>
        ) : transferConfigured ? (
          <div className="transfer-payment-fallback">
            <p className="toss-payment-config-error">계좌이체는 관리자가 실제 입금을 확인한 뒤 대화권이 지급됩니다.</p>
            <div className="card transfer-payment-account">
              <p><strong>{BANK_NAME}</strong> {BANK_ACCOUNT}</p>
              {BANK_HOLDER && <p>예금주 {BANK_HOLDER}</p>}
              <p>입금 메모 <strong>{depositorCode}</strong></p>
            </div>
            <a className="btn toss-payment-submit" href={tossLink}>토스로 이체하기</a>
            <button
              className="btn btn-ghost toss-payment-submit"
              onClick={() => void navigator.clipboard.writeText(`${BANK_NAME} ${BANK_ACCOUNT} ${product.price}원 (메모: ${depositorCode})`)}
            >
              계좌정보 복사
            </button>
            <button className="btn toss-payment-submit" onClick={() => void submitTransfer()} disabled={paying}>
              {paying ? "승인 요청 중…" : "이체했어요 · 입금 확인 요청"}
            </button>
          </div>
        ) : (
          <p className="toss-payment-config-error" role="alert">결제 수단 설정이 아직 완료되지 않았어요.</p>
        )}

        {error && <p className="toss-payment-error" role="alert">{error}</p>}
        <button className="btn btn-ghost toss-payment-close" onClick={onClose}>닫기</button>
        <p className="toss-payment-note">대화권은 질문을 보낼 때마다 1회씩 사용됩니다.</p>
      </div>
    </div>
  );
}
