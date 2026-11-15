-- Quotations become standalone on-screen documents (project optional); receipts are new.
alter table public.quotations alter column project_id drop not null;
alter table public.quotations add column project_label text;
alter table public.quotations add column quote_date date not null default current_date;
alter table public.quotations add column company jsonb;

create sequence public.receipt_seq;

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default (
    'RC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 4, '0')
  ),
  receipt_date date not null default current_date,
  customer_code text,
  customer text not null,
  received_from text,
  salesperson text,
  lines jsonb not null,
  cash_amount numeric(14,2) not null default 0 check (cash_amount >= 0),
  cheque_bank text,
  cheque_branch text,
  cheque_no text,
  cheque_date date,
  cheque_amount numeric(14,2) not null default 0 check (cheque_amount >= 0),
  company jsonb,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index on public.receipts (created_at desc);

alter table public.receipts enable row level security;
create policy "managers receipts" on public.receipts for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager') and created_by = auth.uid());
grant select, insert, delete on public.receipts to authenticated;
grant usage on sequence public.receipt_seq to authenticated;

create policy "require aal2 when enrolled" on public.receipts as restrictive for all to authenticated
  using ((select public.aal_ok())) with check ((select public.aal_ok()));
