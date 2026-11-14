# Expert Electronic Back Office

Private stock-management app (Next.js + Supabase). Thai by default, English available.

## Setup
1. Create a Supabase project and run `supabase/migrations/0001_profiles.sql` in the SQL editor.
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
3. Create users in Supabase Auth, then promote the first admin:
   `update public.profiles set role = 'admin' where id = '<user id>';`
4. `npm install && npm run dev`
