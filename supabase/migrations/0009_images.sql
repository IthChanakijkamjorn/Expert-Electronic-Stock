-- Product photos and brand logos (files live in the private "files" bucket).
alter table public.products add column image_path text;

create table public.brands (
  name text primary key,
  logo_path text
);
alter table public.brands enable row level security;
create policy "read brands" on public.brands for select to authenticated using (true);
create policy "managers add brands" on public.brands for insert to authenticated
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "managers edit brands" on public.brands for update to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
grant select, insert, update on public.brands to authenticated;

-- product_stock is p.*, so it must be recreated to expose the new column.
drop view public.product_stock;
create view public.product_stock with (security_invoker = true) as
  select p.*, coalesce(sum(m.quantity), 0)::integer as stock
  from public.products p
  left join public.stock_movements m on m.product_id = p.id
  group by p.id;
grant select on public.product_stock to authenticated;
