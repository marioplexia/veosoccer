-- Transmisión en vivo: destino de Facebook, patrocinadores y registro de transmisiones.

-- Destino RTMPS de Facebook (URL del servidor + clave de transmisión). Solo el dueño la ve.
create table broadcast_settings (
  tournament_id uuid primary key references tournaments(id) on delete cascade,
  rtmp_url text not null default 'rtmps://live-api-s.facebook.com:443/rtmp/'
    check (rtmp_url ~ '^rtmps?://[A-Za-z0-9.:_/-]{3,200}$'),
  stream_key text check (stream_key is null or stream_key ~ '^[A-Za-z0-9_?&=.:-]{8,300}$'),
  ad_every_minutes integer not null default 8 check (ad_every_minutes between 2 and 45),
  updated_at timestamptz not null default now()
);

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  image_path text check (image_path is null or char_length(image_path) <= 300),
  created_at timestamptz not null default now()
);
create index on sponsors (tournament_id);

create table broadcasts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  fixture_id uuid references fixtures(id) on delete set null,
  room text not null,
  egress_id text,
  status text not null default 'starting' check (status in ('starting', 'live', 'ended', 'failed')),
  error text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on broadcasts (tournament_id, started_at desc);

alter table broadcast_settings enable row level security;
alter table sponsors enable row level security;
alter table broadcasts enable row level security;
create policy bs_all on broadcast_settings for all using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));
create policy sponsors_all on sponsors for all using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));
create policy broadcasts_all on broadcasts for all using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));
