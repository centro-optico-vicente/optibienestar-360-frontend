# Playbook — Build y correr el frontend en local

> **Creado 2026-10-12** (ver [auditoría hub 2026-09-23](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/notes/2026-09-23_audit.md) hallazgo H-FS-5): el requisito de versión de Node vivía solo en memoria de sesiones de IA previas, sin estar escrito en ningún playbook. Verificado contra `.nvmrc`, `package.json` y `ci.yaml` reales — **no asumir Node 20**: ese número ya no es el real (ver "Corrección" abajo).

> **Corrección sobre una nota vieja:** una sesión anterior registró "usar Node 20, el default v18 rompe el build". Verificado ahora: `.nvmrc` pide **Node 22**, `ci.yaml` usa **Node 22** (`actions/setup-node` con `node-version: '22'`), y `package.json.engines.node` solo exige `>=20.0.0` (un piso, no la versión real usada). Usar **22** para que tu entorno coincida exactamente con CI — la nota vieja quedó obsoleta.

## Pre-requisitos

- **Node 22** (`nvm use` recoge `.nvmrc` automáticamente si tenés `nvm` instalado).
- **pnpm 9.12.0** (pineado en `package.json.packageManager` — con Corepack habilitado, `pnpm` ya resuelve esa versión exacta sin instalarlo aparte: `corepack enable`).
- Un backend corriendo en algún lado (local o remoto) para que el SPA tenga contra qué pegarle — ver [backend `local-build.md`](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/playbooks/local-build.md) si también lo vas a correr local.
- Git hooks activados una vez por clon: `git config core.hooksPath .githooks` (bloquea push directo a `main`, regla cero [ADR LOC-0007](../decisions/loc-0007-pr-and-branch-conventions.md)).

## Paso 1 — Instalar y configurar

```bash
nvm use                 # si tenés nvm; si no, confirmar `node -v` → v22.x
corepack enable          # resuelve pnpm@9.12.0 automáticamente (ver packageManager en package.json)
pnpm install
```

`.env` (no versionado — copiar de [`.env.example`](../../.env.example)):
```bash
cp .env.example .env
# Editar NUXT_PUBLIC_API_BASE_URL para que apunte a tu backend
# (local: http://localhost:8080 · remoto: la URL del ambiente que estés usando)
```

Este `.env` **solo aplica en dev** (`pnpm dev`/`pnpm generate` locales) — es una SPA sin runtime server, en producción la URL se inyecta en `/config.js` al arrancar el contenedor (ver [ADR LOC-0006](../decisions/loc-0006-ci-cd-docker-runtime-config.md)), no desde ningún `.env`.

## Paso 2 — Correr en modo desarrollo

**Atajo:** `./start.sh` hace `nvm use 22` + limpia la terminal (`pnpm clear`, cae al `clear` del sistema — no es un script propio) + `pnpm dev`. Requiere tener `nvm` instalado; si no lo usás, confirmar `node -v` → `v22.x` a mano y correr `pnpm dev` directo.

```bash
./start.sh
# equivalente manual (sin nvm):
pnpm dev          # http://localhost:3000, hot-reload
```

## Qué valida CI (`ci.yaml`) — para saber qué vas a romper antes de hacer push

```yaml
- Set up Node 22 with pnpm cache
- pnpm install --frozen-lockfile
- pnpm typecheck     # vue-tsc strict
- pnpm generate      # genera el SPA estático — falla si algo no compila
```

**No hay suite de tests** (`pnpm test` no existe como script) — el único gate real es typecheck + que el build genere sin errores. Corré esto local antes de pushear, es exactamente lo que CI corre:

```bash
pnpm typecheck
pnpm generate
```

`--frozen-lockfile` en CI significa que si tocaste `package.json` sin regenerar `pnpm-lock.yaml` (`pnpm install` sin flags lo regenera), CI falla con un error de lockfile desincronizado — correr `pnpm install` local y commitear el lockfile actualizado si agregaste/cambiaste una dependencia.

### Smoke test de imagen Docker (solo si tocaste `docker/**`)

CI solo corre este job (`docker-smoke`) cuando el diff toca `docker/**` o el propio `ci.yaml` — cambios de código puro (páginas, componentes, composables) no lo disparan. Si estás tocando nginx/Dockerfile y querés probarlo local:

```bash
docker build -f docker/alpine.Dockerfile -t frontend-local --build-arg NGINX_VERSION=1.31.8 .
docker run -d --name frontend-local -e NUXT_PUBLIC_API_BASE_URL=http://localhost:8080 -p 18080:80 frontend-local
curl -sf http://localhost:18080/
```

## Problemas comunes

- **`vue-tsc` falla con errores rarísimos / build se cuelga**: casi siempre es la versión de Node. Confirmar `node -v` → debe decir `v22.x`, no `v18`/`v20`. `nvm use` lo resuelve si tenés `.nvmrc` instalado.
- **`ERR_PNPM_OUTDATED_LOCKFILE` en CI pero no local**: corriste `pnpm install` sin `--frozen-lockfile` local (lo regeneró silenciosamente) y no commiteaste el `pnpm-lock.yaml` actualizado.
- **El SPA carga pero todas las requests fallan**: `NUXT_PUBLIC_API_BASE_URL` en tu `.env` no apunta a un backend real, o el backend no tiene CORS habilitado para `http://localhost:3000` (ver `cors.allowed-origins`/`cors.allow-localhost` en el backend).
- **`@` sin escapar en i18n rompe el build pero no el typecheck**: ver nota de la ronda de i18n — escapar como `{'@'}` en los JSON de locale.

## Referencias

- `README.md` — variables de entorno y Docker image
- [`new-page.md`](new-page.md), [`new-form.md`](new-form.md), [`new-table.md`](new-table.md)
- [hub `release.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/playbooks/release.md) — qué pasa después de que esto compila y pasa typecheck
