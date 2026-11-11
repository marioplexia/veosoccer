-- Resumen de un partido escrito por la IA (crónica + guion del video). Uno por partido; solo el dueño del torneo.
create table match_summaries (
  fixture_id uuid primary key references fixtures(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) < 12000),
  created_at timestamptz not null default now()
);
create index on match_summaries (tournament_id);

alter table match_summaries enable row level security;
create policy match_summaries_all on match_summaries for all
  using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));
