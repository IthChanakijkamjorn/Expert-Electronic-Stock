-- Planned product list (BOM) per project; compared in the app with stock actually used.
create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  product_id uuid not null references public.products (id),
  planned_qty integer not null check (planned_qty > 0),
  created_at timestamptz not null default now(),
  unique (project_id, product_id)
);
create index on public.project_items (product_id);

alter table public.project_items enable row level security;
create policy "read project items" on public.project_items
  for select to authenticated using (true);
create policy "managers write project items" on public.project_items
  for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));

grant select, insert, update, delete on public.project_items to authenticated;
