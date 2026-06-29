create or replace function public.listar_consumo_validacion_figuritas()
returns table (
  user_id bigint,
  figurita_id bigint,
  cantidad integer
)
language sql
security definer
set search_path = public
as $$
  with usuario_counts as (
    select
      uf.user_id,
      uf.figurita_id,
      sum(uf.cantidad)::integer as cantidad
    from public.usuario_figuritas uf
    where uf.cantidad > 0
    group by uf.user_id, uf.figurita_id
  ),
  intercambio_counts as (
    select
      case
        when ii.side = 'offer' then i.from_user_id
        when ii.side = 'request' then i.to_user_id
      end as user_id,
      ii.figurita_id,
      count(*)::integer as cantidad
    from public.intercambios i
    join public.intercambio_items ii on ii.intercambio_id = i.id
    where i.status in ('pending', 'accepted')
      and ii.side in ('offer', 'request')
    group by 1, ii.figurita_id
  ),
  combined as (
    select * from usuario_counts
    union all
    select * from intercambio_counts
  )
  select
    c.user_id,
    c.figurita_id,
    sum(c.cantidad)::integer as cantidad
  from combined c
  where c.user_id is not null
  group by c.user_id, c.figurita_id
  order by c.user_id asc, c.figurita_id asc;
$$;

grant execute on function public.listar_consumo_validacion_figuritas() to anon, authenticated;
