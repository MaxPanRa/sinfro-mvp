# Entorno local (Docker + Vite)

> **Para el siguiente agente / sesión:** TODO el stack está dockerizado vía
> [`docker-compose.yml`](../docker-compose.yml) en la raíz del repo. El único
> servicio que el dev (Max) prefiere correr **fuera** de Docker, desde VS Code,
> es **`web`** (Vite dev server). El resto (api, worker, postgres, redis, caddy)
> corre en contenedores.

## Servicios

| Servicio  | Imagen / build        | Puertos (host→cont.) | Notas |
|-----------|-----------------------|----------------------|-------|
| `postgres`| postgres:16-alpine    | `5432:5432`          | DB principal. User/db/pass por defecto: `sinfro`/`sinfro`/`sinfro`. Volumen `postgres_data`. |
| `redis`   | redis:7-alpine        | `6379:6379`          | Cola `sync_jobs` entre api y worker. |
| `api`     | build `apps/api`      | `8000:8000`          | FastAPI + Uvicorn. **Aplica migraciones Alembic al arrancar** (ver abajo). |
| `worker`  | build `apps/worker`   | —                    | Proceso Python; escucha Redis y hace el sync de vacantes + resúmenes. |
| `web`     | build `apps/web`      | `5173:80`            | Build de producción servido por nginx. **En local NO se usa**: Max corre Vite desde VS Code. |
| `caddy`   | caddy:2-alpine        | `80:80`, `443:443`   | Reverse proxy (producción). Usa red externa `proxy`. |

Nombres de contenedor reales: `sinfro-mvp-api-1`, `sinfro-mvp-worker-1`,
`sinfro-mvp-postgres-1`, `sinfro-mvp-redis-1`, `sinfro-mvp-web-1`,
`sinfro-mvp-caddy-1`.

## Web: se corre desde VS Code en local

El contenedor `web` existe (para producción), pero en desarrollo local Max lo
deja detenido y corre el dev server de Vite a mano:

```bash
cd apps/web
npm install   # solo la primera vez
npm run dev   # Vite en http://localhost:5173 (o 5174 si 5173 está ocupado)
```

El `apiClient` apunta a `VITE_API_URL` (default `http://localhost:8000`), que es
el contenedor `api`. El CORS del API ya permite `localhost:5173` y `localhost:5174`
(ver [`apps/api/app/main.py`](../apps/api/app/main.py), `allow_origins`).

> Si levantas `docker compose up`, el contenedor `web` (puerto 5173) chocaría con
> el Vite local. Corre uno u otro, no ambos en el mismo puerto.

## Migraciones de base de datos (Alembic)

**No se corren a mano normalmente.** El contenedor `api` ejecuta esto en su
`command` de arranque (ver `docker-compose.yml`):

```sh
sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"
```

Por eso, tras cambiar modelos o agregar una migración, basta con **reconstruir
el contenedor api** y la migración se aplica sola:

```bash
docker compose up -d --build api
docker compose logs api --tail 30   # verifica "Running upgrade ... -> ..."
```

### Por qué reconstruir (no solo reiniciar)

Las migraciones se **hornean en la imagen** al build. Un contenedor `api` viejo
no contiene los archivos de migración nuevos del host, así que `alembic upgrade`
dentro de él no vería la migración. Hay que `--build`.

### Correr Alembic manualmente (alternativa)

El ejecutable `alembic` puede no estar en el PATH de Windows aunque el paquete
esté instalado. Invócalo como módulo, apuntando al Postgres dockerizado
(`localhost:5432`):

```bash
cd apps/api
python -m alembic upgrade head
```

Requiere que el contenedor `postgres` esté arriba y que el Python local tenga
`alembic` + `psycopg`. La vía Docker de arriba es la recomendada.

## Comandos útiles

```bash
docker compose ps                       # estado de contenedores
docker compose logs -f api              # logs del API en vivo
docker compose up -d --build api worker # reconstruir backend tras cambios
docker compose restart api              # reinicio rápido (sin rebuild)
docker compose exec postgres psql -U sinfro -d sinfro   # consola SQL
```

## Estado de migraciones

- `0001_initial` … `0004_job_metadata`: esquema base.
- `0005_ai_task_assignments`: agrega la columna `api_credentials.model` y la
  tabla `ai_task_assignments` (asignación de IA por tarea, ver
  [architecture.md](architecture.md) → IA por tarea). **Aplicada.**
