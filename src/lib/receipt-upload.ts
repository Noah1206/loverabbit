"use client";

/**
 * 이체 완료 화면 캡처를 주문에 붙인다 (/api/payment/receipt).
 *
 * 실패해도 던지지 않는다 — 주문은 이미 만들어졌고, 사진은 승인을 앞당기는
 * 것이지 조건이 아니다. 부르는 쪽은 결과에 따라 대기 화면 문구만 바꾼다.
 */
export async function uploadReceipt(orderId: number, userToken: string | undefined, file: File): Promise<boolean> {
  try {
    const form = new FormData();
    form.set("orderId", String(orderId));
    if (userToken) form.set("userToken", userToken);
    form.set("file", file);
    const res = await fetch("/api/payment/receipt", { method: "POST", body: form });
    return res.ok;
  } catch {
    return false;
  }
}
