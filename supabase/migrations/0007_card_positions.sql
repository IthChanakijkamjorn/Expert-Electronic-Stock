-- Manual ordering of organization and tower cards (new items go last).
alter table public.organizations
  add column position bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint;
alter table public.towers
  add column position bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint;

update public.organizations o set position = r.n
  from (select id, row_number() over (order by name) as n from public.organizations) r where r.id = o.id;
update public.towers t set position = r.n
  from (select id, row_number() over (partition by organization_id order by name) as n from public.towers) r where r.id = t.id;
