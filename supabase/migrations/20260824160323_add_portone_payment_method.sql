-- PortOne V2 / KG Inicis real-time bank transfers use the same order ledger as
-- the existing Toss and manually reviewed transfer paths.
alter table public.lr_orders
  drop constraint if exists lr_orders_method_check;

alter table public.lr_orders
  add constraint lr_orders_method_check
  check (method in ('transfer', 'toss-pg', 'portone-pg', 'membership', 'mock'));

-- A verified PortOne payment can be completed from both the signed webhook and
-- the browser return URL. The pending-state update keeps the credit grant
-- exactly-once when those requests race.
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
    and method in ('toss-pg', 'portone-pg')
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
  is 'Atomically completes a server-verified Toss or PortOne chat-credit order and grants credits once.';
