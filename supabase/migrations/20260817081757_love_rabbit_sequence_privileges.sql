-- Supabase grants new public-schema sequences to API roles by default.
-- LoveRabbit tables are server-owned, so the browser roles do not need them.
revoke all on sequence public.lr_users_id_seq from anon, authenticated;
revoke all on sequence public.lr_orders_id_seq from anon, authenticated;
revoke all on sequence public.lr_memberships_id_seq from anon, authenticated;

grant usage, select on sequence public.lr_users_id_seq to service_role;
grant usage, select on sequence public.lr_orders_id_seq to service_role;
grant usage, select on sequence public.lr_memberships_id_seq to service_role;
