-- Company block saved from "edit company info" becomes the default for new invoices, quotations and receipts.
create table public.company_defaults (
  kind text primary key check (kind in ('invoice', 'quote', 'receipt')),
  company jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.company_defaults enable row level security;
create policy "read company defaults" on public.company_defaults for select to authenticated using (true);
create policy "write company defaults" on public.company_defaults for all to authenticated
  using (public.current_role_name() is not null)
  with check (public.current_role_name() is not null);
grant select, insert, update on public.company_defaults to authenticated;
