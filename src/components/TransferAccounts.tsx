"use client";

import { useState } from "react";

/*
  계좌이체 안내 — 토스뱅크 한 줄.

  리딩 결제(PaymentModal)와 대화권 결제(ChatPaymentModal)가 같은 것을 그린다.
  두 화면이 따로 그리면 계좌를 바꿀 때 한쪽만 바뀐다.

  받는 계좌는 토스뱅크 하나다 (2026-08-27 운영자 결정 — 카카오뱅크 뺌). 통장이
  둘이면 입금 대조를 두 군데서 해야 하고, 알림에는 어느 통장인지 안 찍힌다.
  토스 버튼은 토스 앱의 송금창을 계좌·금액까지 채워서 연다.

  환경변수 NEXT_PUBLIC_BANK2_* 가 있으면 그것이 이기고, 없으면 아래 기본값.
  계좌번호는 손님 화면에 그대로 찍히는 값이라 코드에 있어도 새는 것이 없다.
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
export const TOSS_ACCOUNT: BankAccount =
  fromEnv(
    process.env.NEXT_PUBLIC_BANK2_NAME,
    process.env.NEXT_PUBLIC_BANK2_ACCOUNT,
    process.env.NEXT_PUBLIC_BANK2_HOLDER
  ) ?? { bank: "토스뱅크", account: "1002-1047-8563", holder: "조현웅" };

export const TRANSFER_ACCOUNTS: BankAccount[] = [TOSS_ACCOUNT];

function tossSendLink(item: BankAccount, amount: number) {
  return `supertoss://send?bank=${encodeURIComponent(item.bank)}&accountNo=${item.account.replace(/-/g, "")}&amount=${amount}&origin=linkgen`;
}

function CopyChip({ item }: { item: BankAccount }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`transfer-pay-copychip${copied ? " on" : ""}`}
      aria-label={`${item.bank} 계좌번호 복사`}
      onClick={() => {
        void navigator.clipboard.writeText(item.account).catch(() => {});
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
export default function TransferAccounts({ amount }: { amount: number }) {
  const item = TOSS_ACCOUNT;
  return (
    <div className="transfer-pay-apps">
      <div className="transfer-pay-bank toss">
        <a className="transfer-pay-app" href={tossSendLink(item, amount)}>
          <img src="/pay/toss.png" alt="toss" className="transfer-pay-logo" draggable={false} />
          <span className="transfer-pay-label">
            원클릭 토스뱅크 이체
            {item.holder && <small>예금주 {item.holder}</small>}
          </span>
        </a>
        <CopyChip item={item} />
      </div>
    </div>
  );
}
