-- Escudos de equipos y plantillas de jugadores (con foto), guardados en el torneo.
alter table tournament_teams add column logo_path text check (logo_path is null or char_length(logo_path) <= 300);

create table players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  number integer check (number between 0 and 99),
  photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  created_at timestamptz not null default now(),
  -- el jugador debe ser de un equipo de ESTE torneo
  foreign key (team_id, tournament_id) references tournament_teams (id, tournament_id) on delete cascade
);
create index on players (team_id);
create index on players (tournament_id);

alter table players enable row level security;
create policy players_all on players for all
  using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));

-- Bucket para escudos y fotos: lectura pública (se usan en gráficos), escritura solo del dueño.
-- Ruta obligatoria: <id-del-torneo>/<archivo>. Las imágenes se reducen en el navegador antes de subirlas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-media', 'team-media', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy team_media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'team-media'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_tournament_owner(((storage.foldername(name))[1])::uuid) else false end
  );
create policy team_media_update on storage.objects for update to authenticated
  using (
    bucket_id = 'team-media'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_tournament_owner(((storage.foldername(name))[1])::uuid) else false end
  );
create policy team_media_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'team-media'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_tournament_owner(((storage.foldername(name))[1])::uuid) else false end
  );
