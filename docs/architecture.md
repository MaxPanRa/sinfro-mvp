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
- ApiCredential (incluye `model`: modelo de IA elegido por proveedor)
- AiTaskAssignment (qué IA hace cada tarea)
- JobSource
- JobPosting
- JobEvaluation (score + reasons + gaps de la comparación con IA)
- JobRun

Las credenciales BYOK se cifran con `APP_SECRET_KEY`. El frontend recibe solo `maskedKey`.

## IA por tarea (BYOK)

Cada proveedor de IA conectado puede: (1) tener su API key, (2) elegir modelo, y
(3) asignarse a una tarea. Tareas: `cv_read` (Lectura de CV) y `cv_vs_job`
(Análisis CV vs vacante). **Exclusión mutua**: una IA hace máximo una tarea y una
tarea la hace máximo una IA (restricciones únicas en `ai_task_assignments`).

- Cliente: [`apps/api/app/core/ai.py`](../apps/api/app/core/ai.py). Proveedores:
  `opencode-go` (gateway `https://opencode.ai/zen/go/v1`, rutea OpenAI-compat
  `/chat/completions` o Anthropic `/messages` según el modelo), `openai`,
  `gemini`, `anthropic`.
- Endpoints: `GET /ai/providers`, `PUT /ai/config` (model/task con exclusión
  mutua), `POST /jobs/{id}/evaluate`. `/cv/analyze` usa la IA de `cv_read` con
  **fallback al análisis local** si falla.
- UI: selectores de modelo + tarea por proveedor en Conexiones (Settings).
  Íconos de proveedor en `apps/web/src/lib/providerIcons.tsx` (Lucide).

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
