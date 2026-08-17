-- ON DELETE SET NULL must be able to unlink an Auth user while preserving the
-- LoveRabbit member's readings, orders, referrals, and historical provider.
alter table public.lr_users
  drop constraint if exists lr_users_auth_identity_complete_check;
