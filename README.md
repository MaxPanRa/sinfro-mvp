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

## Despliegue en VPS (producción)

### Arquitectura del proxy

El VPS ya corre **Nginx Proxy Manager (NPM)**, que es el "portero" público y ocupa los puertos `80`, `81` (su UI) y `443`. Por eso **Caddy NO publica 80/443**: escucha solo HTTP en `:80` dentro de Docker y se une a la red compartida `proxy` para que NPM lo alcance. NPM termina el TLS (cert Let's Encrypt) y reenvía al contenedor `caddy`, que a su vez enruta:

```txt
Internet → NPM (443, TLS) → caddy:80 ┬→ /api/*  → api:8000  (quita el prefijo /api)
                                     ├→ /health → api:8000
                                     └→ /*      → web:80
```

### Setup inicial del VPS (una sola vez)

```bash
# 1. Clonar el repo en la ruta de despliegue
git clone https://github.com/maxpanra/sinfro-mvp.git /opt/docker/sinfro-mvp
cd /opt/docker/sinfro-mvp

# 2. Crear la red compartida con Nginx Proxy Manager
#    (el compose la declara como external: true, así que debe existir antes)
docker network create proxy
docker network connect proxy npm-npm-1   # nombre del contenedor de NPM
```

> El `.env` de producción NO se crea a mano: el workflow de GitHub Actions lo reescribe en cada deploy a partir de los *secrets*. El `.env` local nunca se sube.

### Deploy manual (lo mismo que hace GitHub Actions)

```bash
cd /opt/docker/sinfro-mvp
git fetch origin main
git reset --hard origin/main          # trae la última versión EXACTA de main
docker network create proxy 2>/dev/null || true
docker network connect proxy npm-npm-1 2>/dev/null || true
docker compose up -d --build
docker compose ps
```

> ⚠️ No corras `docker compose up` con archivos viejos en disco. Si no haces `git reset --hard origin/main` primero, el servidor usa código antiguo (ej. el conflicto de puerto 443 ya resuelto). Deja que el deploy de Actions, o estos comandos, sincronicen el repo.

### Operación diaria

```bash
docker compose ps                     # estado de los contenedores
docker compose logs -f caddy          # logs de un servicio (caddy/api/web/worker)
docker compose restart caddy          # reiniciar un servicio
docker compose down                   # apagar el stack
docker compose down --remove-orphans  # apagar + limpiar contenedores huérfanos
docker compose up -d --build          # levantar reconstruyendo imágenes
```

### Migraciones y seed en producción

```bash
docker compose exec api alembic upgrade head
docker compose exec api python -m app.scripts.seed_demo
```

### Diagnóstico (proxy / red / puertos)

```bash
# ¿Qué proceso ocupa 80/443?
sudo ss -ltnp '( sport = :443 or sport = :80 )'

# ¿Qué contenedor publica esos puertos? (debe ser solo npm-npm-1)
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E ':80->|:443->'

# ¿Caddy está en la red de NPM? (debe listar "proxy" además de "default")
docker inspect sinfro-mvp-caddy-1 --format '{{json .NetworkSettings.Networks}}'

# ¿NPM alcanza a Caddy? (debe devolver HTML)
docker exec npm-npm-1 wget -qO- http://caddy:80 | head
```

### Nginx Proxy Manager — Proxy Host

En la UI de NPM (`http://<IP_DEL_VPS>:81`) → **Proxy Hosts → Add Proxy Host**:

| Campo | Valor |
|---|---|
| Domain Names | `sinfro.lakeandmoss.dev` |
| Scheme | `http` |
| Forward Hostname | `caddy` (o `sinfro-mvp-caddy-1` si no resuelve) |
| Forward Port | `80` |
| Websockets Support | ✅ activado |
| SSL → Certificate | *Request a new SSL Certificate* (Let's Encrypt) + **Force SSL** |

### DNS

Registro **A** para el subdominio que apunta al VPS (no toques el `@` ni `www` si pertenecen a otro servidor):

| Type | Name | Content | TTL |
|---|---|---|---|
| A | `sinfro` | `207.244.252.152` (IP del VPS) | `60` |

Verifica la propagación antes de pedir el cert SSL en NPM:

```bash
nslookup sinfro.lakeandmoss.dev   # debe devolver la IP del VPS
```

### Secrets de GitHub Actions

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) usa el *environment* **`maxpanra-server`**. Configura estos secrets en **GitHub → Settings → Environments → maxpanra-server → Environment secrets**.

**Conexión SSH al VPS:**

| Secret | Descripción | Ejemplo |
|---|---|---|
| `VPS_HOST` | IP o dominio del VPS | `207.244.252.152` |
| `VPS_USER` | Usuario SSH | `root` |
| `VPS_SSH_KEY` | Clave **privada** completa (sin passphrase) | `-----BEGIN OPENSSH PRIVATE KEY-----`<br>`b3BlbnNzaC1rZXk...`<br>`-----END OPENSSH PRIVATE KEY-----` |
| `VPS_SSH_PORT` | Puerto SSH (opcional, default `22`) | `22` |
| `VPS_APP_PATH` | Ruta del repo en el VPS | `/opt/docker/sinfro-mvp` |

> Genera la clave con `ssh-keygen -t ed25519 -C "github-deploy-sinfro" -f deploy_key -N ""`. La **pública** (`deploy_key.pub`) va al VPS en `~/.ssh/authorized_keys`; la **privada** (`deploy_key`) va en el secret `VPS_SSH_KEY`.

**App / base de datos:**

| Secret | Descripción | Ejemplo |
|---|---|---|
| `APP_SECRET_KEY` | Clave de la app (32 bytes hex) | `openssl rand -hex 32` → `cdf5315d...d75663` |
| `JWT_SECRET_KEY` | Clave para firmar JWT (32 bytes hex) | `openssl rand -hex 32` → `ac5e105e...086de` |
| `POSTGRES_PASSWORD` | Contraseña de Postgres | `e6a10c71...215cd` |

**URLs públicas** (con NPM, todas bajo el mismo dominio; el API vive en `/api`):

| Secret | Descripción | Ejemplo |
|---|---|---|
| `PUBLIC_WEB_URL` | URL pública del frontend | `https://sinfro.lakeandmoss.dev` |
| `PUBLIC_API_URL` | URL pública del API | `https://sinfro.lakeandmoss.dev/api` |
| `VITE_API_URL` | Base del API que **se hornea en el build** del frontend | `https://sinfro.lakeandmoss.dev/api` |

**Google OAuth:**

| Secret | Descripción | Ejemplo |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de Google | `9538055...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Client Secret | `GOCSPX-xxxxxxxxxxxxxxxx` |
| `GOOGLE_REDIRECT_URI` | Callback (regístralo igual en Google Cloud Console) | `https://sinfro.lakeandmoss.dev/api/auth/google/callback` |

**SMTP (Hostinger):** El backend solo soporta STARTTLS, por eso puerto `587` y no `465`/SSL.

| Secret | Descripción | Ejemplo |
|---|---|---|
| `SMTP_HOST` | Servidor SMTP | `smtp.hostinger.com` |
| `SMTP_PORT` | Puerto (opcional, default `587`) | `587` |
| `SMTP_USERNAME` | Usuario = correo completo | `developer@maxpanra.xyz` |
| `SMTP_PASSWORD` | Contraseña del correo | `tu-contraseña-de-correo` |
| `SMTP_FROM_EMAIL` | Remitente (opcional, default `developer@maxpanra.xyz`) | `developer@maxpanra.xyz` |
| `SMTP_FROM_NAME` | Nombre del remitente (opcional, default `SinFro`) | `SinFro` |
| `SMTP_USE_TLS` | STARTTLS (opcional, default `true`) | `true` |

**Otros:**

| Secret | Descripción | Ejemplo |
|---|---|---|
| `CADDY_DOMAIN` | Dominio (legado: Caddy ahora escucha `:80`, NPM maneja el dominio/TLS; se sigue escribiendo al `.env` pero ya no condiciona el binding) | `sinfro.lakeandmoss.dev` |

### Solución de problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| `Bind for 0.0.0.0:443 failed: port is already allocated` | NPM ya usa el 443 y el VPS tiene código viejo con `ports: 443:443` | `git reset --hard origin/main` en el VPS y volver a `docker compose up -d` |
| `network proxy not found` | Falta la red compartida | `docker network create proxy && docker network connect proxy npm-npm-1` |
| `docker compose ps` vacío tras "ya corrió" | Stack apagado o `up` falló | `docker compose up -d` y revisar el error |
| NPM no resuelve `caddy` | Caddy no está en la red `proxy` | `docker network connect proxy sinfro-mvp-caddy-1` o `docker compose up -d` con el compose actualizado |
| Login/Google falla aunque el sitio cargue | `VITE_API_URL`/`GOOGLE_REDIRECT_URI` mal o vacíos | Configurar los secrets y redeployar (VITE_API_URL se hornea en el build) |

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
