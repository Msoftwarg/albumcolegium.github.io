# albumcolegium.github.io

## Base de datos

- Esquema SQL: `db/schema.sql`
- Seed inicial: `db/seed.sql`
- Generador del seed desde `laminas/*.png`: `db/generate-seed.mjs`

## Frontend

- La lógica compartida ahora vive en [app.js](/Users/martin_sztajn/Desktop/albumcolegium.github.io/app.js).
- `index.html` espera un cliente de Supabase cargado por CDN.

## Para dejarlo compartido

1. Crear un proyecto en Supabase.
2. Ejecutar `db/schema.sql`.
3. Ejecutar `db/seed.sql`.
4. Configurar la URL y la `anon key` de Supabase en [app.js](/Users/martin_sztajn/Desktop/albumcolegium.github.io/app.js).

Los usuarios quedan autenticados con `login_name` y `login_password`. En el seed generado desde `laminas/*.png`, ambos salen del nombre del archivo sin `.png` ni tildes, y `lamina_path` apunta a la imagen real.
La tabla `usuarios` ya no usa `role` ni `pais_id`: ahora solo guarda `name`, `login_name`, `login_password` y `lamina_path`.

Cuando se ingresa un código, la función `activar_figurita_con_codigo` ya no acredita la figurita de inmediato: crea una fila en `validaciones_secretas` con estado `pending`. En el álbum, esa figurita queda marcada como `Pendiente de validación` hasta que alguien la aprueba desde la vista oculta. Cuando se aprueba, `aprobar_validacion_secreta` agrega la figurita al álbum del usuario y copia la imagen a `figuritas.foto_path` si todavía estaba vacía.

El frontend carga el estado del álbum y las pendientes con RPCs `listar_usuario_figuritas` y `listar_validaciones_secretas_pendientes`, para no depender de `select` directos sobre tablas que pueden estar restringidas en Supabase. Si ya tenés datos cargados, usá [db/migration-validation-rpc.sql](/Users/martin_sztajn/Desktop/albumcolegium.github.io/db/migration-validation-rpc.sql) y [db/migration-trade-offer-reservation.sql](/Users/martin_sztajn/Desktop/albumcolegium.github.io/db/migration-trade-offer-reservation.sql) en vez de correr todo `db/schema.sql`.

Si necesitás ver los códigos secretos generados por la DB, corré en el SQL Editor:

```sql
select figurita_id, nombre, secret_code
from public.codigos_secretos
order by figurita_id;
```

Para revisar las solicitudes pendientes y aprobarlas manualmente:

```sql
select id, user_id, figurita_id, status, created_at
from public.validaciones_secretas
where status = 'pending'
order by created_at;

select public.aprobar_validacion_secreta(123, 1);
select public.rechazar_validacion_secreta(123, 1);
```

Para configurar un código desde backend:

```sql
select public.configurar_codigo_secreto(42, 'MI-CODIGO');
```

Si dejás el código vacío, la función conserva el código actual de esa figurita.

La vista oculta del frontend usa `codigos_secretos` y se habilita con la clave `aguantecolegium`. Se deja `codigos_sectretos` como alias compatible. Debajo de la tabla de solicitudes pendientes hay un botón `Correr` que toma la hoja fija `Repartidos`, lee `Usuario` desde la columna `B` desde la fila `1` y `Lamina` desde la columna `F` desde la fila `1`, y aprueba solo las validaciones que existan en esa hoja. Las que no aparecen quedan pendientes.

Con eso, `usuarios`, `figuritas`, `usuario_figuritas`, `intercambios`, `mensajes` y `comentarios` quedan sincronizados entre usuarios.
