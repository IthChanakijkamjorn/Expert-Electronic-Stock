alter table public.projects add column if not exists image_path text;

create table public.project_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);
create index on public.project_photos (project_id, created_at);

alter table public.project_photos enable row level security;
create policy "read project photos" on public.project_photos for select to authenticated using (true);
create policy "managers write project photos" on public.project_photos for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
grant select, insert, update, delete on public.project_photos to authenticated;
