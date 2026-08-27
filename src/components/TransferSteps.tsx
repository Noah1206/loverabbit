"use client";

import { useState } from "react";

import TransferAccounts from "@/components/TransferAccounts";

/*
  계좌이체 두 단계 — 리딩 결제와 대화권 결제가 같은 것을 쓴다.

    1. 이체     토스 버튼이나 계좌 복사를 눌러야 다음 버튼이 켜진다.
               이체를 시작조차 안 한 사람이 "입금을 마쳤어요"를 누르는 것을 막는다.
    2. 마쳤어요  한 번 더 묻고 요청을 보낸다. 캡처는 요구하지 않는다 —
               통장에 없으면 운영자가 거절하면 그만이고, 사진은 승인 대기 화면에서
               원하는 사람만 올린다 (2026-08-27 저녁, 필수였던 것을 다시 풂).

  요청(주문 생성)은 부르는 쪽이 한다. 여기는 화면과 순서만 안다.
*/

export default function TransferSteps({
  amount,
  submitting,
  onSubmit,
}: {
  amount: number;
  submitting: boolean;
  /** 요청을 보낸다. 주문 생성 → 대기 화면은 부르는 쪽 몫. */
  onSubmit: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <TransferAccounts amount={amount} onStarted={() => setStarted(true)} />

      {confirming ? (
        <div className="transfer-pay-check" role="alert">
          <p>
            <strong>정말 이체를 완료하셨나요?</strong>
            <br />
            아직 보내지 않았다면 먼저 보내주세요. 입금이 확인되지 않은 요청은 열리지 않아요.
          </p>
          <div className="transfer-pay-check-actions">
            <button
              type="button"
              className="transfer-pay-check-no"
              onClick={() => setConfirming(false)}
              disabled={submitting}
            >
              아직이에요
            </button>
            <button type="button" className="transfer-pay-confirm" onClick={onSubmit} disabled={submitting}>
              {submitting ? "확인 요청 보내는 중…" : "네, 보냈어요"}
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="transfer-pay-confirm"
            onClick={() => setConfirming(true)}
            disabled={!started || submitting}
          >
            입금을 마쳤어요
            <span aria-hidden>→</span>
          </button>
          {!started && <p className="transfer-pay-hint">먼저 위 버튼으로 이체하거나 계좌번호를 복사해주세요.</p>}
        </>
      )}
    </>
  );
}
