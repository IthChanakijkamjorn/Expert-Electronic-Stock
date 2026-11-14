-- Only admins may delete projects or deactivate (remove) products.
drop policy "managers write projects" on public.projects;
create policy "managers add projects" on public.projects for insert to authenticated
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "managers edit projects" on public.projects for update to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
create policy "admins delete projects" on public.projects for delete to authenticated
  using (public.current_role_name() = 'admin');

-- Deleting a project keeps its stock history; the movements just lose the project link.
alter table public.stock_movements
  drop constraint stock_movements_project_id_fkey,
  add constraint stock_movements_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

create function public.products_active_admin_only() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.active is distinct from old.active and public.current_role_name() is distinct from 'admin' then
    raise exception 'only admins can remove products' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger products_active_admin_only
  before update on public.products
  for each row execute function public.products_active_admin_only();
