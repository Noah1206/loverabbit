"use client";

import { useState } from "react";

/*
  계좌이체 안내 — 카카오뱅크 한 줄.

  결제창(PaymentModal)과 입금 안내가 같은 것을 그린다. 두 곳이 따로 그리면
  계좌를 바꿀 때 한쪽만 바뀐다.

  받는 계좌는 카카오뱅크 하나다 (2026-08-27 — 토스뱅크를 잠깐 넣었다가 뺌).
  카카오뱅크는 송금 딥링크를 공개하지 않아서 버튼은 앱만 열고, 누르는 순간
  계좌번호를 클립보드에 실어 둔다. 오른쪽 칩은 번호를 직접 복사하는 길.

  계좌는 NEXT_PUBLIC_BANK_* 환경변수에서 온다 (운영에 들어 있다). 없으면 기본값.
*/

export interface BankAccount {
  bank: string;
  account: string;
  holder: string;
}

function fromEnv(bank?: string, account?: string, holder?: string): BankAccount | null {
  const b = bank?.trim() ?? "";
  const a = account?.trim() ?? "";
  if (!b || !a) return null;
  return { bank: b, account: a, holder: holder?.trim() ?? "" };
}

// NEXT_PUBLIC_ 값은 빌드 때 글자 그대로 박히므로 process.env 를 통째로 넘길 수 없다.
export const KAKAOBANK_ACCOUNT: BankAccount =
  fromEnv(
    process.env.NEXT_PUBLIC_BANK_NAME,
    process.env.NEXT_PUBLIC_BANK_ACCOUNT,
    process.env.NEXT_PUBLIC_BANK_HOLDER
  ) ?? { bank: "카카오뱅크", account: "3333362382600", holder: "러브레빗" };

export const TRANSFER_ACCOUNTS: BankAccount[] = [KAKAOBANK_ACCOUNT];

const KAKAOBANK_LINK = "kakaobank://";

/** 토스 앱 송금창. 받는 은행이 카카오뱅크여도 계좌·금액을 채워서 연다. */
function tossSendLink(item: BankAccount, amount: number) {
  return `supertoss://send?bank=${encodeURIComponent(item.bank)}&accountNo=${item.account.replace(/-/g, "")}&amount=${amount}&origin=linkgen`;
}

function CopyChip({ item, onCopy }: { item: BankAccount; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`transfer-pay-copychip${copied ? " on" : ""}`}
      aria-label={`${item.bank} 계좌번호 복사`}
      onClick={() => {
        void navigator.clipboard.writeText(item.account).catch(() => {});
        onCopy?.();
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      <span className="transfer-pay-copychip-no">{item.account}</span>
      <span className="transfer-pay-copychip-act">{copied ? "복사됨" : "복사"}</span>
    </button>
  );
}

/**
 * 은행 한 줄: 왼쪽은 앱을 여는 버튼(로고·이름·예금주), 오른쪽은 계좌번호 복사 칩.
 * 칩은 앱 없이 직접 옮겨 적는 사람의 길이다.
 */
export default function TransferAccounts({
  amount,
  onStarted,
}: {
  amount: number;
  /** 버튼이나 복사를 눌렀다 — 이체를 시작했다는 신호. 다음 버튼이 이걸 기다린다. */
  onStarted?: () => void;
}) {
  const item = KAKAOBANK_ACCOUNT;
  return (
    <div className="transfer-pay-apps">
      {/* 두 줄 다 같은 카카오뱅크 계좌로 보낸다. 토스 줄은 토스 앱을 쓰는 사람의 길 —
          토스는 계좌·금액까지 채운 송금창을 열어 준다. */}
      <div className="transfer-pay-bank kakaobank">
        <a
          className="transfer-pay-app"
          href={KAKAOBANK_LINK}
          onClick={() => {
            void navigator.clipboard.writeText(item.account).catch(() => {});
            onStarted?.();
          }}
        >
          <img src="/pay/kakaobank.png" alt="kakaobank" className="transfer-pay-logo" draggable={false} />
          <span className="transfer-pay-label">
            원클릭 카카오뱅크 이체
            {item.holder && <small>예금주 {item.holder}</small>}
          </span>
        </a>
        <CopyChip item={item} onCopy={onStarted} />
      </div>
      <div className="transfer-pay-bank toss">
        <a className="transfer-pay-app" href={tossSendLink(item, amount)} onClick={onStarted}>
          <img src="/pay/toss.png" alt="toss" className="transfer-pay-logo" draggable={false} />
          <span className="transfer-pay-label">
            원클릭 토스로 이체
            <small>같은 카카오뱅크 계좌로 보내요</small>
          </span>
        </a>
        <CopyChip item={item} onCopy={onStarted} />
      </div>
    </div>
  );
}
