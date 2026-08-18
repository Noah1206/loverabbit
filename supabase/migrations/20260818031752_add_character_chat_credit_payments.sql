-- Paid character-chat credits share the server-owned order ledger with readings.
alter table public.lr_orders
  drop constraint if exists lr_orders_kind_check;

alter table public.lr_orders
  add constraint lr_orders_kind_check
  check (kind in ('reading', 'membership', 'chat_credits'));

create unique index if not exists lr_orders_pending_transfer_chat_key
  on public.lr_orders (user_id)
  where kind = 'chat_credits'
    and method = 'transfer'
    and status = 'pending';

-- Approve either a reading unlock or a character-chat credit pack exactly once.
create or replace function public.lr_review_transfer_order(
  p_order_id bigint,
  p_decision text,
  p_note text default null
)
returns table (
  order_id bigint,
  reading_id uuid,
  review_status text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.lr_orders%rowtype;
  v_now timestamptz := now();
  v_credits integer;
begin
  if p_decision not in ('paid', 'cancelled') then
    raise exception using errcode = '22023', message = 'INVALID_TRANSFER_DECISION';
  end if;

  update public.lr_orders
  set
    status = p_decision,
    paid_at = case when p_decision = 'paid' then v_now else null end,
    updated_at = v_now,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_strip_nulls(
      jsonb_build_object(
        'reviewed_at', v_now,
        'review_note', nullif(left(btrim(p_note), 500), '')
      )
    )
  where id = p_order_id
    and kind in ('reading', 'chat_credits')
    and method = 'transfer'
    and status = 'pending'
  returning * into v_order;

  if not found then
    raise exception using errcode = 'P0001', message = 'PENDING_TRANSFER_ORDER_NOT_FOUND';
  end if;

  if p_decision = 'paid' and v_order.kind = 'reading' then
    if v_order.reading_id is null then
      raise exception using errcode = 'P0001', message = 'ORDER_READING_NOT_FOUND';
    end if;

    update public.lr_readings
    set
      unlocked = true,
      payment = jsonb_build_object(
        'method', 'transfer',
        'orderId', v_order.id,
        'depositorCode', v_order.depositor_code,
        'at', v_now
      ),
      updated_at = v_now
    where id = v_order.reading_id
      and user_id = v_order.user_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'ORDER_READING_NOT_FOUND';
    end if;
  elsif p_decision = 'paid' and v_order.kind = 'chat_credits' then
    v_credits := nullif(v_order.metadata ->> 'credits', '')::integer;
    if v_credits is null or v_credits < 1 or v_credits > 1000 then
      raise exception using errcode = '22023', message = 'INVALID_CHAT_CREDITS';
    end if;

    update public.lr_users
    set chat_credits = chat_credits + v_credits, updated_at = v_now
    where id = v_order.user_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'ORDER_USER_NOT_FOUND';
    end if;
  end if;

  return query select v_order.id, v_order.reading_id, p_decision;
end;
$$;

revoke all on function public.lr_review_transfer_order(bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.lr_review_transfer_order(bigint, text, text)
  to service_role;

-- Toss confirmation is performed by the server first; this RPC records the paid
-- state and grants the purchased credits atomically, preventing duplicate grants.
create or replace function public.lr_complete_chat_credit_order(
  p_provider_order_id text,
  p_user_id bigint
)
returns table (
  order_id bigint,
  credits_remaining integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.lr_orders%rowtype;
  v_credits integer;
  v_balance integer;
  v_now timestamptz := now();
begin
  update public.lr_orders
  set status = 'paid', paid_at = v_now, updated_at = v_now
  where provider_order_id = p_provider_order_id
    and user_id = p_user_id
    and kind = 'chat_credits'
    and method = 'toss-pg'
    and status = 'pending'
  returning * into v_order;

  if not found then
    raise exception using errcode = 'P0001', message = 'PENDING_CHAT_ORDER_NOT_FOUND';
  end if;

  v_credits := nullif(v_order.metadata ->> 'credits', '')::integer;
  if v_credits is null or v_credits < 1 or v_credits > 1000 then
    raise exception using errcode = '22023', message = 'INVALID_CHAT_CREDITS';
  end if;

  update public.lr_users
  set chat_credits = chat_credits + v_credits, updated_at = v_now
  where id = p_user_id
  returning chat_credits into v_balance;

  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_USER_NOT_FOUND';
  end if;

  return query select v_order.id, v_balance;
end;
$$;

revoke all on function public.lr_complete_chat_credit_order(text, bigint)
  from public, anon, authenticated;
grant execute on function public.lr_complete_chat_credit_order(text, bigint)
  to service_role;

comment on function public.lr_complete_chat_credit_order(text, bigint)
  is 'Atomically marks a verified Toss character-chat order paid and grants its credits.';
