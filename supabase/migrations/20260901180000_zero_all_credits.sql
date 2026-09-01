-- 남아 있는 러빗을 전부 0 으로 내린다 (2026-09-01 운영자 결정).
--
-- 왜 지워도 되는가. 이 시점의 잔액은 전부 **가입 선물**이다 — 167명이
-- 똑같이 15러빗씩 갖고 있고, 원장에는 signup 기록 167건 말고는 없다.
-- purchase 0건, reading 0건. 돈을 낸 사람도, 그 러빗으로 사주를 연 사람도
-- 아직 없다. 무료 크레딧은 2026-08-30 에 이미 걷었고(no_free_credits),
-- 그때 이미 나가 있던 잔액만 여기 남아 있던 셈이다.
--
-- 이미 발행된 사주는 그대로 열린다 — 해금은 lr_readings 에 기록되지
-- 잔액으로 다시 사지 않는다.
--
-- 왜 update 한 줄로 밀지 않는가. 잔액의 정본은 원장이다. 컬럼만 0 으로
-- 밀면 원장의 합(15)과 잔액(0)이 어긋나, 다음에 "이 사람 러빗이 왜
-- 이런가"를 물을 때 답할 근거가 사라진다. lr_credit_apply 를 거쳐 음수
-- 차감을 한 건 넣으면 잔액도 0 이 되고 왜 0 인지도 남는다.
--
-- reason 은 'admin' — 운영자 조정이다 (src/lib/credits.ts 의 CREDIT_REASON_LABEL
-- 이 "운영자 조정"으로 읽는다).
--
-- ref 에 회원 id 를 붙인다. lr_credit_apply 의 중복 방지는 reason+ref 를
-- **전역으로** 본다 — 167명이 같은 ref 를 쓰면 첫 사람만 깎이고 나머지는
-- "이미 처리됨"으로 조용히 지나간다. id 를 붙여야 사람마다 한 번씩,
-- 그리고 두 번 돌려도 두 번 깎이지 않는다.

do $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select id, chat_credits from public.lr_users
    where chat_credits > 0
    order by id
  loop
    perform public.lr_credit_apply(
      r.id,
      -r.chat_credits,
      'admin',
      'zero-all-20260901:' || r.id
    );
    v_count := v_count + 1;
  end loop;
  raise notice '러빗을 0 으로 내린 회원: %명', v_count;
end;
$$;
