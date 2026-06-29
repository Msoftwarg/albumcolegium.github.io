alter table public.usuario_figuritas
  add column if not exists veces_pedidas integer;

update public.usuario_figuritas
set veces_pedidas = 0
where veces_pedidas is null;

alter table public.usuario_figuritas
  alter column veces_pedidas set default 0,
  alter column veces_pedidas set not null;

do $$
begin
  alter table public.usuario_figuritas
    add constraint usuario_figuritas_veces_pedidas_check check (veces_pedidas >= 0);
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.set_usuario_figurita_qty(
  p_user_id bigint,
  p_figurita_id bigint,
  p_qty integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty < 0 then
    raise exception 'cantidad invalida';
  end if;

  if p_qty = 0 then
    update public.usuario_figuritas
    set cantidad = 0,
        created_at = now()
    where user_id = p_user_id
      and figurita_id = p_figurita_id
      and veces_pedidas > 0;

    delete from public.usuario_figuritas
    where user_id = p_user_id
      and figurita_id = p_figurita_id
      and veces_pedidas = 0;
    return;
  end if;

  insert into public.usuario_figuritas (user_id, figurita_id, cantidad, created_at)
  values (p_user_id, p_figurita_id, p_qty, now())
  on conflict (user_id, figurita_id)
  do update set
    cantidad = excluded.cantidad,
    created_at = now();
end;
$$;

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

drop function if exists public.activar_figurita_con_codigo(bigint, bigint, text);
drop function if exists public.activar_figurita_con_codigo(bigint, bigint, text, integer);

create or replace function public.activar_figurita_con_codigo(
  p_user_id bigint,
  p_figurita_id bigint,
  p_codigo text,
  p_max_veces_pedidas integer default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_has_pending boolean;
  v_veces_pedidas integer;
begin
  select f.secret_code
  into v_secret
  from public.figuritas f
  where f.id = p_figurita_id;

  if not found then
    raise exception 'figurita no encontrada';
  end if;

  if upper(regexp_replace(coalesce(v_secret, ''), '[^A-Za-z0-9]', '', 'g')) <>
     upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g')) then
    raise exception 'codigo incorrecto';
  end if;

  select exists(
    select 1
    from public.validaciones_secretas
    where user_id = p_user_id
      and figurita_id = p_figurita_id
      and status = 'pending'
  )
  into v_has_pending;

  if v_has_pending then
    raise exception 'ya pendiente';
  end if;

  if coalesce(p_max_veces_pedidas, 0) <= 0 then
    raise exception 'sin cupo en hoja';
  end if;

  insert into public.usuario_figuritas (user_id, figurita_id, cantidad, veces_pedidas, created_at)
  values (p_user_id, p_figurita_id, 0, 0, now())
  on conflict (user_id, figurita_id) do nothing;

  select veces_pedidas
  into v_veces_pedidas
  from public.usuario_figuritas
  where user_id = p_user_id
    and figurita_id = p_figurita_id
  for update;

  if coalesce(v_veces_pedidas, 0) >= p_max_veces_pedidas then
    raise exception 'sin cupo en hoja';
  end if;

  insert into public.validaciones_secretas (
    user_id,
    figurita_id,
    status,
    created_at
  )
  values (
    p_user_id,
    p_figurita_id,
    'pending',
    now()
  );

  update public.usuario_figuritas
  set veces_pedidas = veces_pedidas + 1,
      created_at = now()
  where user_id = p_user_id
    and figurita_id = p_figurita_id;

  return 'pending';
end;
$$;

grant execute on function public.set_usuario_figurita_qty(bigint, bigint, integer) to anon, authenticated;
grant execute on function public.listar_usuario_figuritas() to anon, authenticated;
grant execute on function public.listar_usuario_figuritas_por_usuario(bigint) to anon, authenticated;
grant execute on function public.activar_figurita_con_codigo(bigint, bigint, text, integer) to anon, authenticated;
