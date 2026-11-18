-- Catalog files per brand (shown on each brand page under Products).
create table public.brand_files (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint,
  uploaded_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index on public.brand_files (brand);

alter table public.brand_files enable row level security;
create policy "read brand files" on public.brand_files for select to authenticated using (true);
create policy "managers add brand files" on public.brand_files for insert to authenticated
  with check (uploaded_by = auth.uid() and public.current_role_name() in ('admin', 'manager'));
create policy "managers delete brand files" on public.brand_files for delete to authenticated
  using (public.current_role_name() in ('admin', 'manager'));
grant select, insert, delete on public.brand_files to authenticated;

-- Share links may also point at catalogs.
drop policy "members create shares" on public.file_shares;
create policy "members create shares" on public.file_shares for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.current_role_name() is not null
    and expires_at > now()
    and (
      exists (select 1 from public.project_files f where f.storage_path = file_shares.storage_path)
      or exists (select 1 from public.product_files f where f.storage_path = file_shares.storage_path)
      or exists (select 1 from public.brand_files f where f.storage_path = file_shares.storage_path)
    )
  );
