-- Invoice lines typed by hand (not in the product database) have no product_id and do not move stock.
create or replace function public.save_tax_invoice(
  p_id uuid, p_status text, p_customer_code text, p_customer text, p_address text, p_tax_id text, p_branch text,
  p_salesperson text, p_invoice_date date, p_project_id uuid,
  p_vat boolean, p_lines jsonb, p_company jsonb
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  old_row public.tax_invoices;
  inv_id uuid;
  inv_number text;
begin
  if p_status not in ('draft', 'final') then
    raise exception 'invalid_status';
  end if;

  if p_id is null then
    insert into public.tax_invoices (
      status, invoice_date, customer_code, customer, address, tax_id, branch, salesperson,
      project_id, vat, lines, company
    ) values (
      p_status, coalesce(p_invoice_date, current_date), p_customer_code, p_customer, p_address, p_tax_id, p_branch,
      p_salesperson, p_project_id, p_vat, p_lines, p_company
    ) returning id, number into inv_id, inv_number;
  else
    select * into old_row from public.tax_invoices where id = p_id for update;
    if not found then
      raise exception 'not_found';
    end if;
    if old_row.status = 'final' and p_status = 'draft' then
      raise exception 'cannot_unfinalize';
    end if;
    update public.tax_invoices set
      status = p_status, invoice_date = coalesce(p_invoice_date, invoice_date), customer_code = p_customer_code,
      customer = p_customer, address = p_address, tax_id = p_tax_id, branch = p_branch, salesperson = p_salesperson,
      project_id = p_project_id, vat = p_vat, lines = p_lines, company = p_company, updated_at = now()
    where id = p_id returning id, number into inv_id, inv_number;
  end if;

  insert into public.stock_movements (product_id, quantity, type, comment, project_id)
    select product_id, sum(q)::integer, 'sale',
           'Invoice ' || inv_number || case when p_id is null then '' else ' (edited)' end, p_project_id
    from (
      select l.product_id, l.qty as q
        from jsonb_to_recordset(case when old_row.status = 'final' then old_row.lines else '[]'::jsonb end)
             as l(product_id uuid, qty integer)
      union all
      select l.product_id, -l.qty
        from jsonb_to_recordset(case when p_status = 'final' then p_lines else '[]'::jsonb end)
             as l(product_id uuid, qty integer)
    ) m
    where product_id is not null
    group by product_id
    having sum(q) <> 0;

  return inv_id;
end $$;
grant execute on function public.save_tax_invoice(
  uuid, text, text, text, text, text, text, text, date, uuid, boolean, jsonb, jsonb
) to authenticated;

