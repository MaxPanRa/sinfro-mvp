# Deployment VPS

## 1. DNS

Crear un registro A:

```txt
sinfro.tudominio.com -> IP_DEL_VPS
```

## 2. Preparar VPS

Instalar Docker y Docker Compose plugin.

```bash
git clone <repo> sinfro-mvp
cd sinfro-mvp
cp .env.example .env
```

Editar `.env`:

```env
CADDY_DOMAIN=sinfro.tudominio.com
PUBLIC_WEB_URL=https://sinfro.tudominio.com
PUBLIC_API_URL=https://sinfro.tudominio.com/api
VITE_API_URL=https://sinfro.tudominio.com/api
APP_SECRET_KEY=<random-largo>
JWT_SECRET_KEY=<random-largo>
POSTGRES_PASSWORD=<password-fuerte>
SMTP_HOST=<host-smtp>
SMTP_PORT=587
SMTP_USERNAME=developer@maxpanra.xyz
SMTP_PASSWORD=<password-smtp>
SMTP_FROM_EMAIL=developer@maxpanra.xyz
SMTP_FROM_NAME=SinFro
SMTP_USE_TLS=true
```

## 3. Levantar

```bash
docker compose config
docker compose up -d --build
docker compose logs -f api
```

Caddy emitira certificados TLS automaticamente si el dominio apunta al VPS y los puertos 80/443 estan abiertos.

## 4. Migraciones

El contenedor `api` ejecuta `alembic upgrade head` al iniciar. Para correr manualmente:

```bash
docker compose run --rm api alembic upgrade head
```

## 5. Google OAuth real

En Google Cloud Console:

1. Crear OAuth Client Web.
2. Agregar redirect URI: `https://sinfro.tudominio.com/api/auth/google/callback`.
3. Configurar:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://sinfro.tudominio.com/api/auth/google/callback
```

La app ya intercambia el `code`, guarda `OAuthAccount` y pide permiso `gmail.send` para enviar resumenes a la misma cuenta conectada.

## 6. Pagos

La tabla de planes y suscripcion existe. El siguiente paso es agregar provider externo, webhooks y reconciliacion de estado.

## 7. GitHub Actions

El workflow `.github/workflows/deploy.yml` genera `.env` en el VPS desde GitHub Secrets y ejecuta `docker compose up -d --build`.

Secrets requeridos:

```txt
VPS_HOST
VPS_USER
VPS_SSH_KEY
VPS_SSH_PORT
VPS_APP_PATH
APP_SECRET_KEY
JWT_SECRET_KEY
POSTGRES_PASSWORD
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
PUBLIC_WEB_URL
PUBLIC_API_URL
VITE_API_URL
CADDY_DOMAIN
SMTP_HOST
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
SMTP_FROM_EMAIL
SMTP_FROM_NAME
SMTP_USE_TLS
```

`VPS_SSH_PORT` puede ser `22` si no cambiaste el puerto SSH.
`VPS_APP_PATH` debe apuntar a la carpeta del repo en el servidor, por ejemplo `/opt/sinfro-mvp`.
