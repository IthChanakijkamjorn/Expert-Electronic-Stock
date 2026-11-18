-- Uploaded ready-made documents (PDF/Excel/...) listed in the Documents hub.
create table if not exists public.document_files (
  id uuid primary key default gen_random_uuid(),
  doc_kind text not null check (doc_kind in ('invoice', 'quotation', 'receipt')),
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint,
  uploaded_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists document_files_kind_idx on public.document_files (doc_kind, created_at desc);

alter table public.document_files enable row level security;
create policy "read document files" on public.document_files for select to authenticated
  using (doc_kind = 'invoice' or public.current_role_name() in ('admin', 'manager'));
create policy "add document files" on public.document_files for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      (doc_kind = 'invoice' and public.current_role_name() is not null)
      or public.current_role_name() in ('admin', 'manager')
    )
  );
create policy "managers delete document files" on public.document_files for delete to authenticated
  using (public.current_role_name() in ('admin', 'manager'));
grant select, insert, delete on public.document_files to authenticated;

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
      or exists (select 1 from public.document_files f where f.storage_path = file_shares.storage_path)
    )
  );
