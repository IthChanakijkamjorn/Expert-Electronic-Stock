-- Company-wide settings; currently just the signature image printed on quotations.
create table public.company_settings (
  key text primary key,
  value text
);
alter table public.company_settings enable row level security;
create policy "managers read settings" on public.company_settings for select to authenticated
  using (public.current_role_name() in ('admin', 'manager'));
create policy "admin writes settings" on public.company_settings for all to authenticated
  using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');
grant select, insert, update, delete on public.company_settings to authenticated;

-- Adds the 2FA policy to tables created since 0015 (quotations and company_settings).
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename from pg_tables
    where rowsecurity and (schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects'))
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = r.schemaname and tablename = r.tablename and policyname = 'require aal2 when enrolled'
    ) then
      execute format(
        'create policy "require aal2 when enrolled" on %I.%I as restrictive for all to authenticated using ((select public.aal_ok())) with check ((select public.aal_ok()))',
        r.schemaname, r.tablename
      );
    end if;
  end loop;
end $$;
