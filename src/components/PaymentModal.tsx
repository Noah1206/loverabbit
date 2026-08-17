"use client";

// 계좌이체 결제 모달 — "토스로 이체하기"는 토스 앱 송금 딥링크로 은행·계좌·금액을 채워서 연다.
// 단품 리딩 결제에 사용하는 계좌이체 모달.

const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME ?? "";
const BANK_ACCOUNT = process.env.NEXT_PUBLIC_BANK_ACCOUNT ?? "";
const BANK_HOLDER = process.env.NEXT_PUBLIC_BANK_HOLDER ?? "";

export default function PaymentModal({
  price,
  depositorCode,
  paying,
  doneLabel = "이체 완료했어요 → 리딩 열기",
  onDone,
  onClose,
}: {
  price: number;
  depositorCode: string;
  paying: boolean;
  doneLabel?: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const configured = BANK_NAME && BANK_ACCOUNT;
  const tossLink = `supertoss://send?bank=${encodeURIComponent(BANK_NAME)}&accountNo=${BANK_ACCOUNT.replace(/-/g, "")}&amount=${price}&origin=linkgen`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(8, 5, 14, 0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 4 }}>결제 — {price.toLocaleString()}원</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: 16 }}>
          계좌이체 후 아래 버튼을 눌러주세요.
        </p>

        {configured ? (
          <div className="card" style={{ background: "var(--bg-card2)", marginBottom: 14, padding: 16 }}>
            <p style={{ fontSize: "0.95rem" }}>
              <strong>{BANK_NAME}</strong> {BANK_ACCOUNT}
              {BANK_HOLDER && <span style={{ color: "var(--text-dim)" }}> (예금주 {BANK_HOLDER})</span>}
            </p>
            <p style={{ fontSize: "0.85rem", marginTop: 8 }}>
              입금코드 <strong style={{ color: "var(--gold)" }}>{depositorCode}</strong>
              <span style={{ color: "var(--text-dim)" }}> — 이체 메모(받는 분 통장 표시)에 꼭 적어주세요</span>
            </p>
          </div>
        ) : (
          <p style={{ color: "var(--accent)", fontSize: "0.85rem", marginBottom: 14 }}>
            ⚙️ 계좌 미설정 — .env에 NEXT_PUBLIC_BANK_NAME / NEXT_PUBLIC_BANK_ACCOUNT / NEXT_PUBLIC_BANK_HOLDER를 넣고 다시 빌드하세요.
          </p>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          <a className="btn" style={{ textAlign: "center" }} href={tossLink}>
            토스로 이체하기 (계좌·금액 자동 입력)
          </a>
          <button
            className="btn btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(`${BANK_NAME} ${BANK_ACCOUNT} ${price}원 (메모: ${depositorCode})`);
              alert("계좌 정보가 복사됐어요!");
            }}
          >
            계좌번호 복사
          </button>
          <button className="btn" onClick={onDone} disabled={paying}>
            {paying ? "확인 중…" : doneLabel}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>닫기</button>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 12 }}>
          토스 버튼은 토스 앱이 설치된 휴대폰에서 열립니다. PC라면 계좌번호를 복사해 이체해주세요.
        </p>
      </div>
    </div>
  );
}
