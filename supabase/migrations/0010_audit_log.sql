-- Who did what (renames, deletes, user management). Readable by admins only; rows are never edited.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid default auth.uid() references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_name text,
  created_at timestamptz not null default now()
);
create index on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
create policy "members write audit" on public.audit_log for insert to authenticated
  with check (actor = auth.uid() and public.current_role_name() is not null);
create policy "admins read audit" on public.audit_log for select to authenticated
  using (public.current_role_name() = 'admin');
grant select, insert on public.audit_log to authenticated;
