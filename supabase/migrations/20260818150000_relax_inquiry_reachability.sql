-- 회원 문의는 email 없이 user_id만 남는다. 그런데 lr_inquiries.user_id 는
-- on delete set null 이라, 회원을 지우면 user_id 가 null 이 되면서
-- lr_inquiries_reachable(user_id is not null or email is not null) 제약을 깨고
-- 회원 삭제 자체가 23514 로 실패한다.
--
-- 답장받을 곳이 있는지는 접수 API(/api/inquiry)에서 이미 막고 있으므로
-- DB 제약은 걷어내고, 회원이 사라진 뒤에도 문의 기록은 남게 둔다.

alter table public.lr_inquiries
  drop constraint if exists lr_inquiries_reachable;
