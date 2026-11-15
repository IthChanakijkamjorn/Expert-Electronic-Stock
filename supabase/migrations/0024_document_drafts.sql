-- Drafts and later edits for tax invoices, quotations and receipts.
-- A draft has no number yet; the number is assigned the first time the document becomes final.
alter table public.tax_invoices add column status text not null default 'final' check (status in ('draft', 'final'));
alter table public.quotations   add column status text not null default 'final' check (status in ('draft', 'final'));
alter table public.receipts     add column status text not null default 'final' check (status in ('draft', 'final'));
alter table public.tax_invoices add column updated_at timestamptz not null default now();
alter table public.quotations   add column updated_at timestamptz not null default now();
alter table public.receipts     add column updated_at timestamptz not null default now();
update public.tax_invoices set updated_at = created_at;
update public.quotations   set updated_at = created_at;
update public.receipts     set updated_at = created_at;

alter table public.tax_invoices alter column number drop not null;
alter table public.tax_invoices alter column number drop default;
alter table public.quotations alter column number drop not null;
alter table public.quotations alter column number drop default;
alter table public.receipts alter column number drop not null;
alter table public.receipts alter column number drop default;

create function public.assign_document_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'final' and new.number is null then
    new.number := case tg_table_name
      when 'tax_invoices' then 'IV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.tax_invoice_seq')::text, 4, '0')
      when 'quotations' then 'QT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quotation_seq')::text, 4, '0')
      else 'RC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 4, '0')
    end;
  end if;
  return new;
end $$;
create trigger assign_number before insert or update on public.tax_invoices for each row execute function public.assign_document_number();
create trigger assign_number before insert or update on public.quotations for each row execute function public.assign_document_number();
create trigger assign_number before insert or update on public.receipts for each row execute function public.assign_document_number();

-- Tax invoices: the creator or a manager can edit; drafts can be deleted.
create policy "edit tax invoices" on public.tax_invoices for update to authenticated
  using (created_by = auth.uid() or public.current_role_name() in ('admin', 'manager'))
  with check (created_by = auth.uid() or public.current_role_name() in ('admin', 'manager'));
create policy "delete tax invoice drafts" on public.tax_invoices for delete to authenticated
  using (status = 'draft' and (created_by = auth.uid() or public.current_role_name() in ('admin', 'manager')));
grant update, delete on public.tax_invoices to authenticated;

-- Quotations and receipts: any manager may edit, whoever created the document.
drop policy "managers quotations" on public.quotations;
create policy "managers quotations" on public.quotations for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
grant update on public.quotations to authenticated;
drop policy "managers receipts" on public.receipts;
create policy "managers receipts" on public.receipts for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
grant update on public.receipts to authenticated;

-- Create or update an invoice. Stock follows the final version only: the previous final lines are put back
-- and the new final lines are deducted, in one transaction. Drafts never touch stock.
drop function public.create_tax_invoice(text, text, text, text, text, text, date, uuid, uuid, boolean, jsonb, jsonb);
create function public.save_tax_invoice(
  p_id uuid, p_status text, p_customer_code text, p_customer text, p_address text, p_tax_id text, p_branch text,
  p_salesperson text, p_invoice_date date, p_project_id uuid, p_location_id uuid,
  p_vat boolean, p_lines jsonb, p_company jsonb
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  old_row public.tax_invoices;
  inv_id uuid;
  inv_number text;
  default_loc uuid;
  new_loc uuid;
  old_loc uuid;
begin
  if p_status not in ('draft', 'final') then
    raise exception 'invalid_status';
  end if;
  select id into default_loc from public.locations where is_default;
  new_loc := coalesce(p_location_id, default_loc);

  if p_id is null then
    insert into public.tax_invoices (
      status, invoice_date, customer_code, customer, address, tax_id, branch, salesperson,
      project_id, location_id, vat, lines, company
    ) values (
      p_status, coalesce(p_invoice_date, current_date), p_customer_code, p_customer, p_address, p_tax_id, p_branch,
      p_salesperson, p_project_id, p_location_id, p_vat, p_lines, p_company
    ) returning id, number into inv_id, inv_number;
  else
    select * into old_row from public.tax_invoices where id = p_id for update;
    if not found then
      raise exception 'not_found';
    end if;
    if old_row.status = 'final' and p_status = 'draft' then
      raise exception 'cannot_unfinalize';
    end if;
    old_loc := coalesce(old_row.location_id, default_loc);
    update public.tax_invoices set
      status = p_status, invoice_date = coalesce(p_invoice_date, invoice_date), customer_code = p_customer_code,
      customer = p_customer, address = p_address, tax_id = p_tax_id, branch = p_branch, salesperson = p_salesperson,
      project_id = p_project_id, location_id = p_location_id, vat = p_vat, lines = p_lines, company = p_company,
      updated_at = now()
    where id = p_id returning id, number into inv_id, inv_number;
  end if;

  insert into public.stock_movements (product_id, quantity, type, comment, project_id, location_id)
    select product_id, sum(q)::integer, 'sale',
           'Invoice ' || inv_number || case when p_id is null then '' else ' (edited)' end, p_project_id, loc
    from (
      select l.product_id, l.qty as q, old_loc as loc
        from jsonb_to_recordset(case when old_row.status = 'final' then old_row.lines else '[]'::jsonb end)
             as l(product_id uuid, qty integer)
      union all
      select l.product_id, -l.qty, new_loc
        from jsonb_to_recordset(case when p_status = 'final' then p_lines else '[]'::jsonb end)
             as l(product_id uuid, qty integer)
    ) m
    group by product_id, loc
    having sum(q) <> 0;

  return inv_id;
end $$;
grant execute on function public.save_tax_invoice(
  uuid, text, text, text, text, text, text, text, date, uuid, uuid, boolean, jsonb, jsonb
) to authenticated;
