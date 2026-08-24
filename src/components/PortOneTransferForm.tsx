"use client";

import { useState, type FormEvent } from "react";

const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() ?? "";
const CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim() ?? "";

export const PORTONE_TRANSFER_CONFIGURED = Boolean(STORE_ID && CHANNEL_KEY);

interface CheckoutResponse {
  paymentId?: string;
  amount?: number;
  orderName?: string;
  provider?: string;
  error?: string;
}

export default function PortOneTransferForm({
  amount,
  customerEmail,
  checkoutEndpoint,
  checkoutBody,
  redirectPath,
  buttonLabel,
}: {
  amount: number;
  customerEmail: string;
  checkoutEndpoint: string;
  checkoutBody: Record<string, string>;
  redirectPath: string;
  buttonLabel: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(customerEmail);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const requestPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const customerName = name.trim();
    const phoneNumber = phone.replace(/[^0-9]/g, "");
    const customerEmailValue = email.trim();
    if (customerName.length < 2) {
      setError("입금자 이름을 두 글자 이상 입력해주세요.");
      return;
    }
    if (!/^0\d{8,10}$/.test(phoneNumber)) {
      setError("휴대전화 번호를 확인해주세요.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmailValue)) {
      setError("이메일 주소를 확인해주세요.");
      return;
    }

    setPaying(true);
    setError("");
    try {
      const response = await fetch(checkoutEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutBody),
      });
      const checkout = (await response.json().catch(() => ({}))) as CheckoutResponse;
      if (
        !response.ok ||
        checkout.provider !== "portone" ||
        !checkout.paymentId ||
        checkout.amount !== amount
      ) {
        throw new Error(checkout.error ?? "결제 주문을 만들지 못했어요.");
      }

      const PortOne = (await import("@portone/browser-sdk/v2")).default;
      const queryJoin = redirectPath.includes("?") ? "&" : "?";
      const redirectUrl = `${window.location.origin}${redirectPath}${queryJoin}provider=portone&amount=${amount}&paymentId=${encodeURIComponent(checkout.paymentId)}`;
      const payment = await PortOne.requestPayment({
        storeId: STORE_ID,
        channelKey: CHANNEL_KEY,
        paymentId: checkout.paymentId,
        orderName: checkout.orderName ?? "러브레빗 결제",
        totalAmount: checkout.amount,
        currency: "KRW",
        payMethod: "TRANSFER",
        customer: {
          fullName: customerName,
          phoneNumber,
          email: customerEmailValue,
        },
        redirectUrl,
        noticeUrls: [`${window.location.origin}/api/portone/webhook`],
        forceRedirect: true,
      });

      // forceRedirect는 결제창 진입 후 결과를 URL로 돌려준다. 진입 전에 실패한
      // 경우에만 이 Promise가 오류 응답으로 돌아올 수 있다.
      if (payment?.code) {
        throw new Error(payment.message ?? "결제를 완료하지 못했어요.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "결제를 시작하지 못했어요.");
      setPaying(false);
    }
  };

  return (
    <form className="portone-transfer-form" onSubmit={(event) => void requestPayment(event)}>
      <p className="toss-payment-config-error">
        KG이니시스 결제창에서 원하는 은행을 골라 바로 이체합니다.
      </p>
      <label>
        <span>입금자 이름</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={40}
          placeholder="홍길동"
          disabled={paying}
          required
        />
      </label>
      <label>
        <span>휴대전화 번호</span>
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
          inputMode="tel"
          maxLength={14}
          placeholder="01012345678"
          disabled={paying}
          required
        />
      </label>
      <label>
        <span>이메일</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          placeholder="name@example.com"
          disabled={paying}
          required
        />
      </label>
      <button className="btn toss-payment-submit" type="submit" disabled={paying}>
        {paying ? "KG이니시스 결제창 여는 중…" : buttonLabel}
      </button>
      {error && <p className="toss-payment-error" role="alert">{error}</p>}
    </form>
  );
}
