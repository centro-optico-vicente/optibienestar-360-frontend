# ADR LOC-0013 (frontend) — Estrategia de rendering: SPA actual vs SSR / híbrido

**Estado:** Propuesto
**Fecha:** 2026-10-25
**Decisores:** equipo OptiBienestar 360 (pendiente de aceptación del dueño)
**Origen:** tarea "Rendering (SSR)" en [`vertical-10`](../checklists/vertical-10-optimizacion-reportes-hardening.md) ("solicitado por el equipo: pasar de SPA a Universal Rendering")
**Si se acepta cualquier opción distinta de "mantener SPA" supersede:** [ADR LOC-0003 SPA mode](loc-0003-spa-mode.md) y obliga a revisar [ADR LOC-0006 CI/CD + Docker + config en runtime](loc-0006-ci-cd-docker-runtime-config.md).
**Requiere enmienda en el hub** (no se hace aquí) si se acepta: [hub ADR 0001 Stack](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0001-stack.md) (hoy: "universal o SPA según necesidad", real SPA), [hub ADR 0003 Infraestructura](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0003-infrastructure.md) / [0021 edge real NPM](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0021-traefik-vs-npm-reality.md) y [hub ADR 0024 JWT storage](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0024-jwt-token-storage.md) si el SSR llegara a rutas autenticadas.

> Todo lo marcado **(no verificado)** es una afirmación que no se pudo comprobar en el repo y debe resolverse en un spike antes de cualquier migración. Ninguna cifra de memoria/latencia de este ADR fue medida.

## Contexto

### Qué es la app hoy (verificado en `origin/main`, 2026-10-25)

- `nuxt.config.ts`: `ssr: false`, Nuxt 4.2.2. Build con `pnpm generate` → `.output/public/` → imagen `nginx:1.31-alpine` (ADR LOC-0006). Los 301 de rutas viejas viven **dos veces**: `routeRules` en `nuxt.config.ts` (solo efectivos en `nuxt dev/preview`) y `docker/default.conf` (producción).
- 70 páginas `.vue`: **52 bajo `dashboard/`** (admin, autenticado) + portales autenticados `advisors/*`, `allies/*`, `members/*` (11 páginas) + `403`. Públicas (`utils/publicRoutes.ts`, `middleware/auth.global.ts`): `/` (login), `/aliados`, `/aliados/[uuid]`, `/afiliarse`, `/recuperar-clave`, `/restablecer-clave` y sus pares `/en/*`.
- **Corrección de una premisa de ADR LOC-0003:** el ADR dice que lo público "vive en repo separado (`centro-optico-vicente-web`)". Solo es cierto del sitio institucional. El **directorio público de aliados y el formulario de afiliación viven en este repo** y ya tienen trabajo de SEO: `usePublicRouteHead` emite `canonical` + `hreflang` es/en/x-default (#237) y `useSeoMeta` en las páginas. No hay `robots.txt` ni sitemap en `public/` (solo favicons y `config.js`).
- **Preparación del código para SSR:** 0 usos de `useFetch`/`useAsyncData` (todo es `useApi` imperativo en el cliente, 144 archivos); 26 archivos tocan `window/document/navigator`; 13 usan `import.meta.client`; `stores/auth.ts` lee/escribe `sessionStorage`/`localStorage` directamente; `auth.global.ts` solo hidrata `if (import.meta.client)`. En un render de servidor **`isAuthenticated` es siempre falso** → toda ruta privada redirigiría al login.

### JWT: incompatibilidad real con SSR autenticado

[Hub ADR 0024](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0024-jwt-token-storage.md): `accessToken` + `user` en `sessionStorage`, `refreshToken` en `localStorage`; el backend **no emite cookies**; se decidió mantenerlo y mitigar con CSP, y "no reabrir salvo que cambie la superficie XSS o el negocio pida una razón nueva para cookies".

El servidor Node de un SSR **no puede leer** `sessionStorage`/`localStorage`. Por tanto:

- **SSR de rutas autenticadas** (admin/portales) solo es posible si el token viaja en una cookie que el servidor lea. Eso exige: backend que emita/lea cookies (`ResponseCookie` en login/refresh/logout, `JwtAuthenticationFilter` leyendo de cookie), y — punto que ADR 0024 no trataba — **protección CSRF**, porque `SecurityConfig` hoy hace `csrf.disable()` justamente por ser API stateless con bearer. Con cookies habría que mantener `SameSite` estricto y/o token CSRF. El CORS ya tiene `allowCredentials` con allowlist (según ADR 0024) pero el resto sería construcción desde cero.
- Alternativa BFF (el servidor Nitro hace proxy a la API con las cookies): suma otro hop y otro componente a operar. No evaluado en detalle.
- **Sin cookies, el servidor solo puede renderizar rutas públicas**; las privadas se quedan en SPA (el cliente hidrata sesión).

Conclusión honesta: SSR en rutas autenticadas **reabre ADR 0024** y arrastra backend (cookies + CSRF) para un beneficio no demostrado (no hay SEO detrás de login y los tableros ya cargan datos desde el cliente). No hay evidencia en el repo de que el FCP del panel sea un problema; ADR LOC-0003 ya afirmaba "FCP similar con sesión cacheada" (afirmación tampoco medida).

### Infra de despliegue hoy

- Hub `deployment/docker-compose.yaml`: servicio `frontend` = imagen estática nginx, **límite 0.5 CPU / 128 MB** (reserva 64 MB), `memswap_limit` igual, **un solo contenedor** (sin réplicas en el compose; ADR 0003 prevé 2 réplicas "cuando FASE 2 esté operativa", hoy aplicable al backend), healthcheck `wget`, detrás de **Nginx Proxy Manager** (edge real, ADR 0021; Traefik es el destino).
- Config de la URL del API en runtime vía `/config.js` generado por entrypoint (LOC-0006), CSP en nginx con `script-src 'self'` (sin scripts inline — hub ADR 0024, decisión 2).
- CI: smoke tests específicos de nginx (fallback SPA, `/config.js` no-store, redirects 301, pares `/en`).

### Qué cambiaría con SSR Node (impacto)

| Área | Hoy (SPA estático) | Con SSR Node |
|---|---|---|
| Imagen | `nginx:alpine`, copia `.output/public` | `node:22-alpine` ejecutando `.output/server/index.mjs` (Nitro); reescribir `alpine.Dockerfile`/`debian.Dockerfile` |
| Memoria | 128 MB límite | Un proceso Node con SSR suele necesitar bastante más que nginx; **no medido**. El límite de 128 MB probablemente no alcance (no verificado) |
| Config runtime | `/config.js` + entrypoint | `NUXT_PUBLIC_API_BASE_URL` nativo de Nitro → se elimina `/config.js` y `00.runtime-config.client.ts` |
| CSP | `script-src 'self'` | El HTML SSR de Nuxt emite scripts inline (config de la app/payload) — **no verificado en este repo**; habría que externalizar el payload o usar nonce/hash; riesgo de romper la CSP de ADR 0024 |
| Redirects 301 | `default.conf` (nginx) | `routeRules` de Nitro (ya declaradas) — se podría quitar la copia de nginx |
| Cache | nginx sirve estáticos inmutables | Node sirve `/_nuxt/` (o NPM/CDN delante); cache de HTML por ruta con `routeRules` |
| Zero-downtime / réplicas | contenedor sin estado, reinicio en segundos | proceso con arranque más lento; para 2 réplicas hace falta `docker-rollout`/healthcheck HTTP real |
| CI smoke | greps contra HTML estático | smoke contra servidor Node, tiempos de arranque, logs de errores de hidratación |
| Código | solo cliente | auditar 26 archivos con `window/document`, `sessionStorage`, plugins `.client`, `hydrate()` del auth store; mismatches de hidratación por locale/zona horaria (`America/Caracas`) |

## Opciones

| | Opción | Qué entrega | Costo | Riesgo |
|---|---|---|---|---|
| **A** | **Mantener SPA (status quo)** | Nada nuevo | 0 | SEO del directorio de aliados dependiente de que el crawler ejecute JS; sin previews de enlaces (Open Graph) en redes/WhatsApp |
| **B** | **Híbrido "prerender estático"**: `ssr: true` + `routeRules` con `'/**': { ssr: false }` y `prerender: true` solo en rutas públicas sin datos dinámicos (`/afiliarse`, `/recuperar-clave`, `/restablecer-clave`, login, sus `/en/*`) | HTML con `<title>`, meta, `canonical`/`hreflang` ya presentes, **seguimos sirviendo con nginx** (sin Node en producción). `nuxt generate` los emite como archivos | Bajo-medio: cambio de config + validar que el fallback SPA del resto sigue idéntico + ajustar `default.conf`/smoke | Combinar `ssr:true` global con `ssr:false` por ruta y el comportamiento exacto de `generate` **no verificado**; spike obligatorio. No cubre `/aliados/[uuid]` (dinámico: prerender exigiría backend en el build, datos obsoletos) |
| **C** | **Híbrido SSR solo público**: `ssr: true` con rutas privadas en `ssr:false`; imagen Node | `/aliados` y `/aliados/[uuid]` con HTML y meta completos en cada request (SEO real y Open Graph por aliado); privadas siguen SPA, **sin tocar JWT** | Medio-alto: imagen Node, ajustes de CSP, memoria, smoke, entrypoint, NPM; revisar código cliente-only en las rutas públicas | Un Node vivo para unas pocas rutas; riesgo de hidratación en páginas públicas; ADR 0003 hub requiere enmienda |
| **D** | **SSR completo + cookies** | Todo renderizado en servidor | Alto: C + backend de cookies + CSRF + reabrir ADR 0024 + migración de `auth` store y 26 archivos | Alto; beneficio no demostrado para el panel |

## Decisión (propuesta)

**Recomendación: A ahora, con un spike acotado de B; diferir C hasta que el negocio confirme que el SEO del directorio público es un requisito; rechazar D.**

1. **Mantener SPA** como decisión vigente para toda la app autenticada (admin + portales = 63 de 70 páginas). No hay evidencia en el repo de problema de FCP ni de requisito de SEO tras login.
2. **Spike (1 PR de experimento, sin merge a producción) de la opción B**: comprobar que `ssr:true` + `routeRules` `ssr:false` por defecto + `prerender` en rutas públicas estáticas genera HTML correcto con `pnpm generate`, que nginx lo sirve sin cambios de infraestructura y que el SPA restante no cambia. Si funciona, es la mejora de SEO/metadatos más barata (conserva nginx, 128 MB, `/config.js`, CSP, réplicas).
3. **C solo si** el dueño confirma que la visibilidad en buscadores / previsualizaciones del directorio (`/aliados/[uuid]`) es un objetivo de negocio. Hoy no hay `robots.txt`/sitemap ni métricas de tráfico orgánico en el repo; la decisión es de producto, no técnica.
4. **D rechazado**: obliga a reabrir hub ADR 0024 (cookies + CSRF en el backend) por un beneficio que solo existiría en pantallas que nadie indexa.
5. Si el dueño prefiere ir a C o D, **debe abrirse una enmienda/ADR en el hub** (ADR 0001 y 0003/0021, y 0024 si D) antes de implementar; este ADR no la reemplaza.

## Alternativas descartadas

- **SSG completo (`nuxt generate` con todas las rutas):** las páginas dependen del rol y de datos en vivo ([LOC-0003](loc-0003-spa-mode.md) ya la descartó).
- **Servir el SPA con `nuxt preview`:** descartado en LOC-0006.
- **Mover `/aliados` y `/afiliarse` al repo del landing (`centro-optico-vicente-web`, SSG):** resolvería el SEO sin tocar el panel, pero duplica las llamadas a la API pública y el flujo de afiliación (hoy con i18n, conversor de moneda #251, etc.); sería otra decisión de arquitectura. Se menciona como opción a evaluar por el dueño.

## Consecuencias (de la propuesta A + spike B)

### Positivas
- Cero cambio de infraestructura, de JWT y de CSP; no se reabre ADR 0024.
- Se obtiene evidencia (spike) antes de comprometer una imagen Node.

### Negativas / a mitigar
- El directorio público seguirá dependiendo de que el buscador ejecute JavaScript; sin Open Graph por aliado.
- Si luego se decide C, habrá que pagar el costo de infra descrito arriba.
- Los 301 seguirán duplicados (`nuxt.config.ts` y `default.conf`) mientras no haya Node.

## Plan

| Fase | Contenido | Salida |
|---|---|---|
| 0 | Decisión de producto: ¿SEO/Open Graph del directorio público es objetivo? ¿métrica actual de tráfico orgánico? | Sí/No del dueño |
| 1 | Spike B en rama descartable: `ssr: true` + `'/**': { ssr: false }` + `prerender` de rutas públicas estáticas; CI con `pnpm generate` + smoke existente; revisar que `.output/public` contiene HTML para esas rutas | Informe go/no-go (no se mergea sin ADR aceptado) |
| 2 (condicional) | Si Fase 0 = Sí: diseñar C (imagen Node, CSP con nonce/payload externo, memoria medida en TEST, smoke, `docker-rollout`) + enmienda de hub ADR 0001/0003/0021 | ADR de implementación + enmiendas |
| — | D no se planifica | — |

**Rollback:** A/B: revertir config (sin cambios de infraestructura). C: re-desplegar el tag anterior de la imagen nginx (la imagen estática anterior sigue siendo válida mientras no se borre del registry).

## Preguntas abiertas para el dueño

1. ¿El directorio público de aliados y `/afiliarse` deben posicionarse en buscadores y mostrar previews (Open Graph) al compartir enlaces? Hoy no hay `robots.txt`, sitemap ni métricas en el repo.
2. ¿Prefiere resolverlo moviendo esas páginas al landing SSG en vez de añadir un Node al frontend?
3. ¿Hay algún motivo distinto de SEO (rendimiento percibido del panel, requerimiento de un cliente) que justifique SSR en rutas autenticadas? Sin él, D no se justifica porque reabre cookies + CSRF.
4. ¿Cuánta memoria adicional está dispuesto a asignar al servicio `frontend` (hoy 128 MB, 0.5 CPU, un contenedor) si se llegara a C?
