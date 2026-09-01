-- 회원 탈퇴 (2026-09-02).
--
-- 개인정보처리방침이 이미 답을 적어 두었다: "회원 탈퇴 시 계정 정보와 리딩
-- 결과를 지체 없이 파기합니다. 다만 전자상거래법 등 관계 법령이 정한 거래
-- 기록은 해당 기간 동안 보관합니다."
--
-- 그래서 **행을 지우지 않고 개인정보만 지운다.** 세 가지 이유다.
--
--   1. 거래 기록은 남겨야 한다. 전자상거래법 제6조는 대금 결제 기록을 5년
--      보관하도록 한다 — 탈퇴했다고 지우면 그쪽을 어긴다.
--   2. lr_orders.user_id 가 on delete restrict 라, 결제한 적 있는 회원은
--      행 삭제 자체가 실패한다. 제약을 cascade 로 바꾸면 1번을 어긴다.
--   3. 원장(lr_credit_ledger)도 지우면 "왜 3장이 사라졌나"에 답할 수 없다.
--
-- 지우는 것과 남기는 것을 여기 한 곳에 적어 둔다. 나중에 컬럼이 늘면 이
-- 함수도 같이 고쳐야 한다 — 안 고치면 지워야 할 것이 조용히 남는다.

create or replace function public.lr_delete_account(p_user_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email text;
  v_readings integer := 0;
begin
  select email into v_email from public.lr_users where id = p_user_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'USER_NOT_FOUND';
  end if;
  -- 이미 지운 계정이면 조용히 지나간다 (같은 요청이 두 번 와도 안전하다).
  if v_email like 'deleted+%' then
    return jsonb_build_object('alreadyDeleted', true);
  end if;

  /*
    리딩 — 본문과 명식을 지운다.

    글에는 그 사람의 생년월일로 세운 해석이 들어 있고, chart 에는 명식이
    그대로 있다. 행은 남긴다(주문이 reading_id 로 가리킨다) — 대신 안을 비운다.
  */
  update public.lr_readings
  set full_text = '',
      teaser = '',
      chart = '{}'::jsonb,
      score_label = null
  where user_id = p_user_id;
  get diagnostics v_readings = row_count;

  -- 사주 프로필 — 생년월일·시각·성별. 다시 만들 이유가 없다.
  delete from public.lr_user_profiles where user_id = p_user_id;

  -- 질문과 답, 신당 대화 — 본인이 쓴 글이라 통째로 지운다.
  delete from public.lr_questions where user_id = p_user_id;
  delete from public.lr_shrine_messages where user_id = p_user_id;

  -- 문의 — 본문에 사연이 들어 있다. 답변이 끝난 기록이라 지운다.
  delete from public.lr_inquiries where user_id = p_user_id;

  -- 카카오 토큰 — 남겨 두면 탈퇴 후에도 말을 걸 수 있다.
  -- 이 표는 lr_users.id 가 아니라 auth_user_id 로 물려 있다.
  delete from public.lr_kakao_tokens
  where auth_user_id in (select auth_user_id from public.lr_users where id = p_user_id and auth_user_id is not null);

  -- 웹툰 문장 캐시 — 명식으로 쓴 글이다.
  delete from public.lr_webtoon_contents
  where reading_id in (select id from public.lr_readings where user_id = p_user_id);

  -- 귀인지도 — 참여자의 생년월일이 들어 있다. 내가 만든 지도는 통째로 간다
  -- (cascade 로 참여자·관계도 함께). 남의 지도에 참여한 기록도 지운다.
  delete from public.lr_guin_maps where owner_user_id = p_user_id;
  delete from public.lr_guin_participants where participant_user_id = p_user_id;

  /*
    계정 — 이메일을 지운다. 다만 행은 남는다(주문이 가리킨다).

    unique 제약이 있으므로 빈 문자열로 두면 두 번째 탈퇴에서 충돌한다.
    id 를 섞어 유일하게 만들되, 사람을 식별할 수 없는 값으로 바꾼다.
    lr_users_email_normalized 제약(소문자·공백 없음)도 지켜야 한다.
  */
  update public.lr_users
  set email = 'deleted+' || p_user_id || '@deleted.invalid',
      birthdate = '1900-01-01',
      marketing_consent = false,
      referral_code = null,
      -- 소셜 계정 연결을 끊는다. 같은 계정으로 다시 로그인하면 새 회원이 된다.
      auth_user_id = null,
      auth_provider = null,
      -- 남은 러빗은 환불 대상이 아니다(약관 5조) — 다시 못 쓰게 0 으로 내린다.
      chat_credits = 0,
      updated_at = now()
  where id = p_user_id;

  /*
    남기는 것 — 지우지 않는다는 사실을 코드에 적어 둔다.

      lr_orders          전자상거래법상 거래 기록 (5년)
      lr_credit_ledger   러빗 증감의 정본. 정산 근거라 남는다
      lr_reviews         후기는 계정과 분리된 글이다 (닉네임만 남는다)
      lr_ai_usage        비용 집계. 사람을 가리키지 않는다

    이 목록이 방침의 "관계 법령이 정한 거래 기록" 과 같아야 한다.
  */
  return jsonb_build_object('deleted', true, 'readingsCleared', v_readings);
end;
$$;

revoke all on function public.lr_delete_account(bigint) from public, anon, authenticated;
grant execute on function public.lr_delete_account(bigint) to service_role;

comment on function public.lr_delete_account(bigint) is
  'Erases personal data for one member but keeps the row and transaction records (e-commerce law). Idempotent: a second call returns alreadyDeleted.';
