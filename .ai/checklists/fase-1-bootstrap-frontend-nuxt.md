# Checklist — FASE 1: Bootstrap frontend Nuxt

> Cimientos del SPA admin/portales (Tarea 1.9 del roadmap). Formato `[P/C]`.
> Índice: [../checklist.md](../checklist.md)

## Proyecto y configuración

- [ ] [P0/C2] Inicializar Nuxt (`npx nuxi init .`)
- [ ] [P0/C2] Instalar Nuxt UI (`@nuxt/ui` + Tailwind autoincluido)
- [ ] [P0/C2] Instalar módulos: `@pinia/nuxt`, `@vueuse/nuxt`, `@nuxtjs/i18n`, `@nuxt/icon`, `@nuxt/image`
- [ ] [P0/C2] Configurar `nuxt.config.ts` con runtimeConfig (`apiBaseUrl`)
- [ ] [P1/C1] Añadir `nuxt-mcp-dev` a `nuxt.config.ts` (dev-only) — ver [`../specs/11-mcp-servers.md`](../specs/11-mcp-servers.md)
- [ ] [P0/C2] Tailwind paleta heredada del web (azul, lime) en `tailwind.config.ts`
- [ ] [P0/C2] Importar Manrope desde Google Fonts
- [ ] [P0/C2] Configurar i18n con español default

## Layouts y shell

- [ ] [P0/C2] `app.vue` + layout `default.vue` con header + sidebar + main
- [ ] [P0/C2] Layout `auth.vue` sin sidebar

## Auth e infraestructura de cliente

- [ ] [P0/C2] Composable `useApi.ts` wrapper `$fetch` con interceptor JWT
- [ ] [P0/C3] Composable `useAuth.ts` con login/logout/refresh + cookies httpOnly
- [ ] [P0/C2] Store `auth.ts` (Pinia) con user, token, refreshToken, permissions
- [ ] [P0/C2] Middleware `auth.global.ts` (redirect `/login` si no auth + refresh silencioso)
- [ ] [P0/C2] Middleware `permission.ts` (verifica permission por ruta)

## Páginas iniciales

- [ ] [P0/C2] Página `pages/login.vue` + `pages/recover-password.vue`
- [ ] [P0/C2] Página placeholder `pages/index.vue` (redirect según rol)

## Build y despliegue

- [x] [P0/C2] Imagen Docker multi-stage (Nuxt build → nginx sirviendo SPA estático) — ver [ADR 0006](../decisions/0006-ci-cd-docker-runtime-config.md) — 2026-06-01
- [x] [P0/C2] GitHub Actions: build + push imagen Docker Hub `fenixcoreenterprises/optibienestar-360-frontend` — ver [ADR 0006](../decisions/0006-ci-cd-docker-runtime-config.md) — 2026-06-01
