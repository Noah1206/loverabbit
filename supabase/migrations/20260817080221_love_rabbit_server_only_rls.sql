create policy lr_users_server_only on public.lr_users
  as restrictive for all to anon, authenticated
  using (false) with check (false);
create policy lr_readings_server_only on public.lr_readings
  as restrictive for all to anon, authenticated
  using (false) with check (false);
create policy lr_orders_server_only on public.lr_orders
  as restrictive for all to anon, authenticated
  using (false) with check (false);
create policy lr_memberships_server_only on public.lr_memberships
  as restrictive for all to anon, authenticated
  using (false) with check (false);
