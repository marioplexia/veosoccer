-- Colores de cada equipo (para sus marcadores animados).
alter table tournament_teams
  add column color text check (color is null or color ~ '^#[0-9A-F]{6}$'),
  add column color2 text check (color2 is null or color2 ~ '^#[0-9A-F]{6}$');
