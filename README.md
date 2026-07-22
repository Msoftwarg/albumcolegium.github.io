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

Cuando se ingresa un código correcto, `activar_figurita_con_codigo` agrega la figurita directamente al álbum y devuelve `accepted`. No consulta Excel, no crea una validación pendiente y no requiere confirmación manual. Para actualizar una base ya instalada, ejecutá `db/migration-direct-secret-code-activation.sql`.

El frontend carga el estado del álbum con el RPC `listar_usuario_figuritas`, para no depender de `select` directos sobre tablas que pueden estar restringidas en Supabase. Las funciones de validación se conservan solamente para procesar datos pendientes que pudieran existir de la versión anterior. Si ya tenés datos cargados, aplicá también [db/migration-direct-secret-code-activation.sql](/Users/martin_sztajn/Desktop/albumcolegium.github.io/db/migration-direct-secret-code-activation.sql).

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

La vista oculta del frontend usa `codigos_secretos` y se habilita con la clave `aguantecolegium`. Se deja `codigos_sectretos` como alias compatible. La sección de solicitudes pendientes queda disponible solo para datos heredados; las activaciones nuevas no pasan por ella ni consultan la hoja `Repartidos`.

Con eso, `usuarios`, `figuritas`, `usuario_figuritas`, `intercambios`, `mensajes` y `comentarios` quedan sincronizados entre usuarios.
