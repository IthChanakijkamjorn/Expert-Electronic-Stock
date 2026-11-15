-- Show the login username in history when no full name is set.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

update public.profiles p
set full_name = split_part(u.email, '@', 1)
from auth.users u
where u.id = p.id and (p.full_name is null or p.full_name = '');
