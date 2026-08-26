-- 한 리딩을 두 곳에서 동시에 만들지 않게 하는 표식.
--
-- 승인하는 순간 서버가 글을 만들기 시작하도록 바꿨는데(관리자 승인 라우트),
-- 승인 대기 화면은 3초마다 상태를 묻고 paid 가 뜨는 즉시 /api/unlock 을 부른다.
-- 그래서 돈을 낸 사람이 그 화면을 보고 있으면 두 곳이 같은 리딩을 동시에 만든다 —
-- 값은 두 배로 나가고, 나중에 끝난 쪽이 먼저 끝난 쪽을 덮는다.
--
-- 그래서 만들기 전에 이 칸을 원자적으로 집는다. 집은 쪽만 만들고, 못 집은 쪽은
-- "아직 준비 중" 으로 돌아간다 — 그 화면은 원래도 그 답을 받으면 다시 연다.
--
-- 10분이 지난 표식은 죽은 것으로 본다. 만들다 함수가 죽으면 표식만 남는데,
-- 놓아 주지 않으면 그 리딩은 영영 만들어지지 않는다.

alter table public.lr_reading_resume
  add column if not exists generating_at timestamptz;

create or replace function public.lr_claim_reading_generation(p_reading_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed text;
begin
  update public.lr_reading_resume
  set generating_at = now()
  where reading_id = p_reading_id
    and (generating_at is null or generating_at < now() - interval '10 minutes')
  returning reading_id into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke all on function public.lr_claim_reading_generation(text) from public, anon, authenticated;
grant execute on function public.lr_claim_reading_generation(text) to service_role;

comment on function public.lr_claim_reading_generation(text) is
  'Atomically claims the right to generate a reading body, so approval and the buyer opening it do not both run the model.';
