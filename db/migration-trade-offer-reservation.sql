create or replace function public.crear_intercambio(
  p_from_user_id bigint,
  p_to_user_id bigint,
  p_msg text default null,
  p_offer_ids bigint[] default '{}'::bigint[],
  p_request_ids bigint[] default '{}'::bigint[]
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intercambio_id bigint;
  v_figid bigint;
  v_blocked_offer_ids bigint[];
begin
  perform 1
  from public.usuarios
  where id = p_from_user_id
  for update;

  select coalesce(array_agg(distinct offered.fig_id), '{}'::bigint[])
  into v_blocked_offer_ids
  from unnest(coalesce(p_offer_ids, '{}'::bigint[])) as offered(fig_id)
  where exists (
    select 1
    from public.intercambios i
    join public.intercambio_items ii on ii.intercambio_id = i.id
    where i.from_user_id = p_from_user_id
      and i.status = 'pending'
      and ii.side = 'offer'
      and ii.figurita_id = offered.fig_id
  );

  if array_length(v_blocked_offer_ids, 1) is not null then
    raise exception 'figurita ya comprometida en intercambio pendiente';
  end if;

  insert into public.intercambios (from_user_id, to_user_id, msg, status, created_at)
  values (p_from_user_id, p_to_user_id, p_msg, 'pending', now())
  returning id into v_intercambio_id;

  foreach v_figid in array coalesce(p_offer_ids, '{}'::bigint[]) loop
    insert into public.intercambio_items (intercambio_id, figurita_id, side, created_at)
    values (v_intercambio_id, v_figid, 'offer', now());
  end loop;

  foreach v_figid in array coalesce(p_request_ids, '{}'::bigint[]) loop
    insert into public.intercambio_items (intercambio_id, figurita_id, side, created_at)
    values (v_intercambio_id, v_figid, 'request', now());
  end loop;

  return v_intercambio_id;
end;
$$;

grant execute on function public.crear_intercambio(bigint, bigint, text, bigint[], bigint[]) to anon, authenticated;
