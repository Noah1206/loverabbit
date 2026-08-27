"use client";

import { useState } from "react";

import TransferAccounts from "@/components/TransferAccounts";

/*
  계좌이체 세 단계 — 리딩 결제와 대화권 결제가 같은 것을 쓴다.

    1. 이체     토스 버튼이나 계좌 복사를 눌러야 다음 버튼이 켜진다.
               이체를 시작조차 안 한 사람이 "입금을 마쳤어요"를 누르는 것을 막는다.
    2. 마쳤어요  누르면 3단계로 간다. 요청은 아직 안 나간다.
    3. 캡처     이체 완료 화면을 올려야 요청이 나간다. 건너뛰는 길은 없다 —
               버튼만 누르고 안 보낸 요청이 너무 많았고, 사진이 있으면 운영자가
               통장을 뒤지지 않고 그 자리에서 승인한다. 돈을 낸 사람에게는
               번거롭지만, 그 사람이 제일 빨리 열리는 길이기도 하다.

  요청(주문 생성 + 사진 전송)은 부르는 쪽이 한다 — 리딩은 /api/unlock, 대화권은
  /api/chat-payment/transfer 로 주문을 만들고, 둘 다 /api/payment/receipt 로 사진을
  보낸다. 여기는 화면과 순서만 안다.
*/

const MAX_BYTES = 5 * 1024 * 1024;

export default function TransferSteps({
  amount,
  submitting,
  onSubmit,
}: {
  amount: number;
  submitting: boolean;
  /** 사진과 함께 요청을 보낸다. 주문 생성 → 사진 전송 → 대기 화면은 부르는 쪽 몫. */
  onSubmit: (receipt: File) => void;
}) {
  const [started, setStarted] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [fileError, setFileError] = useState("");

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFileError("사진 파일만 올릴 수 있어요.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("사진이 너무 커요. 5MB 이하로 올려주세요.");
      return;
    }
    setFileError("");
    onSubmit(file);
  };

  return (
    <>
      <TransferAccounts amount={amount} onStarted={() => setStarted(true)} />

      {capturing ? (
        <div className="transfer-pay-check" role="alert">
          <p>
            <strong>이체 완료 화면을 올려주세요.</strong>
            <br />
            은행 앱의 이체 완료 화면을 캡처해서 올리면, 사진을 보고 바로 승인해드려요.
            사진이 있어야 요청이 접수됩니다.
          </p>
          <div className="transfer-pay-check-actions">
            <button
              type="button"
              className="transfer-pay-check-no"
              onClick={() => setCapturing(false)}
              disabled={submitting}
            >
              아직이에요
            </button>
            <label className={`transfer-pay-confirm${submitting ? " busy" : ""}`}>
              {submitting ? "요청 보내는 중…" : "📷 캡처 올리고 요청하기"}
              <input
                type="file"
                accept="image/*"
                disabled={submitting}
                onChange={(event) => {
                  pick(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {fileError && <p className="toss-payment-error" role="alert">{fileError}</p>}
        </div>
      ) : (
        <>
          <button
            type="button"
            className="transfer-pay-confirm"
            onClick={() => setCapturing(true)}
            disabled={!started || submitting}
          >
            입금을 마쳤어요
            <span aria-hidden>→</span>
          </button>
          {!started && <p className="transfer-pay-hint">먼저 위에서 이체하거나 계좌번호를 복사해주세요.</p>}
        </>
      )}
    </>
  );
}
