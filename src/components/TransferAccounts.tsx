"use client";

import { useState } from "react";

/*
  계좌이체 안내 — 이체 앱 버튼 두 개와 받는 계좌 목록.

  리딩 결제(PaymentModal)와 대화권 결제(ChatPaymentModal)가 같은 것을 그린다.
  두 화면이 따로 그리면 계좌를 하나 더 붙일 때 한쪽만 바뀐다.

  계좌는 환경변수로 온다. 첫 계좌(NEXT_PUBLIC_BANK_*)는 원래 있던 카카오뱅크,
  둘째(NEXT_PUBLIC_BANK2_*)는 토스뱅크. 둘째가 비어 있으면 첫 계좌만 그린다.
  토스 버튼은 토스뱅크 계좌가 있으면 그쪽으로, 없으면 첫 계좌로 송금창을 연다 —
  같은 은행끼리는 이체가 즉시라 토스 사용자에게는 토스뱅크 계좌가 편하다.
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
export const PRIMARY_ACCOUNT = fromEnv(
  process.env.NEXT_PUBLIC_BANK_NAME,
  process.env.NEXT_PUBLIC_BANK_ACCOUNT,
  process.env.NEXT_PUBLIC_BANK_HOLDER
);
// 토스뱅크 계좌 (2026-08-27 운영자 추가). 환경변수가 있으면 그것이 이긴다.
// 계좌번호는 손님 화면에 그대로 찍히는 값이라 코드에 있어도 새는 것이 없다.
export const SECOND_ACCOUNT =
  fromEnv(
    process.env.NEXT_PUBLIC_BANK2_NAME,
    process.env.NEXT_PUBLIC_BANK2_ACCOUNT,
    process.env.NEXT_PUBLIC_BANK2_HOLDER
  ) ?? { bank: "토스뱅크", account: "1002-1047-8563", holder: "조현웅" };

export const TRANSFER_ACCOUNTS: BankAccount[] = [PRIMARY_ACCOUNT, SECOND_ACCOUNT].filter(
  (item): item is BankAccount => Boolean(item)
);

const KAKAOBANK_LINK = "kakaobank://";

function isTossBank(item: BankAccount) {
  return /토스/.test(item.bank);
}
function isKakaoBank(item: BankAccount) {
  return /카카오/.test(item.bank);
}

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
 * 은행 버튼 + 그 밑의 복사 칩.
 *
 * 버튼은 앱을 연다 — 토스는 계좌·금액까지 채운 송금창, 카카오뱅크는 딥링크가
 * 공개돼 있지 않아 앱만 열고 계좌번호를 클립보드에 실어 둔다. 칩은 앱 없이
 * 직접 옮겨 적는 사람의 길이다.
 */
function BankButton({
  item,
  href,
  brand,
  label,
  onClick,
}: {
  item: BankAccount;
  href: string;
  brand: "toss" | "kakaobank";
  label: string;
  onClick?: () => void;
}) {
  return (
    <div className="transfer-pay-bank">
      <a className={`transfer-pay-app ${brand}`} href={href} onClick={onClick}>
        <img
          src={brand === "toss" ? "/pay/toss.png" : "/pay/kakaobank.png"}
          alt={brand === "toss" ? "toss" : "kakaobank"}
          className="transfer-pay-logo"
          draggable={false}
        />
        <span>{label}</span>
      </a>
      <CopyChip item={item} />
      {item.holder && <small className="transfer-pay-holder">예금주 {item.holder}</small>}
    </div>
  );
}

export default function TransferAccounts({ amount }: { amount: number }) {
  if (TRANSFER_ACCOUNTS.length === 0) return null;
  const toss = TRANSFER_ACCOUNTS.find(isTossBank);
  const kakao = TRANSFER_ACCOUNTS.find(isKakaoBank);
  // 둘 중 하나만 있는 배포라도 버튼은 둘 다 그린다 — 손님의 은행 앱이 그 둘이다.
  const tossTarget = toss ?? TRANSFER_ACCOUNTS[0];
  const kakaoTarget = kakao ?? TRANSFER_ACCOUNTS[0];

  return (
    <>
      <div className="transfer-pay-apps">
        <BankButton
          item={tossTarget}
          brand="toss"
          href={tossSendLink(tossTarget, amount)}
          label={toss ? "토스뱅크로 이체" : "토스로 이체"}
        />
        <BankButton
          item={kakaoTarget}
          brand="kakaobank"
          href={KAKAOBANK_LINK}
          label="카카오뱅크로 이체"
          onClick={() => void navigator.clipboard.writeText(kakaoTarget.account).catch(() => {})}
        />
      </div>
      {toss && kakao && (
        <p className="transfer-pay-either">둘 중 편한 계좌로 보내면 돼요. 금액과 입금코드는 같아요.</p>
      )}
    </>
  );
}
