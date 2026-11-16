-- Goods received: replaces purchase orders. A receipt adds stock for several products at once and keeps
-- the supplier's quotation (PDF/photo) as a reference. Old purchase_orders/suppliers tables are kept as history.
create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  supplier text not null check (length(btrim(supplier)) > 0),
  reference text,
  note text,
  location_id uuid references public.locations (id),
  file_path text,
  file_name text,
  received_date date not null default current_date,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.goods_receipts (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty integer not null check (qty > 0),
  unit_cost numeric(12,2) check (unit_cost >= 0)
);
create index on public.goods_receipt_lines (receipt_id);

alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_lines enable row level security;

create policy "managers goods receipts" on public.goods_receipts for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager') and created_by = auth.uid());
create policy "managers goods receipt lines" on public.goods_receipt_lines for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
grant select, insert on public.goods_receipts, public.goods_receipt_lines to authenticated;

-- One transaction: the receipt, its lines, the stock movements and the latest cost.
create function public.receive_goods(
  p_supplier text, p_reference text, p_note text, p_loc uuid, p_date date,
  p_file_path text, p_file_name text, p_lines jsonb
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  rid uuid;
begin
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'no_lines';
  end if;

  insert into public.goods_receipts (supplier, reference, note, location_id, received_date, file_path, file_name)
    values (btrim(p_supplier), nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), p_loc,
            coalesce(p_date, current_date), p_file_path, p_file_name)
    returning id into rid;

  insert into public.goods_receipt_lines (receipt_id, product_id, qty, unit_cost)
    select rid, (l->>'product_id')::uuid, (l->>'qty')::integer, nullif(l->>'unit_cost', '')::numeric
    from jsonb_array_elements(p_lines) l;

  insert into public.stock_movements (product_id, quantity, type, comment, location_id)
    select product_id, sum(qty)::integer, 'purchase',
           'GR ' || btrim(p_supplier) || coalesce(' / ' || nullif(btrim(p_reference), ''), ''), p_loc
    from public.goods_receipt_lines where receipt_id = rid group by product_id;

  insert into public.product_prices (product_id, cost, updated_at)
    select distinct on (product_id) product_id, unit_cost, now()
    from public.goods_receipt_lines where receipt_id = rid and unit_cost is not null
    order by product_id, id desc
    on conflict (product_id) do update set cost = excluded.cost, updated_at = now();

  return rid;
end $$;
grant execute on function public.receive_goods(text, text, text, uuid, date, text, text, jsonb) to authenticated;
