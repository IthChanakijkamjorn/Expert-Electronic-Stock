-- Units offered in the quantity dropdown on quotations (Thai units).
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);
alter table public.units enable row level security;
drop policy if exists "read units" on public.units;
create policy "read units" on public.units for select to authenticated using (true);
drop policy if exists "write units" on public.units;
create policy "write units" on public.units for all to authenticated
  using (public.current_role_name() is not null)
  with check (public.current_role_name() is not null);
grant select, insert, update, delete on public.units to authenticated;
insert into public.units (name) values ('งาน'), ('เครื่อง'), ('จอ'), ('ชุด'), ('ชิ้น') on conflict do nothing;
