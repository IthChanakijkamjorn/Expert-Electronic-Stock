-- A library of approver signatures; one is the default for new quotations.
create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index signatures_one_default on public.signatures (is_default) where is_default;
alter table public.signatures enable row level security;
create policy "managers read signatures" on public.signatures for select to authenticated
  using (public.current_role_name() in ('admin', 'manager'));
create policy "admin writes signatures" on public.signatures for all to authenticated
  using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');
grant select, insert, update, delete on public.signatures to authenticated;

-- Carry over the single signature from 0017, if one was uploaded.
insert into public.signatures (name, path, is_default)
select 'Signature', value, true from public.company_settings where key = 'signature' and value is not null;
delete from public.company_settings where key = 'signature';

alter table public.quotations add column signature_id uuid references public.signatures (id) on delete set null;

-- Adds the 2FA policy to tables created since 0015.
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
