-- Issued quotations, numbered QT-YYYY-NNNN. The lines are a snapshot so a reopened PDF never changes.
create sequence public.quotation_seq;

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default (
    'QT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quotation_seq')::text, 4, '0')
  ),
  project_id uuid not null references public.projects (id) on delete cascade,
  customer text not null,
  attention text,
  phone text,
  email text,
  valid_days integer check (valid_days >= 0),
  lead_days integer check (lead_days >= 0),
  warranty_years numeric(4,1) check (warranty_years >= 0),
  payment_terms text,
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  vat boolean not null default true,
  quoted_by text,
  lines jsonb not null,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index on public.quotations (project_id, created_at desc);

alter table public.quotations enable row level security;
create policy "managers quotations" on public.quotations for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager') and created_by = auth.uid());
grant select, insert, delete on public.quotations to authenticated;
grant usage on sequence public.quotation_seq to authenticated;
