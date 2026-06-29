-- Safe migration for existing databases.
-- This file only adds the RPCs needed by the frontend.

drop function if exists public.listar_usuario_figuritas();

create or replace function public.listar_usuario_figuritas()
returns table (
  user_id bigint,
  figurita_id bigint,
  cantidad integer,
  veces_pedidas integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    uf.user_id,
    uf.figurita_id,
    uf.cantidad,
    uf.veces_pedidas,
    uf.created_at
  from public.usuario_figuritas uf
  order by uf.created_at asc, uf.user_id asc, uf.figurita_id asc;
$$;

drop function if exists public.listar_usuario_figuritas_por_usuario(bigint);

create or replace function public.listar_usuario_figuritas_por_usuario(
  p_user_id bigint
)
returns table (
  user_id bigint,
  figurita_id bigint,
  cantidad integer,
  veces_pedidas integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    uf.user_id,
    uf.figurita_id,
    uf.cantidad,
    uf.veces_pedidas,
    uf.created_at
  from public.usuario_figuritas uf
  where uf.user_id = p_user_id
  order by uf.created_at asc, uf.user_id asc, uf.figurita_id asc;
$$;

create or replace function public.listar_resumen_usuario_figuritas()
returns table (
  user_id bigint,
  figuritas_distintas integer
)
language sql
security definer
set search_path = public
as $$
  select
    uf.user_id,
    count(*)::integer as figuritas_distintas
  from public.usuario_figuritas uf
  where uf.cantidad > 0
  group by uf.user_id
  order by uf.user_id asc;
$$;

create or replace function public.listar_validaciones_secretas_pendientes()
returns table (
  id bigint,
  user_id bigint,
  figurita_id bigint,
  status text,
  created_at timestamptz,
  responded_at timestamptz,
  responded_by_user_id bigint
)
language sql
security definer
set search_path = public
as $$
  select
    vs.id,
    vs.user_id,
    vs.figurita_id,
    vs.status,
    vs.created_at,
    vs.responded_at,
    vs.responded_by_user_id
  from public.validaciones_secretas vs
  where vs.status = 'pending'
  order by vs.created_at asc, vs.id asc;
$$;

grant execute on function public.listar_usuario_figuritas() to anon, authenticated;
grant execute on function public.listar_usuario_figuritas_por_usuario(bigint) to anon, authenticated;
grant execute on function public.listar_resumen_usuario_figuritas() to anon, authenticated;
grant execute on function public.listar_validaciones_secretas_pendientes() to anon, authenticated;
