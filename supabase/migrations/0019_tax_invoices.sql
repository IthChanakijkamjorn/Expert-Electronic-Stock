-- Tax invoices (ใบกำกับภาษี), numbered IV-YYYY-NNNN. Creating one deducts stock in the same transaction.
alter type public.movement_type add value if not exists 'sale';

create sequence public.tax_invoice_seq;

create table public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default (
    'IV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.tax_invoice_seq')::text, 4, '0')
  ),
  invoice_date date not null default current_date,
  customer_code text,
  customer text not null,
  address text,
  tax_id text,
  branch text,
  salesperson text,
  project_id uuid references public.projects (id) on delete set null,
  location_id uuid references public.locations (id),
  vat boolean not null default true,
  lines jsonb not null,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index on public.tax_invoices (created_at desc);

alter table public.tax_invoices enable row level security;
create policy "read tax invoices" on public.tax_invoices for select to authenticated using (true);
create policy "create tax invoices" on public.tax_invoices for insert to authenticated
  with check (created_by = auth.uid() and public.current_role_name() is not null);
grant select, insert on public.tax_invoices to authenticated;
grant usage on sequence public.tax_invoice_seq to authenticated;

-- p_lines: [{product_id, brand, model, name, unit, qty, price}]. If any product lacks stock the whole call rolls back.
create function public.create_tax_invoice(
  p_customer_code text, p_customer text, p_address text, p_tax_id text, p_branch text,
  p_salesperson text, p_invoice_date date, p_project_id uuid, p_location_id uuid,
  p_vat boolean, p_lines jsonb
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  inv_id uuid;
  inv_number text;
begin
  insert into public.tax_invoices (
    invoice_date, customer_code, customer, address, tax_id, branch, salesperson,
    project_id, location_id, vat, lines
  ) values (
    coalesce(p_invoice_date, current_date), p_customer_code, p_customer, p_address, p_tax_id, p_branch,
    p_salesperson, p_project_id, p_location_id, p_vat, p_lines
  ) returning id, number into inv_id, inv_number;

  insert into public.stock_movements (product_id, quantity, type, comment, project_id, location_id)
    select l.product_id, -l.qty, 'sale', 'Invoice ' || inv_number, p_project_id, p_location_id
    from jsonb_to_recordset(p_lines) as l(product_id uuid, qty integer);

  return inv_id;
end $$;
grant execute on function public.create_tax_invoice(
  text, text, text, text, text, text, date, uuid, uuid, boolean, jsonb
) to authenticated;

-- Re-apply the 2FA policy to the new table.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tax_invoices' and policyname = 'require aal2 when enrolled'
  ) then
    create policy "require aal2 when enrolled" on public.tax_invoices as restrictive for all to authenticated
      using ((select public.aal_ok())) with check ((select public.aal_ok()));
  end if;
end $$;
