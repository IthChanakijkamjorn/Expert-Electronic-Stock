-- Failed sign-ins, used to lock an account for 15 minutes after 5 wrong tries. Only the server (service role) can touch it.
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  identifier text not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_idx on public.login_attempts (identifier, at desc);
alter table public.login_attempts enable row level security;
