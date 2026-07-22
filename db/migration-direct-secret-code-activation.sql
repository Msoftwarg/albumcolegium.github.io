-- Los códigos correctos acreditan la figurita inmediatamente.
-- Se conserva el cuarto parámetro por compatibilidad con clientes anteriores,
-- pero ya no se usa para consultar ni limitar contra una hoja de cálculo.
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
  v_lamina_path text;
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

  select coalesce(u.lamina_path, '')
  into v_lamina_path
  from public.figuritas f
  join public.usuarios u on u.id = f.user_id
  where f.id = p_figurita_id;

  if coalesce(v_lamina_path, '') <> '' then
    update public.figuritas
    set foto_path = coalesce(nullif(foto_path, ''), public.strip_diacritics(v_lamina_path))
    where id = p_figurita_id;
  end if;

  insert into public.usuario_figuritas as uf (user_id, figurita_id, cantidad, created_at)
  values (p_user_id, p_figurita_id, 1, now())
  on conflict (user_id, figurita_id)
  do update set
    cantidad = uf.cantidad + excluded.cantidad,
    created_at = now();

  return 'accepted';
end;
$$;

grant execute on function public.activar_figurita_con_codigo(bigint, bigint, text, integer)
  to anon, authenticated;
