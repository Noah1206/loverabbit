"use client";

import { useEffect, useState } from "react";
import PortOneTransferForm, {
  PORTONE_TRANSFER_CONFIGURED,
} from "@/components/PortOneTransferForm";
import {
  couponPrice,
  couponSaving,
  isCouponUsable,
  pickBestCoupon,
  COUPON_LABEL,
  type Coupon,
} from "@/lib/coupons";
import { METHOD_LABEL, PAYMENT_METHOD_OPEN, type PayMethod } from "@/lib/pay-method";
import TransferAccounts, { TRANSFER_ACCOUNTS } from "@/components/TransferAccounts";
import "@/app/coupons.css";

import type { TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY?.trim() ?? "";
const CUSTOMER_KEY_STORAGE = "loverabbit_toss_customer_key_v1";

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
  /** 계좌이체 확인 요청. 고른 쿠폰이 있으면 같이 넘긴다 - 서버가 금액을 다시 정한다. */
  onTransferSubmitted?: (couponId?: string) => void;
  onClose: () => void;
}) {
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  // 계좌번호 복사 버튼의 짧은 피드백 - 아이콘만 있는 버튼이라 눌렸는지 보여야 한다
  const [transferConfirming, setTransferConfirming] = useState(false);
  const transferConfigured = Boolean(TRANSFER_ACCOUNTS.length > 0 && depositorCode && onTransferSubmitted);

  /*
    쓸 수 있는 수단을 모으고, 둘 이상이면 고르게 한다.

    설정돼 있는 것과 지금 받을 수 있는 것은 다르다 — PAYMENT_METHOD_OPEN 이
    그 차이를 든다. 지금은 직접 송금 하나만 열려 있어 선택줄도 서지 않는다.

    토스 위젯은 마지막 수단이다. 승인 API 를 거치는 동안 새로고침이 겹치면
    결제한 사람이 실패 화면을 보는 레이스가 있고, 그건 이체에는 없는 문제다
    (2026-08-21 운영자 결정).
  */
  const methods: PayMethod[] = [];
  if (PORTONE_TRANSFER_CONFIGURED && PAYMENT_METHOD_OPEN.portone) methods.push("portone");
  if (transferConfigured && PAYMENT_METHOD_OPEN.manual) methods.push("manual");
  if (methods.length === 0 && TOSS_CLIENT_KEY && PAYMENT_METHOD_OPEN.toss) methods.push("toss");

  // 고른 값이 아직 없거나 더 이상 쓸 수 없는 수단이면 첫 번째로 되돌아간다.
  const [picked, setPicked] = useState<PayMethod | null>(null);
  const method = picked && methods.includes(picked) ? picked : methods[0] ?? null;

  // 쿠폰함. 열리면 쓸 수 있는 것 중 가장 큰 할인이 먼저 골라져 있다 - 쿠폰이
  // 있는 사람이 굳이 찾아 누르지 않아도 깎인 값을 본다. 금액은 서버가 다시 정한다.
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponId, setCouponId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken }),
    })
      .then((res) => (res.ok ? res.json() : { coupons: [] }))
      .then((data: { coupons?: Coupon[] }) => {
        if (!active) return;
        // 이 상품에서 한 푼도 못 깎는 쿠폰은 보여 주지 않는다. 고를 수 있게
        // 두면 0원어치로 태우고, 태운 사람은 그걸 나중에 안다.
        const list = (data.coupons ?? []).filter(
          (coupon) => isCouponUsable(coupon) && couponSaving(price, coupon) > 0
        );
        setCoupons(list);
        setCouponId(pickBestCoupon(list, price)?.id ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userToken, price]);
  const coupon = coupons.find((item) => item.id === couponId) ?? null;
  const payAmount = coupon ? couponPrice(price, coupon) : price;


  useEffect(() => {
    // 토스 위젯을 고르기 전에는 SDK 를 부르지 않는다 — 안 그리는 위젯을 위해
    // 스크립트만 내려받는 꼴이 된다.
    if (!TOSS_CLIENT_KEY || method !== "toss") return;
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
  }, [price, method]);

  const requestPayment = async () => {
    if (!widgets) return;
    setPaying(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingId, userToken, couponId: coupon?.id }),
      });
      const checkout = (await response.json().catch(() => ({}))) as {
        orderId?: string;
        amount?: number;
        orderName?: string;
        error?: string;
      };
      if (!response.ok || !checkout.orderId || checkout.amount !== payAmount) {
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
        <p className="toss-payment-price">{payAmount.toLocaleString()}원</p>
        {coupon && (
          <p className="toss-payment-list-price">
            정가 {price.toLocaleString()}원 · {couponSaving(price, coupon).toLocaleString()}원 할인
          </p>
        )}
        <p className="toss-payment-intro">결제가 승인된 뒤에만 결론과 전문이 열립니다.</p>

        {coupons.length > 0 && (
          <div className="coupon-pick" role="group" aria-label="쿠폰 선택">
            <div className="coupon-pick-title">
              <span>쿠폰</span>
              {coupon ? (
                <button type="button" onClick={() => setCouponId(null)}>쿠폰 안 쓰기</button>
              ) : (
                <button type="button" onClick={() => setCouponId(pickBestCoupon(coupons, price)?.id ?? null)}>
                  쿠폰 쓰기
                </button>
              )}
            </div>
            {coupons.map((item) => (
              <button
                key={item.id}
                type="button"
                className="coupon-card"
                aria-pressed={item.id === couponId}
                onClick={() => setCouponId(item.id === couponId ? null : item.id)}
              >
                <span className="coupon-amount">{couponSaving(price, item).toLocaleString()}원</span>
                <span className="coupon-copy">
                  <strong>{COUPON_LABEL[item.kind]}</strong>
                  <span>{new Date(item.expiresAt).toLocaleDateString("ko-KR")}까지</span>
                </span>
                <em className={`coupon-state${item.id === couponId ? " on" : ""}`}>
                  {item.id === couponId ? "적용됨" : "선택"}
                </em>
              </button>
            ))}
          </div>
        )}

        {/* 수단이 둘 이상일 때만 고르게 한다. 하나뿐인데 선택줄을 세우면
            고를 것이 없는 선택을 시키는 셈이다. */}
        {methods.length > 1 && (
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

        {method === "portone" ? (
          <PortOneTransferForm
            key={payAmount}
            amount={payAmount}
            customerEmail={customerEmail}
            checkoutEndpoint="/api/checkout"
            checkoutBody={{ readingId, userToken, couponId: coupon?.id }}
            redirectPath={`/payment/success?readingId=${encodeURIComponent(readingId)}`}
            buttonLabel={`${payAmount.toLocaleString()}원 계좌이체하고 전문 보기`}
          />
        ) : method === "manual" ? (
          <div className="transfer-payment-fallback">
            <p className="toss-payment-config-error">
              계좌이체로 결제해요. 관리자가 실제 입금을 확인하면 전문이 열립니다.
            </p>
            <TransferAccounts amount={payAmount} />
            {/* 두 번 묻는다. 버튼만 누르고 실제 이체는 안 한 요청이 너무 많았다 —
                그 요청은 텔레그램에 뜨고, 통장엔 아무것도 없고, 손님은 왜 안 열리냐고
                기다린다. 한 번 더 묻는 값이 그 기다림보다 싸다. */}
            {transferConfirming ? (
              <div className="transfer-pay-check" role="alert">
                <p>
                  <strong>정말 이체를 완료하셨나요?</strong>
                  <br />
                  아직 보내지 않았다면 먼저 보내주세요. 입금이 확인되지 않은 요청은 열리지 않아요.
                </p>
                <div className="transfer-pay-check-actions">
                  <button type="button" className="transfer-pay-check-no" onClick={() => setTransferConfirming(false)}>
                    아직이에요
                  </button>
                  <button
                    type="button"
                    className="transfer-pay-confirm"
                    onClick={() => onTransferSubmitted?.(coupon?.id)}
                    disabled={transferSubmitting}
                  >
                    {transferSubmitting ? "확인 요청 보내는 중…" : "네, 보냈어요"}
                    <span aria-hidden>→</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="transfer-pay-confirm"
                onClick={() => setTransferConfirming(true)}
                disabled={transferSubmitting}
              >
                입금을 마쳤어요
                <span aria-hidden>→</span>
              </button>
            )}
          </div>
        ) : method === "toss" ? (
          <>
            <div id="toss-payment-methods" className="toss-payment-widget" />
            <div id="toss-payment-agreement" className="toss-payment-widget" />
            <button className="btn toss-payment-submit" onClick={() => void requestPayment()} disabled={!ready || paying}>
              {paying ? "결제창 여는 중…" : `${payAmount.toLocaleString()}원 결제하고 전문 보기`}
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
          {/* 고른 수단을 그대로 따라간다. 분기 순서를 따로 적어 두면 다시 어긋난다 —
              한동안 이 자리가 어긋나 있어, 결제창을 거친 사람이 "관리자가 입금을
              확인해드려요" 를 읽었다.

              결제대행사 이름은 손님에게 적지 않는다. 알 필요가 없는 말이고,
              닫아 둔 수단의 이름이 번들에 남아 소스에서 읽히기도 한다. */}
          {method === "portone"
            ? "결제 완료는 서버에서 한 번 더 확인하니 안심하세요."
            : method === "manual"
              ? "입금 확인 요청을 누르면 승인 대기 화면에서 자동으로 확인해드려요."
              : "토스페이먼츠 결제창에서 카드·간편결제를 선택할 수 있어요."}
        </p>
      </div>
    </div>
  );
}
