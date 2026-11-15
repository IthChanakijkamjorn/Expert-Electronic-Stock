-- Individual units with serial numbers (warranty / returns). Independent of stock quantities.
create table public.product_serials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  serial text not null check (length(btrim(serial)) > 0),
  status text not null default 'in_stock' check (status in ('in_stock', 'issued')),
  issued_to text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (product_id, serial)
);

alter table public.product_serials enable row level security;
create policy "read serials" on public.product_serials
  for select to authenticated using (true);
create policy "managers write serials" on public.product_serials
  for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));

grant select, insert, update, delete on public.product_serials to authenticated;
