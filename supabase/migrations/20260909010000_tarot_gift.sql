-- 사주를 사면 타로 한 번을 선물한다.
--
-- 원장 reason 에 'tarot_gift' 를 더한다. 지급은 결제가 실제로 완료되는
-- 순간에만(alreadyPaid=false) 서버가
-- lr_credit_apply(+1, 'tarot_gift', '<주문 결제번호>') 로 하고,
-- (reason, ref) unique 가 웹훅과 완료 화면이 겹쳐도 한 번만 주게 막는다.
--
-- 왜 쿠폰이 아니라 러빗인가. 타로 한 번 값이 1러빗이라 러빗 한 개가 곧
-- 타로 한 번이다. 쿠폰 종류를 새로 만들면 예약·만료·사용 처리가 따라붙는데,
-- 여기서는 그 전부가 이미 원장에 있다.
--
-- 선물이 타로에만 쓰이도록 묶지 않는다. 러빗은 단일 화폐이므로 받은 사람이
-- 다른 데 써도 손해가 아니다 — 어차피 우리가 주기로 한 만큼이다.

alter table public.lr_credit_ledger
  drop constraint if exists lr_credit_ledger_reason_check;
alter table public.lr_credit_ledger
  add constraint lr_credit_ledger_reason_check check (reason in (
    'signup', 'referral_click', 'referral_signup', 'purchase', 'question',
    'reading', 'refund', 'admin', 'daily_action', 'tarot', 'tarot_gift'
  ));
