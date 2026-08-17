create index if not exists lr_referrals_reward_reading_id_idx
  on public.lr_referrals (reward_reading_id)
  where reward_reading_id is not null;
