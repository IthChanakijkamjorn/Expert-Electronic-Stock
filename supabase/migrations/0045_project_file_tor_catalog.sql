-- Project files can be TOR or catalog. Existing 'original' files stay as "other".
alter table public.project_files drop constraint if exists project_files_kind_check;
alter table public.project_files add constraint project_files_kind_check check (kind in ('original', 'comparison', 'tor', 'catalog'));
