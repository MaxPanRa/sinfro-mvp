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

Despues implementar intercambio de code por tokens, guardar `OAuthAccount` y emitir cookie/JWT.

## 6. Pagos

La tabla de planes y suscripcion existe. El siguiente paso es agregar provider externo, webhooks y reconciliacion de estado.
