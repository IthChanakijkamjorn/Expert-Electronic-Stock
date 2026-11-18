-- Separates original project documents from the edited/highlighted comparison (คู่เทียบ) documents.
alter table public.project_files add column kind text not null default 'original' check (kind in ('original', 'comparison'));
