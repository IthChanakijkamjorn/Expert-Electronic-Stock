-- category = main category; sub_category and description come from the product import sheets.
alter table public.products add column if not exists sub_category text;
alter table public.products add column if not exists description text;

drop view public.product_stock;
create view public.product_stock with (security_invoker = true) as
  select p.*, coalesce(sum(m.quantity), 0)::integer as stock
  from public.products p
  left join public.stock_movements m on m.product_id = p.id
  group by p.id;
grant select on public.product_stock to authenticated;
