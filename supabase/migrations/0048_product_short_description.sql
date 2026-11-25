-- Two descriptions: description (full) is shown on the website and the product page; short_description is the
-- text quotations and invoices fill in. form_text is what a form fills in: the short one, else the full one,
-- else the display name. Editing the text on a form saves it as the product's short_description.
alter table public.products add column short_description text;

alter table public.products add column form_text text not null
  generated always as (coalesce(
    nullif(btrim(short_description), ''),
    nullif(btrim(description), ''),
    nullif(btrim(name), ''),
    btrim(coalesce(brand, '') || ' ' || coalesce(model, ''))
  )) stored;

-- p.* is expanded when a view is created, so the view must be rebuilt to pick up the new columns.
drop view public.product_stock;
create view public.product_stock with (security_invoker = true) as
  select p.*, coalesce(sum(m.quantity), 0)::integer as stock
  from public.products p
  left join public.stock_movements m on m.product_id = p.id
  group by p.id;
grant select on public.product_stock to authenticated;
