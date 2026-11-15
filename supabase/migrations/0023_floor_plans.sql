-- Floor plans: a room of width x height metres, drawn walls and product markers.
-- data: { walls: [{x1,y1,x2,y2}], used: [product_id], items: [{id, product_id, x, y}] } (positions in metres)
create table public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references public.projects (id) on delete set null,
  width_m numeric(6,2) not null check (width_m > 0 and width_m <= 500),
  height_m numeric(6,2) not null check (height_m > 0 and height_m <= 500),
  data jsonb not null default '{"walls":[],"used":[],"items":[]}',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.floor_plans (project_id);
create index on public.floor_plans (updated_at desc);

alter table public.floor_plans enable row level security;
create policy "read floor plans" on public.floor_plans for select to authenticated using (true);
create policy "managers write floor plans" on public.floor_plans for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
grant select, insert, update, delete on public.floor_plans to authenticated;

create policy "require aal2 when enrolled" on public.floor_plans as restrictive for all to authenticated
  using ((select public.aal_ok())) with check ((select public.aal_ok()));
