"use client";

import { useEffect, useState } from "react";
import type { TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";

import PortOneTransferForm, {
  PORTONE_TRANSFER_CONFIGURED,
} from "@/components/PortOneTransferForm";
import { chatDepositorCode, type ChatProduct } from "@/lib/chat-products";
import { METHOD_LABEL, PAYMENT_METHOD_OPEN, type PayMethod } from "@/lib/pay-method";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY?.trim() ?? "";
const KAKAOBANK_LINK = "kakaobank://";
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
  // 계좌번호 복사 피드백 - PaymentModal 과 같은 이유, 같은 모양
  const [copied, setCopied] = useState(false);
  const depositorCode = chatDepositorCode(userToken);
  const transferConfigured = Boolean(BANK_NAME && BANK_ACCOUNT);

  // 리딩 결제 모달과 같은 사다리, 같은 스위치. 두 화면이 다른 수단을 내보내면
  // 두 번째 결제에서 처음 보는 결제 방식을 또 배워야 한다.
  const methods: PayMethod[] = [];
  if (PORTONE_TRANSFER_CONFIGURED && PAYMENT_METHOD_OPEN.portone) methods.push("portone");
  if (transferConfigured && PAYMENT_METHOD_OPEN.manual) methods.push("manual");
  if (methods.length === 0 && TOSS_CLIENT_KEY && PAYMENT_METHOD_OPEN.toss) methods.push("toss");

  const [picked, setPicked] = useState<PayMethod | null>(null);
  const method = picked && methods.includes(picked) ? picked : methods[0] ?? null;
  const tossLink = `supertoss://send?bank=${encodeURIComponent(BANK_NAME)}&accountNo=${BANK_ACCOUNT.replace(/-/g, "")}&amount=${product.price}&origin=linkgen`;

  useEffect(() => {
    // 토스 위젯을 고르기 전에는 SDK 를 부르지 않는다 (PaymentModal 과 같은 이유)
    if (!TOSS_CLIENT_KEY || method !== "toss") return;
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
  }, [product.price, method]);

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

        {/* 입금 확인 요청을 이미 보냈으면 고를 것이 없다 — 그 화면만 남는다. */}
        {methods.length > 1 && !submittedOrderId && (
          <div className="pay-method-pick" role="group" aria-label="결제 수단 선택">
            {methods.map((option) => (
              <button
                key={option}
                type="button"
                className={method === option ? "on" : ""}
                aria-pressed={method === option}
                onClick={() => setPicked(option)}
              >
                <strong>{METHOD_LABEL[option].title}</strong>
                <span>{METHOD_LABEL[option].detail}</span>
              </button>
            ))}
          </div>
        )}

        {submittedOrderId ? (
          <div className="transfer-payment-fallback">
            <p className="toss-payment-config-error">입금 확인 요청이 접수됐어요. 관리자가 실제 입금을 확인하면 대화권이 지급됩니다.</p>
            <p className="payment-order-reference">주문번호 #{submittedOrderId}</p>
          </div>
        ) : method === "portone" ? (
          <PortOneTransferForm
            amount={product.price}
            customerEmail={customerEmail}
            checkoutEndpoint="/api/chat-payment/checkout"
            checkoutBody={{ productId: product.id, userToken }}
            redirectPath={`/payment/chat-success?characterId=${encodeURIComponent(characterId)}&productId=${encodeURIComponent(product.id)}`}
            buttonLabel={`${product.price.toLocaleString()}원 계좌이체하기`}
          />
        ) : method === "manual" ? (
          <div className="transfer-payment-fallback">
            {/* 리딩 결제 모달(PaymentModal)과 같은 구성. 두 화면이 다르게 생기면
                두 번째 결제에서 처음 보는 화면을 또 배워야 한다. */}
            <p className="toss-payment-config-error">계좌이체로 결제해요. 관리자가 실제 입금을 확인하면 대화권이 지급됩니다.</p>
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
            <button className="transfer-pay-confirm" onClick={() => void submitTransfer()} disabled={paying}>
              {paying ? "확인 요청 보내는 중…" : "입금을 마쳤어요"}
              <span aria-hidden>→</span>
            </button>
          </div>
        ) : method === "toss" ? (
          <>
            <div id="chat-toss-payment-methods" className="toss-payment-widget" />
            <div id="chat-toss-payment-agreement" className="toss-payment-widget" />
            <button className="btn toss-payment-submit" onClick={() => void requestPayment()} disabled={!ready || paying}>
              {paying ? "결제창 여는 중…" : `${product.price.toLocaleString()}원 결제하기`}
            </button>
          </>
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
