-- Two-factor login: once a user has a verified authenticator, every table and file
-- needs an aal2 (code-verified) session. Users without 2FA are unaffected.
create function public.aal_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified'
    )
$$;
revoke all on function public.aal_ok() from public;
grant execute on function public.aal_ok() to authenticated;

-- New tables added later need the same policy; re-running this block adds it where missing.
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
