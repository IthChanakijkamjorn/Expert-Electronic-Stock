-- Organization -> Tower -> Project (with year), project files, and stock usage per project.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_path text,
  created_at timestamptz not null default now()
);

create table public.towers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  image_path text,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  tower_id uuid not null references public.towers (id) on delete cascade,
  year integer not null check (year between 1990 and 2200),
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (tower_id, year, name)
);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint,
  uploaded_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.stock_movements
  add column project_id uuid references public.projects (id);
create index on public.stock_movements (project_id);

alter table public.organizations enable row level security;
alter table public.towers enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;

create policy "read organizations" on public.organizations for select to authenticated using (true);
create policy "read towers" on public.towers for select to authenticated using (true);
create policy "read projects" on public.projects for select to authenticated using (true);
create policy "read project files" on public.project_files for select to authenticated using (true);

create policy "managers write organizations" on public.organizations for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "managers write towers" on public.towers for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "managers write projects" on public.projects for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));

create policy "members add project files" on public.project_files for insert to authenticated
  with check (uploaded_by = auth.uid() and public.current_role_name() is not null);
create policy "managers delete project files" on public.project_files for delete to authenticated
  using (public.current_role_name() in ('admin', 'manager'));

grant select, insert, update, delete on public.organizations, public.towers, public.projects to authenticated;
grant select, insert, delete on public.project_files to authenticated;

-- Private bucket for cover images and project documents (50 MB per file).
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)
on conflict (id) do nothing;

create policy "read files" on storage.objects for select to authenticated
  using (bucket_id = 'files');
create policy "upload files" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.current_role_name() is not null);
create policy "managers delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and public.current_role_name() in ('admin', 'manager'));
