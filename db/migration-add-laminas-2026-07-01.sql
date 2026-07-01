-- Add four new collectable laminas without changing existing sticker ids.

select setval(
  pg_get_serial_sequence('public.usuarios', 'id'),
  greatest(coalesce((select max(id) from public.usuarios), 0), 1),
  coalesce((select max(id) from public.usuarios), 0) > 0
);

insert into public.usuarios (name, login_name, login_password, lamina_path)
values
  ('Rocky', 'Rocky', 'Rocky', 'laminas/Rocky.png'),
  ('Robotito', 'Robotito', 'Robotito', 'laminas/Robotito.png'),
  ('Julio Iglesias', 'Julio Iglesias', 'Julio Iglesias', 'laminas/Julio Iglesias.png'),
  ('Elias Lescano', 'Elias Lescano', 'Elias Lescano', 'laminas/Elias Lescano.png')
on conflict (login_name) do update set
  name = excluded.name,
  login_password = excluded.login_password,
  lamina_path = excluded.lamina_path;

select setval(
  pg_get_serial_sequence('public.usuarios', 'id'),
  greatest(coalesce((select max(id) from public.usuarios), 0), 1),
  coalesce((select max(id) from public.usuarios), 0) > 0
);

select setval(
  pg_get_serial_sequence('public.figuritas', 'id'),
  greatest(coalesce((select max(id) from public.figuritas), 0), 1),
  coalesce((select max(id) from public.figuritas), 0) > 0
);

with nuevas_laminas(nombre, lamina_path, ord) as (
  values
    ('Rocky', 'laminas/Rocky.png', 1),
    ('Robotito', 'laminas/Robotito.png', 2),
    ('Julio Iglesias', 'laminas/Julio Iglesias.png', 3),
    ('Elias Lescano', 'laminas/Elias Lescano.png', 4)
)
insert into public.figuritas (user_id, foto_path)
select u.id, nl.lamina_path
from nuevas_laminas nl
join public.usuarios u on u.login_name = nl.nombre
where not exists (
  select 1
  from public.figuritas f
  where f.user_id = u.id
)
order by nl.ord;

with nuevas_laminas(nombre, lamina_path) as (
  values
    ('Rocky', 'laminas/Rocky.png'),
    ('Robotito', 'laminas/Robotito.png'),
    ('Julio Iglesias', 'laminas/Julio Iglesias.png'),
    ('Elias Lescano', 'laminas/Elias Lescano.png')
)
update public.figuritas f
set foto_path = nl.lamina_path
from public.usuarios u
join nuevas_laminas nl on nl.nombre = u.login_name
where f.user_id = u.id
  and f.foto_path is distinct from nl.lamina_path;

select setval(
  pg_get_serial_sequence('public.figuritas', 'id'),
  greatest(coalesce((select max(id) from public.figuritas), 0), 1),
  coalesce((select max(id) from public.figuritas), 0) > 0
);
