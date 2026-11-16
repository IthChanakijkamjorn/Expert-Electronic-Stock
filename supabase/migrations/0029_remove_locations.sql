-- Removes storage locations and the leftover purchase order / supplier tables. Stock is now one pool per product.
drop function if exists public.save_tax_invoice(uuid, text, text, text, text, text, text, text, date, uuid, uuid, boolean, jsonb, jsonb);
drop function if exists public.receive_goods(text, text, text, uuid, date, text, text, jsonb);
drop function if exists public.receive_purchase_order(uuid, uuid);

drop table if exists public.purchase_order_lines;
drop table if exists public.purchase_orders;
drop table if exists public.suppliers;
drop sequence if exists public.purchase_order_seq;

drop view if exists public.product_location_stock;
alter table public.tax_invoices drop column if exists location_id;
alter table public.goods_receipts drop column if exists location_id;
alter table public.stock_movements drop column if exists location_id;
drop table if exists public.locations;

create or replace function public.check_stock_not_negative() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  current_qty bigint;
begin
  if new.quantity >= 0 or new.type = 'sale' then
    return new;
  end if;
  perform 1 from public.products where id = new.product_id for update;
  select coalesce(sum(quantity), 0) into current_qty
    from public.stock_movements where product_id = new.product_id;
  if current_qty + new.quantity < 0 then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;
  return new;
end $$;

create function public.save_tax_invoice(
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
    group by product_id
    having sum(q) <> 0;

  return inv_id;
end $$;
grant execute on function public.save_tax_invoice(
  uuid, text, text, text, text, text, text, text, date, uuid, boolean, jsonb, jsonb
) to authenticated;

create function public.receive_goods(
  p_supplier text, p_reference text, p_note text, p_date date,
  p_file_path text, p_file_name text, p_lines jsonb
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  rid uuid;
begin
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'no_lines';
  end if;

  insert into public.goods_receipts (supplier, reference, note, received_date, file_path, file_name)
    values (btrim(p_supplier), nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''),
            coalesce(p_date, current_date), p_file_path, p_file_name)
    returning id into rid;

  insert into public.goods_receipt_lines (receipt_id, product_id, qty, unit_cost)
    select rid, (l->>'product_id')::uuid, (l->>'qty')::integer, nullif(l->>'unit_cost', '')::numeric
    from jsonb_array_elements(p_lines) l;

  insert into public.stock_movements (product_id, quantity, type, comment)
    select product_id, sum(qty)::integer, 'purchase',
           'GR ' || btrim(p_supplier) || coalesce(' / ' || nullif(btrim(p_reference), ''), '')
    from public.goods_receipt_lines where receipt_id = rid group by product_id;

  insert into public.product_prices (product_id, cost, updated_at)
    select distinct on (product_id) product_id, unit_cost, now()
    from public.goods_receipt_lines where receipt_id = rid and unit_cost is not null
    order by product_id, id desc
    on conflict (product_id) do update set cost = excluded.cost, updated_at = now();

  return rid;
end $$;
grant execute on function public.receive_goods(text, text, text, date, text, text, jsonb) to authenticated;
