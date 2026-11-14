-- Products and append-only stock movements. Current stock = sum of movements.
create type public.movement_type as enum (
  'purchase', 'return_from_site', 'project_use', 'count_correction', 'other'
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sanity_id text unique,
  sku text unique,
  name text not null,
  brand text,
  category text,
  unit text not null default 'pcs',
  supplier text,
  location text,
  min_stock integer not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity <> 0),
  type public.movement_type not null,
  comment text not null check (length(btrim(comment)) > 0),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create index on public.stock_movements (product_id, created_at desc);

alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

create policy "read products" on public.products
  for select to authenticated using (true);
create policy "managers insert products" on public.products
  for insert to authenticated
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "managers update products" on public.products
  for update to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));

create policy "read movements" on public.stock_movements
  for select to authenticated using (true);
create policy "record own movements" on public.stock_movements
  for insert to authenticated
  with check (created_by = auth.uid() and public.current_role_name() is not null);

-- Stock may never go below zero; lock the product row to serialise concurrent writes.
create function public.check_stock_not_negative() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  current_qty bigint;
begin
  perform 1 from public.products where id = new.product_id for update;
  select coalesce(sum(quantity), 0) into current_qty
    from public.stock_movements where product_id = new.product_id;
  if current_qty + new.quantity < 0 then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger stock_not_negative
  before insert on public.stock_movements
  for each row execute function public.check_stock_not_negative();

create view public.product_stock with (security_invoker = true) as
  select p.*, coalesce(sum(m.quantity), 0)::integer as stock
  from public.products p
  left join public.stock_movements m on m.product_id = p.id
  group by p.id;

-- Data API auto-exposure is off; no update/delete on movements keeps history immutable.
grant select, insert, update on public.products to authenticated;
grant select, insert on public.stock_movements to authenticated;
grant select on public.product_stock to authenticated;

-- Staff need to see who made each movement.
create policy "read all profiles" on public.profiles
  for select to authenticated using (true);
