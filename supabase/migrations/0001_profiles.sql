-- Roles: admin manages users, manager edits data, staff records stock movements.
create type public.app_role as enum ('admin', 'manager', 'staff');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function public.current_role_name() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create policy "read own or admin" on public.profiles
  for select using (id = auth.uid() or public.current_role_name() = 'admin');

create policy "admin manages profiles" on public.profiles
  for all using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

-- Every new auth user gets a staff profile; promote the first admin manually.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Data API auto-exposure is off, so grant access explicitly (RLS still applies).
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update, insert, delete on public.profiles to authenticated;
