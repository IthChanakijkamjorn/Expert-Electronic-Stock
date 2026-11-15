-- Each invoice keeps its own copy of the company details printed on it (they can be edited per invoice).
alter table public.tax_invoices add column company jsonb;

drop function public.create_tax_invoice(text, text, text, text, text, text, date, uuid, uuid, boolean, jsonb);
create function public.create_tax_invoice(
  p_customer_code text, p_customer text, p_address text, p_tax_id text, p_branch text,
  p_salesperson text, p_invoice_date date, p_project_id uuid, p_location_id uuid,
  p_vat boolean, p_lines jsonb, p_company jsonb
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  inv_id uuid;
  inv_number text;
begin
  insert into public.tax_invoices (
    invoice_date, customer_code, customer, address, tax_id, branch, salesperson,
    project_id, location_id, vat, lines, company
  ) values (
    coalesce(p_invoice_date, current_date), p_customer_code, p_customer, p_address, p_tax_id, p_branch,
    p_salesperson, p_project_id, p_location_id, p_vat, p_lines, p_company
  ) returning id, number into inv_id, inv_number;

  insert into public.stock_movements (product_id, quantity, type, comment, project_id, location_id)
    select l.product_id, -l.qty, 'sale', 'Invoice ' || inv_number, p_project_id, p_location_id
    from jsonb_to_recordset(p_lines) as l(product_id uuid, qty integer);

  return inv_id;
end $$;
grant execute on function public.create_tax_invoice(
  text, text, text, text, text, text, date, uuid, uuid, boolean, jsonb, jsonb
) to authenticated;
