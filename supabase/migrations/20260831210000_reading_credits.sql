-- 리딩도 크레딧으로 연다 (2026-08-31 운영자 결정).
--
-- "크레딧은 질문 전용" 결정(20260830090000)을 뒤집는다. 크레딧이 서비스의
-- 단일 화폐가 된다 — 리딩 99크레딧, 질문 5크레딧. 원화는 크레딧을 살 때만
-- 쓴다.
--
-- 원장 사유에 'reading' 이 추가된다. (reason, ref) unique 가 이미 있으므로
-- 같은 리딩의 이중 차감은 원장 자체가 막는다 — ref 에 readingId 가 실린다.

alter table public.lr_credit_ledger
  drop constraint if exists lr_credit_ledger_reason_check;
alter table public.lr_credit_ledger
  add constraint lr_credit_ledger_reason_check check (reason in (
    'signup', 'referral_click', 'purchase', 'question', 'refund', 'admin',
    'reading'
  ));
