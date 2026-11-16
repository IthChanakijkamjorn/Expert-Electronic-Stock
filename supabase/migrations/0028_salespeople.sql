-- Names offered in the พนักงานขาย dropdown on invoices and receipts.
create table public.salespeople (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);
alter table public.salespeople enable row level security;
create policy "read salespeople" on public.salespeople for select to authenticated using (true);
create policy "write salespeople" on public.salespeople for all to authenticated
  using (public.current_role_name() is not null)
  with check (public.current_role_name() is not null);
grant select, insert, update, delete on public.salespeople to authenticated;
