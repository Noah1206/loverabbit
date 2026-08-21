-- 리딩 삽화 — 장마다 한 장.
--
-- 그림 파일은 여기 넣지 않는다. 한 장이 1MB를 넘어서 다섯 장이면 6MB가 되고,
-- 그건 행에 담을 크기가 아니다. 파일은 Storage 버킷(reading-images)에 두고
-- 여기에는 "어느 장이 어디까지 됐나"만 둔다.
--
-- 한 리딩에 한 행이다. 장마다 행을 나누지 않는 이유는, 화면이 언제나
-- "전부 어디까지 됐나"를 한 번에 묻기 때문이다. 나누면 폴링마다 조인이 붙는다.
--
-- images 는 이런 모양이다:
--   [{"chapter":1,"status":"ready","url":"https://.../1.png","alt":"새벽 정류장"},
--    {"chapter":2,"status":"pending"}]
--
-- 그림은 리딩의 덤이다. 이 테이블이 통째로 비어 있어도 리딩은 온전히 읽힌다.

create table if not exists public.lr_reading_images (
  reading_id uuid primary key,
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.lr_reading_images_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lr_reading_images_touch on public.lr_reading_images;
create trigger lr_reading_images_touch
  before update on public.lr_reading_images
  for each row execute function public.lr_reading_images_touch();

-- 서버(서비스 키)만 읽고 쓴다. 그림 주소는 API 가 소유 확인을 거쳐 내려준다.
alter table public.lr_reading_images enable row level security;

comment on table public.lr_reading_images is
  '리딩 삽화의 진행 상태. 파일은 Storage 버킷 reading-images 에 있다.';
