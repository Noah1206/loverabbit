-- 리딩을 실제로 열어봤는가.
--
-- 지금까지 남는 것은 "만들었다"와 "결제됐다" 둘뿐이었다. 그 사이에 있는 질문 —
-- 돈을 낸 사람이 물건을 받아 갔는가 — 에 답할 자료가 없었다. 계좌이체는 승인이
-- 몇 시간 뒤에 나므로 본문 완성 시점에 사용자는 화면 앞에 없다. 다시 들어와야
-- 읽는 구조인데, 그 재방문이 어디에도 안 남았다.
--
-- 무료 열람과 유료 열람을 따로 센다. 전문이 나가는 길은 /api/unlock 하나뿐이라
-- (my-readings 는 티저까지만 준다) 두 숫자가 섞이지 않는다.

alter table public.lr_readings
  add column if not exists first_viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists view_count integer not null default 0,
  -- 전문을 처음/마지막으로 받아 간 시각. 유료 배송 확인용.
  add column if not exists first_paid_view_at timestamptz,
  add column if not exists last_paid_view_at timestamptz,
  add column if not exists paid_view_count integer not null default 0;

-- 열람을 세는 일이 열람을 막으면 안 된다. 원자적으로 하나 올리고 끝낸다.
-- updated_at 은 건드리지 않는다 — 그 칼럼은 "본문이 언제 바뀌었나"의 뜻이고,
-- 읽었다고 본문이 바뀐 것은 아니다.
create or replace function public.lr_mark_reading_viewed(
  p_reading_id uuid,
  p_paid boolean default false
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.lr_readings
     set first_viewed_at = coalesce(first_viewed_at, now()),
         last_viewed_at = now(),
         view_count = view_count + 1,
         first_paid_view_at =
           case when p_paid then coalesce(first_paid_view_at, now()) else first_paid_view_at end,
         last_paid_view_at = case when p_paid then now() else last_paid_view_at end,
         paid_view_count = paid_view_count + case when p_paid then 1 else 0 end
   where id = p_reading_id;
$$;

revoke all on function public.lr_mark_reading_viewed(uuid, boolean) from public, anon, authenticated;
grant execute on function public.lr_mark_reading_viewed(uuid, boolean) to service_role;

-- "만들어졌지만 아무도 안 연" 리딩을 훑는 자리.
create index if not exists lr_readings_last_viewed_at_idx
  on public.lr_readings (last_viewed_at);
