-- 캐릭터챗 무료 대화 횟수를 서버가 센다.
-- 지금까지는 브라우저가 보낸 대화 기록으로만 셌기 때문에, 기록을 지우면 무료 5번이 다시 살아났다.

alter table public.lr_users
  add column if not exists chat_free_turns_used integer not null default 0
    check (chat_free_turns_used >= 0);

comment on column public.lr_users.chat_free_turns_used is
  'Character-chat turns the user has spent from the free allowance (server-authoritative).';
