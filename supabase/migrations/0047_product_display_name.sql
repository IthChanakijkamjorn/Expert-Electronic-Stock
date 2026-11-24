-- Name is optional now; Brand + Model identify a product. display_name is what every screen and the website show:
-- the Name, or "Brand Model" when Name is empty.
alter table public.products alter column name drop not null;
update public.products set name = null where btrim(name) = '';

alter table public.products add column display_name text not null
  generated always as (coalesce(nullif(btrim(name), ''), btrim(coalesce(brand, '') || ' ' || coalesce(model, '')))) stored;

-- p.* is expanded when a view is created, so the view must be rebuilt to pick up the new columns.
drop view public.product_stock;
create view public.product_stock with (security_invoker = true) as
  select p.*, coalesce(sum(m.quantity), 0)::integer as stock
  from public.products p
  left join public.stock_movements m on m.product_id = p.id
  group by p.id;
grant select on public.product_stock to authenticated;
