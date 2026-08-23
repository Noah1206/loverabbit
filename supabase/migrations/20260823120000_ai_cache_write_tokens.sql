-- GPT-5.6+는 캐시 읽기뿐 아니라 캐시 쓰기도 별도 단가로 청구한다.
-- 원가를 다시 계산할 수 있도록 공급사가 돌려준 쓰기 토큰을 함께 남긴다.

alter table public.lr_ai_usage
  add column if not exists cache_write_tokens integer not null default 0
  check (cache_write_tokens >= 0);
