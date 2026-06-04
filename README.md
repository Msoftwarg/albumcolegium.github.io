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

Cuando se activa una figurita, la función `activar_figurita_con_codigo` copia esa ruta a `figuritas.foto_path` si todavía estaba vacía. La tarjeta solo muestra la imagen cuando la figurita tiene cantidad activa; si no, conserva las iniciales.

Si necesitás ver los códigos secretos generados por la DB, corré en el SQL Editor:

```sql
select id, secret_code
from public.figuritas
order by id;
```

La vista oculta del frontend usa `codigos_secretos` y se habilita con la clave `aguantecolegium`. Se deja `codigos_sectretos` como alias compatible.

Con eso, `usuarios`, `figuritas`, `usuario_figuritas`, `intercambios`, `mensajes` y `comentarios` quedan sincronizados entre usuarios.
