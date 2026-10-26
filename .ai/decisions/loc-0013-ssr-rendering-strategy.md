# ADR LOC-0013 (frontend) — Estrategia de rendering: SPA actual vs SSR / híbrido

**Estado:** Aceptado — opción A, mantener SPA (2026-10-25, dueño)
**Fecha:** 2026-10-25
**Decisores:** equipo OptiBienestar 360 y dueño del producto
**Origen:** tarea "Rendering (SSR)" en [`vertical-10`](../checklists/vertical-10-optimizacion-reportes-hardening.md) ("solicitado por el equipo: pasar de SPA a Universal Rendering")
**Si se reabre y se acepta cualquier opción distinta de "mantener SPA" supersede:** [ADR LOC-0003 SPA mode](loc-0003-spa-mode.md) y obliga a revisar [ADR LOC-0006 CI/CD + Docker + config en runtime](loc-0006-ci-cd-docker-runtime-config.md).
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

## Decisión

**Opción A: mantener la SPA.** No se adopta SSR ni modo híbrido ahora (decisión del dueño, 2026-10-25).

**Motivación original y por qué no alcanza:** el cambio se consideró como mejora de rendimiento anticipada a producción ("solicitado por el equipo: pasar de SPA a Universal Rendering"). Hasta hoy **no hay ningún reporte de lentitud** ni medición que lo respalde. Además, el SSR no acelera lo que más usa el panel:
- 63 de 70 páginas están tras el login y dependen de llamadas a la API; el SSR autenticado exigiría pasar los tokens a cookies y añadir CSRF (reabre hub ADR 0024).
- Pasar de un contenedor nginx estático (128 MB, 0.5 CPU) a un servidor Node añade un salto por el servidor y más memoria; podría empeorar la latencia en vez de mejorarla.
- El híbrido con `prerender` (opción B) solo cubre unas pocas rutas públicas estáticas, con casi ningún efecto sobre el rendimiento del panel.

**Opciones B, C y D:**
- **B (spike de prerender): diferida.** No se justifica por rendimiento. El único uso que conserva sentido es la vista previa (Open Graph) de `/afiliarse` al compartir el enlace por WhatsApp, cuyo rastreador no ejecuta JavaScript; es un tema de producto aparte.
- **C (Node SSR para rutas públicas): diferida** hasta que haya datos (Search Console, métricas reales) que muestren demanda orgánica por aliado.
- **D (SSR completo + cookies): rechazada.**

**Lo que ya está bien** (verificado en `docker/default.conf` de `origin/main`): `gzip on`; archivos con hash de Nuxt con `Cache-Control: public, max-age=31536000, immutable`; HTML con `no-cache`; `ssr: false` en `nuxt.config.ts`.

**Criterio para reabrir este ADR:** las mediciones de TEST/producción (ver Plan) muestran un problema de carga inicial que el SSR resuelva, o el negocio declara un objetivo de SEO/Open Graph para páginas públicas de este frontend. Si se reabre para C o D, hace falta primero una enmienda en el hub (ADR 0001, 0003/0021 y, si D, 0024).

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

## Plan: medir antes de producción (en lugar del spike)

| # | Acción | Salida |
|---|---|---|
| 1 | Lighthouse sobre pantallas clave en TEST: login, dashboard, un listado grande (pagos/afiliados) y el directorio público; fijar un presupuesto (p. ej. login < 2 s en 4G) | Línea base y presupuesto de rendimiento |
| 2 | Revisar el tamaño de los bundles (`nuxi analyze`); cargar solo donde se usan las librerías pesadas (p. ej. `@zxing` del lector QR) | Lista de dependencias a cargar de forma diferida |
| 3 | Medir la latencia de la API (p95) de los listados más pesados en el backend | Consultas lentas identificadas |
| 4 | Confirmar brotli y caché de los archivos con hash en Cloudflare | Compresión y caché en el borde verificadas |
| 5 | Ya en producción: registrar métricas web reales (LCP, INP) | Datos para reabrir o cerrar este ADR |

**Rollback:** no aplica (no hay cambio de arquitectura).

## Resolución de las preguntas (2026-10-25)

1. **¿Posicionar el directorio público y `/afiliarse` en buscadores?** No hay un objetivo de SEO declarado: la motivación del dueño era el rendimiento anticipado. Recomendación aceptada: el SEO del directorio vive en la landing (`/red-de-salud`, ya con etiquetas, sitemap y datos estructurados) y la SPA no se indexa; las fichas individuales por aliado no se posicionan. Se registrará la landing en Google Search Console para decidir con datos.
2. **¿Mover esas páginas a la landing SSG?** No por ahora: duplicaría el flujo de afiliación; sería otra decisión de arquitectura.
3. **¿Otro motivo para SSR en rutas autenticadas?** Ninguno (el rendimiento percibido no está demostrado). D queda rechazada.
4. **¿Memoria adicional para el servicio `frontend`?** No aplica: no se va a C.
