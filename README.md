# SinFro / Job Radar MVP

Monorepo MVP para la version web de SinFro / Job Radar.

## Estructura

```txt
apps/web      React + Vite + TypeScript
apps/api      FastAPI + SQLAlchemy + Alembic
apps/worker   Worker Python para cola sync_jobs
infra/caddy   Reverse proxy Caddy
docs          Arquitectura y deployment
```

## Arranque local con Docker

```bash
cp .env.example .env
docker compose config
docker compose up --build
```

Abrir:

- Web: http://localhost:5173
- API: http://localhost:8000
- Healthcheck: http://localhost:8000/health

## Migraciones

El servicio `api` ejecuta:

```bash
alembic upgrade head
```

Tambien puedes correrlo manualmente:

```bash
docker compose run --rm api alembic upgrade head
```

## Datos demo dinamicos

El seed idempotente puede ejecutarse cuantas veces quieras sin duplicar vacantes, perfiles, planes o credenciales:

```bash
docker compose exec api python -m app.scripts.seed_demo
```

Tambien existe un endpoint solo para entorno local:

```bash
curl -X POST http://localhost:8000/dev/seed-demo
```

El seed llena PostgreSQL con usuario demo, tema, planes, suscripcion, perfiles/CV, credenciales BYOK cifradas, fuentes, vacantes, evaluaciones IA y sync runs.

## Desarrollo sin Docker

Frontend:

```bash
cd apps/web
npm install
npm run dev
```

API:

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Worker:

```bash
cd apps/worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m worker.main
```

## Implementado

- Dashboard usable como primera pantalla.
- Login demo placeholder y estructura para Google OAuth.
- Temas/acento/densidad por usuario.
- Bandeja de vacantes, detalle, filtros, estados y tabs.
- Settings BYOK con cifrado backend y mascara de keys.
- Planes Free, Pro BYOK y Team BYOK desde backend.
- Sync manual que encola trabajo en Redis.
- Worker separado que procesa `sync_jobs` e inserta una vacante mock.
- Postgres persistente, Redis, Caddy, Docker Compose.

## Placeholders MVP

- Google OAuth real no intercambia tokens todavia.
- Suscripciones no integran Stripe/MercadoPago.
- Scrapers reales del desktop no estan conectados.
- Auth usa usuario demo local.

## Variables Google OAuth

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

El endpoint `/auth/google/start` documenta el estado placeholder. El siguiente paso es generar la URL de consentimiento, manejar `/auth/google/callback`, crear o asociar `OAuthAccount`, y emitir JWT o cookie segura.
