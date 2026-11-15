-- Suppliers, purchase orders and product cost. Managers and admins only (costs are not shown to staff).
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.product_prices (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost numeric(12,2) check (cost >= 0),
  sell_price numeric(12,2) check (sell_price >= 0),
  updated_at timestamptz not null default now()
);

create sequence public.purchase_order_seq;

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('PO-' || lpad(nextval('public.purchase_order_seq')::text, 5, '0')),
  supplier_id uuid not null references public.suppliers (id),
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  notes text,
  location_id uuid references public.locations (id),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty integer not null check (qty > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  unique (po_id, product_id)
);

alter table public.suppliers enable row level security;
alter table public.product_prices enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

create policy "managers suppliers" on public.suppliers for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "managers prices" on public.product_prices for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "managers purchase orders" on public.purchase_orders for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager') and created_by = auth.uid());
create policy "managers read lines" on public.purchase_order_lines for select to authenticated
  using (public.current_role_name() in ('admin', 'manager'));
-- Lines can only change while the order is still a draft.
create policy "managers write draft lines" on public.purchase_order_lines for all to authenticated
  using (
    public.current_role_name() in ('admin', 'manager')
    and exists (select 1 from public.purchase_orders o where o.id = po_id and o.status = 'draft')
  )
  with check (
    public.current_role_name() in ('admin', 'manager')
    and exists (select 1 from public.purchase_orders o where o.id = po_id and o.status = 'draft')
  );

grant select, insert, update, delete on public.suppliers, public.product_prices,
  public.purchase_orders, public.purchase_order_lines to authenticated;
grant usage on sequence public.purchase_order_seq to authenticated;

-- Receive an ordered PO into a location in one transaction; a second attempt fails.
create function public.receive_purchase_order(po uuid, loc uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare
  num text;
begin
  update public.purchase_orders
    set status = 'received', received_at = now(), location_id = loc
    where id = po and status = 'ordered'
    returning number into num;
  if not found then
    raise exception 'not_receivable';
  end if;

  insert into public.stock_movements (product_id, quantity, type, comment, location_id)
    select product_id, qty, 'purchase', 'PO ' || num, loc
    from public.purchase_order_lines where po_id = po;

  insert into public.product_prices (product_id, cost, updated_at)
    select product_id, unit_cost, now() from public.purchase_order_lines where po_id = po
    on conflict (product_id) do update set cost = excluded.cost, updated_at = now();
end $$;
grant execute on function public.receive_purchase_order(uuid, uuid) to authenticated;
