-- Replace the old pc/pcs unit with ชิ้น on products and make it the default.
update public.products set unit = 'ชิ้น' where lower(trim(unit)) in ('pc', 'pcs');
alter table public.products alter column unit set default 'ชิ้น';
