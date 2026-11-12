# ADR LOC-0006 (frontend) — CI/CD GitHub Actions + imagen Docker (nginx) + config en runtime

**Estado:** Aceptado
**Fecha:** 2026-06-01

## Contexto

El frontend admin/portales es un **SPA estático** (`ssr: false` — ver [ADR 0003 SPA mode](loc-0003-spa-mode.md)), construido con pnpm y Nuxt 4. Falta el soporte de integración y publicación que el resto del ecosistema ya tiene:

- El backend publica imágenes Docker (alpine + debian) vía GitHub Actions en `release: published` → Docker Hub.
- El landing `centro-optico-vicente-web` sigue el mismo patrón (nginx sirviendo estáticos).
- La infra del hub ([ADR 0003 infra cross-stack](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0003-infrastructure.md)) ya reserva la imagen `fenixcoreenterprises/optibienestar-360-frontend` en Docker Hub y la sirve detrás de Traefik.

Restricción adicional: al ser SPA estático **no hay servidor Nitro** que lea variables de entorno en runtime, pero la URL del backend (`NUXT_PUBLIC_API_BASE_URL`) **debe definirse por entorno sin reconstruir la imagen**.

## Decisión

### 1. CI/CD en GitHub Actions (espejo del backend)

Dos workflows en `.github/workflows/`, alineados con el patrón del backend y del landing:

- **`ci.yaml`** — en push/PR a `main` (con `paths-ignore` de `**/*.md`, `.ai/**`, `LICENSE`): `pnpm install --frozen-lockfile` → `typecheck` → `generate`, y luego una matriz `[alpine, debian]` que construye la imagen y corre smoke tests del SPA. **No publica.**
- **`publish.yaml`** — en `release: published` (+ `workflow_dispatch`): build+typecheck, gate `check-secrets-dhr`, y push de ambas imágenes a Docker Hub.

GitHub Actions + Docker Hub se usan en su **free tier permanente**, coherente con [ADR 0004 only free tools](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0004-only-free-tools.md).

### 2. Imagen Docker: multi-stage build → nginx

`docker/alpine.Dockerfile` y `docker/debian.Dockerfile`, ambos en dos etapas:

1. **build:** `node:<v>` + corepack/pnpm → `pnpm install` (con cache mount) → `pnpm generate` (salida en `.output/public/`).
2. **serve:** `nginx:<v>` que copia los estáticos. `default.conf` aplica: fallback SPA (`try_files $uri $uri.html $uri/index.html /index.html`), `/_nuxt/` con cache inmutable de 1 año, HTML con `no-cache`, y `absolute_redirect off` (para no filtrar el puerto del upstream detrás de Traefik).

Tags publicados (consistentes con el landing): `:alpine`, `:<tag>-alpine`, `:latest`, `:<tag>`.

### 3. Configuración inyectada en runtime (no horneada)

La URL del backend **no se hornea en el bundle JS**. En su lugar:

1. La imagen declara un **default de TEST** en la etapa de servido:
   `ENV NUXT_PUBLIC_API_BASE_URL="https://api-test.centroopticovicente.com"` — un contenedor sin configurar **nunca golpea producción**.
2. Al arrancar, `docker/docker-entrypoint.d/40-render-runtime-config.sh` (lo ejecuta el entrypoint oficial de nginx) escribe `/config.js` con `window.__APP_CONFIG__ = { API_BASE_URL: "<env>" }`. Se sirve con `Cache-Control: no-store`.
3. El plugin cliente `app/plugins/00.runtime-config.client.ts` copia ese valor a `runtimeConfig.public.apiBaseUrl`, que consumen `useApi` y el store `auth`.

Resultado: **una sola imagen sirve cualquier entorno**; la URL se define con `-e NUXT_PUBLIC_API_BASE_URL=...` en el contenedor (modelo 12-factor) y se aplica con un reinicio, sin rebuild.

### 4. Proxy de la API en el mismo origen (opcional, `API_PROXY_UPSTREAM`)

El SPA y la API viven en orígenes distintos (`optibienestar360.…` vs `api.…`). Como cada llamada autenticada lleva `Authorization`, el navegador manda un preflight `OPTIONS` antes de cada request. El navegador guarda ese preflight **por URL**, así que cada UUID o query nuevo lo vuelve a pagar. Un HAR de una sesión admin normal mostró ~35 `OPTIONS` en 87 requests, de ~200 ms cada uno.

Si el contenedor recibe `API_PROXY_UPSTREAM` (`scheme://host[:puerto]`, sin path):

1. El mismo `40-render-runtime-config.sh` escribe `/etc/nginx/api-proxy/api.conf`, que `default.conf` incluye. Contiene un `location ^~ /api/` que quita el prefijo y reenvía al upstream. Usa `resolver` + variable para que Nginx arranque aunque el backend no esté levantado. Agrega la IP del cliente a `X-Forwarded-For` (el backend la resuelve con forward headers `NATIVE`), acepta cuerpos de hasta 25 MB y tiene un timeout de 120 s para los reportes.
2. `config.js` publica `API_BASE_URL: "/api"`, que tiene prioridad sobre `NUXT_PUBLIC_API_BASE_URL`. El navegador llama al mismo origen y desaparecen los preflights.

Si `API_PROXY_UPSTREAM` no está definida, no se genera nada y todo funciona como antes. En el stack del hub conviene apuntar al backend por la red de Docker (`http://<COMPOSE_PROJECT_NAME>_backend:8080`) y no a la URL pública, para no volver a salir por Cloudflare. Un valor inválido (sin `http(s)://` o con path) hace fallar el arranque del contenedor.

## Alternativas descartadas

- **Hornear la URL en build-time** (`ARG` durante `pnpm generate`): obliga a una imagen por entorno y rebuild para cambiar la API. Contradice el requisito de configurar por env var.
- **SSR para leer env en runtime:** reabre [ADR 0003 SPA mode](loc-0003-spa-mode.md); complejidad innecesaria para un panel detrás de login.
- **Servir con `nuxt preview` (Node):** mayor superficie y consumo que nginx estático; innecesario sin SSR.
- **GHCR como registry primario:** Docker Hub queda primario por accesibilidad (ver [ADR 0003 infra](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0003-infrastructure.md)); GHCR como mirror futuro.

## Consecuencias

### Positivas
- Imagen agnóstica del entorno; despliegue idéntico al backend y al landing.
- Default seguro (TEST) → ningún contenedor mal configurado toca producción.
- CI valida typecheck, build y que el SPA realmente sirva (fallback de rutas, `/config.js`, cache headers) antes de publicar.

### Negativas / a mitigar
- `/config.js` es un request extra bloqueante en `<head>`; es mínimo y `no-store` garantiza frescura tras redeploy.
- El default productivo real **debe** pasarse explícito en el deploy del hub — documentar en el `docker-compose.yaml` y env templates del hub al cablear el servicio frontend.

## Implementación

```
.github/workflows/ci.yaml          # build + smoke (no push)
.github/workflows/publish.yaml     # release → push alpine+debian a Docker Hub
docker/alpine.Dockerfile           # node build → nginx:alpine
docker/debian.Dockerfile           # node build → nginx (debian)
docker/default.conf                # fallback SPA + cache + absolute_redirect off
docker/docker-entrypoint.d/40-render-runtime-config.sh   # genera /config.js desde env
public/config.js                   # placeholder dev (vacío → .env manda)
app/plugins/00.runtime-config.client.ts                  # aplica window.__APP_CONFIG__
```

## Pendiente

Cablear el servicio `frontend` en [`deployment/docker-compose.yaml`](https://github.com/fenix-core/centro-optico-vicente/blob/main/deployment/docker-compose.yaml) del hub (imagen, `NUXT_PUBLIC_API_BASE_URL` productivo, labels Traefik) — junto a `web` y `backend`.
