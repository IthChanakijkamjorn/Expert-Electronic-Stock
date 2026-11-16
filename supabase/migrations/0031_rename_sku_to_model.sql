-- The old SKU column is now the product Model.
drop view public.product_stock;
alter table public.products rename column sku to model;
create view public.product_stock with (security_invoker = true) as
  select p.*, coalesce(sum(m.quantity), 0)::integer as stock
  from public.products p
  left join public.stock_movements m on m.product_id = p.id
  group by p.id;
grant select on public.product_stock to authenticated;
