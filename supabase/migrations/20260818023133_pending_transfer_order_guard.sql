-- A reading can have only one active manual-transfer review at a time.
-- Completed or cancelled orders remain in the ledger for audit history.
create unique index if not exists lr_orders_pending_transfer_reading_key
  on public.lr_orders (reading_id)
  where reading_id is not null
    and kind = 'reading'
    and method = 'transfer'
    and status = 'pending';
