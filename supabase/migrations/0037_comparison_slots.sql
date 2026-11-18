-- Splits comparison documents into 3 suppliers (slots 1-3), each with an editable name.
alter table public.project_files add column if not exists slot smallint check (slot between 1 and 3);

create table if not exists public.project_comparison_slots (
  project_id uuid not null references public.projects (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  name text not null default '',
  primary key (project_id, slot)
);
alter table public.project_comparison_slots enable row level security;
create policy "read comparison slots" on public.project_comparison_slots for select to authenticated using (true);
create policy "managers write comparison slots" on public.project_comparison_slots for all to authenticated
  using (public.current_role_name() in ('admin', 'manager'))
  with check (public.current_role_name() in ('admin', 'manager'));
grant select, insert, update, delete on public.project_comparison_slots to authenticated;

-- Comparison files uploaded before this change go to slot 1.
update public.project_files set slot = 1 where kind = 'comparison' and slot is null;
