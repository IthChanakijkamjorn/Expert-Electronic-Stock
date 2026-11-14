-- Only admins may delete organizations and towers; managers can still add and edit them.
drop policy "managers write organizations" on public.organizations;
create policy "managers add organizations" on public.organizations for insert to authenticated
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "managers edit organizations" on public.organizations for update to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "admins delete organizations" on public.organizations for delete to authenticated
  using (public.current_role_name() = 'admin');

drop policy "managers write towers" on public.towers;
create policy "managers add towers" on public.towers for insert to authenticated
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "managers edit towers" on public.towers for update to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "admins delete towers" on public.towers for delete to authenticated
  using (public.current_role_name() = 'admin');
