-- Company names offered in the บริษัท/องค์กร dropdown on quotations.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);
alter table public.customers enable row level security;
drop policy if exists "read customers" on public.customers;
create policy "read customers" on public.customers for select to authenticated using (true);
drop policy if exists "write customers" on public.customers;
create policy "write customers" on public.customers for all to authenticated
  using (public.current_role_name() is not null)
  with check (public.current_role_name() is not null);
grant select, insert, update, delete on public.customers to authenticated;
