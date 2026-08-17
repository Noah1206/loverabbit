alter table public.lr_user_profiles
  add column if not exists show_mature_labels boolean not null default false;

comment on column public.lr_user_profiles.show_mature_labels is
  'Whether optional age guidance labels are shown. Disabled by default.';
