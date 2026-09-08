-- 타로 뽑기에 러빗 1개를 물린다.
--
-- 원장 reason 에 'tarot' 을 더한다. 차감은 서버 라우트가
-- lr_credit_apply(-1, 'tarot', '<user>:<뽑기id>') 로 하고,
-- (reason, ref) unique 가 같은 뽑기의 이중 청구를 막는다.
--
-- 왜 뽑기마다 물리는가. 사주 리딩은 명식이 안 바뀌어 한 번 사면 끝인데,
-- 타로는 뽑을 때마다 다른 결과라 매번이 새 상품이다. 그래서 리딩처럼
-- 상품 단위가 아니라 뽑기 단위로 센다.

alter table public.lr_credit_ledger
  drop constraint if exists lr_credit_ledger_reason_check;
alter table public.lr_credit_ledger
  add constraint lr_credit_ledger_reason_check check (reason in (
    'signup', 'referral_click', 'referral_signup', 'purchase', 'question',
    'reading', 'refund', 'admin', 'daily_action', 'tarot'
  ));
