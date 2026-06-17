# Architecture

```txt
sinfro.tudominio.com
        |
     Caddy
        |
  -----------------
  |               |
React App       FastAPI
                  |
             PostgreSQL
                  |
              Redis Queue
                  |
          Worker/Scheduler
```

## Web

React + Vite + TypeScript. Usa el diseno de Claude Design como base visual: dark SaaS, tokens CSS, sidebar, bandeja, settings BYOK, perfiles, sync runs y suscripciones.

Consume FastAPI mediante `src/lib/apiClient.ts`. Si el API no esta disponible, algunos endpoints vuelven a mocks para mantener el MVP usable.

## API

FastAPI modular con SQLAlchemy 2.x y Alembic. Modelos iniciales:

- User
- OAuthAccount
- UserTheme
- SubscriptionPlan
- UserSubscription
- Profile
- ApiCredential
- JobSource
- JobPosting
- JobEvaluation
- JobRun

Las credenciales BYOK se cifran con `APP_SECRET_KEY`. El frontend recibe solo `maskedKey`.

## Worker

Proceso Python separado. Escucha Redis en la cola `sync_jobs`, actualiza `JobRun` e inserta una vacante mock. Esta capa queda lista para llamar scrapers Python existentes del repo desktop.

## Auth

El MVP usa usuario demo. Google OAuth tiene variables, tabla `OAuthAccount` y endpoint placeholder. Para produccion debe emitir JWT o cookie segura con SameSite/HttpOnly/Secure.

## Subscriptions

Planes seed/mock desde backend:

- Free
- Pro BYOK
- Team BYOK

No hay pagos reales todavia; la estructura queda lista para conectar un proveedor.
