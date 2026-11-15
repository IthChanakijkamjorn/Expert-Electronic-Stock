-- Multiple stock locations. Every movement belongs to a location; transfers are an out + in pair.
alter type public.movement_type add value if not exists 'transfer';

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index locations_one_default on public.locations (is_default) where is_default;

insert into public.locations (name, is_default) values ('Main warehouse', true);

alter table public.stock_movements add column location_id uuid references public.locations (id);
update public.stock_movements set location_id = (select id from public.locations where is_default);
alter table public.stock_movements alter column location_id set not null;
create index on public.stock_movements (location_id);

alter table public.locations enable row level security;
create policy "read locations" on public.locations
  for select to authenticated using (true);
create policy "managers write locations" on public.locations
  for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
grant select, insert, update on public.locations to authenticated;

-- Stock may never go below zero in any location. Movements without a location use the default one.
create or replace function public.check_stock_not_negative() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  current_qty bigint;
begin
  if new.location_id is null then
    select id into new.location_id from public.locations where is_default;
  end if;
  perform 1 from public.products where id = new.product_id for update;
  select coalesce(sum(quantity), 0) into current_qty
    from public.stock_movements
    where product_id = new.product_id and location_id = new.location_id;
  if current_qty + new.quantity < 0 then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;
  return new;
end $$;

create view public.product_location_stock with (security_invoker = true) as
  select product_id, location_id, sum(quantity)::integer as qty
  from public.stock_movements
  group by product_id, location_id;
grant select on public.product_location_stock to authenticated;
