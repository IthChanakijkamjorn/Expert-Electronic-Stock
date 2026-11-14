-- Datasheets/files per product, and expiring, revocable public share links.
create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint,
  uploaded_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index on public.product_files (product_id);

create table public.file_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  storage_path text not null,
  file_name text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index on public.file_shares (storage_path);

alter table public.product_files enable row level security;
alter table public.file_shares enable row level security;

create policy "read product files" on public.product_files for select to authenticated using (true);
create policy "members add product files" on public.product_files for insert to authenticated
  with check (uploaded_by = auth.uid() and public.current_role_name() is not null);
create policy "managers delete product files" on public.product_files for delete to authenticated
  using (public.current_role_name() in ('admin', 'manager'));

create policy "read shares" on public.file_shares for select to authenticated using (true);
create policy "members create shares" on public.file_shares for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.current_role_name() is not null
    and expires_at > now()
    and (
      exists (select 1 from public.project_files f where f.storage_path = file_shares.storage_path)
      or exists (select 1 from public.product_files f where f.storage_path = file_shares.storage_path)
    )
  );
create policy "creator or manager revokes shares" on public.file_shares for update to authenticated
  using (created_by = auth.uid() or public.current_role_name() in ('admin', 'manager'))
  with check (created_by = auth.uid() or public.current_role_name() in ('admin', 'manager'));

grant select, insert, delete on public.product_files to authenticated;
grant select, insert on public.file_shares to authenticated;
grant update (revoked_at) on public.file_shares to authenticated;

-- Public lookup: returns the file only while the link is valid.
create function public.resolve_share(p_token text)
returns table (storage_path text, file_name text)
language sql security definer stable set search_path = ''
as $$
  select s.storage_path, s.file_name
  from public.file_shares s
  where s.token = p_token and s.revoked_at is null and s.expires_at > now();
$$;

create function public.is_shared_object(p_path text)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.file_shares s
    where s.storage_path = p_path and s.revoked_at is null and s.expires_at > now()
  );
$$;

grant execute on function public.resolve_share(text) to anon, authenticated;
grant execute on function public.is_shared_object(text) to anon, authenticated;

-- Anonymous visitors can only sign/read objects that have a currently valid share link.
create policy "read shared files" on storage.objects for select to anon
  using (bucket_id = 'files' and public.is_shared_object(name));
