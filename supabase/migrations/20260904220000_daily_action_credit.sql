-- 오늘의 액션 AI 개인화에 러빗 1개를 물린다.
--
-- 원장 reason 에 'daily_action' 을 더한다. 차감은 서버 라우트가
-- lr_credit_apply(-1, 'daily_action', '<user>:<날짜>:<흐름:영역>') 로 하고,
-- (reason, ref) unique 가 같은 조합의 이중 청구를 막는다.

alter table public.lr_credit_ledger
  drop constraint if exists lr_credit_ledger_reason_check;
alter table public.lr_credit_ledger
  add constraint lr_credit_ledger_reason_check check (reason in (
    'signup', 'referral_click', 'referral_signup', 'purchase', 'question',
    'reading', 'refund', 'admin', 'daily_action'
  ));
