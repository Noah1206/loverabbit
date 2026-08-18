-- Review a manual bank-transfer order atomically. Only the server-side
-- service role can call this RPC; browser roles have no table or RPC access.
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
    and kind = 'reading'
    and method = 'transfer'
    and status = 'pending'
  returning * into v_order;

  if not found then
    raise exception using errcode = 'P0001', message = 'PENDING_TRANSFER_ORDER_NOT_FOUND';
  end if;

  if p_decision = 'paid' then
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
  end if;

  return query
    select v_order.id, v_order.reading_id, p_decision;
end;
$$;

revoke all on function public.lr_review_transfer_order(bigint, text, text) from public, anon, authenticated;
grant execute on function public.lr_review_transfer_order(bigint, text, text) to service_role;
