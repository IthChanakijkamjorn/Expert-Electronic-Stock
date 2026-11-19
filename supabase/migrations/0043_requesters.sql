-- Internal "requester" tag so staff can group quotations, tax invoices and receipts by the person who asked. Never printed.
create table if not exists public.requesters (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);
alter table public.requesters enable row level security;
drop policy if exists "read requesters" on public.requesters;
create policy "read requesters" on public.requesters for select to authenticated using (true);
drop policy if exists "write requesters" on public.requesters;
create policy "write requesters" on public.requesters for all to authenticated
  using (public.current_role_name() is not null)
  with check (public.current_role_name() is not null);
grant select, insert, update, delete on public.requesters to authenticated;

alter table public.quotations add column if not exists requester text;
alter table public.tax_invoices add column if not exists requester text;
alter table public.receipts add column if not exists requester text;
