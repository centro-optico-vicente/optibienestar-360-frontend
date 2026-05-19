# ADR 0003 (local frontend) — SPA mode (no SSR)

**Estado:** Aceptado
**Fecha:** 2026-05-18

## Decisión

Arrancar el frontend en **SPA mode** (`ssr: false`).

## Razón

- El frontend admin es **detrás de login** → SEO no es relevante.
- SSR introduce complejidad innecesaria (manejo dual de cookies, hidratación, env vars cliente/server).
- Deploy más simple: imagen estática + nginx (futuro) o `nuxt preview`.
- Cache CDN agresivo en Cloudflare.
- Tiempo de FCP similar a SSR en contexto admin con sesión cacheada.

## Alternativas

- **SSR/Universal:** justifica si hubiera SEO o público no autenticado (no es el caso).
- **SSG:** no aplica porque las páginas son dinámicas según rol.

## Consecuencias

### Positivas
- Setup más simple
- Sin issues de hidratación
- Hosting más fácil

### Negativas / a mitigar
- FCP ligeramente más lento (cliente debe descargar JS + cargar)
- Mitigar con: code-splitting agresivo por route, lazy components, optimización imágenes

## Implementación

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,
});
```

## Futuro

Si surge necesidad de SEO o público no autenticado (ej. blog del programa), evaluar volver a Universal. Por ahora, el landing público vive en repo separado (`centro-optico-vicente-web`) que SÍ es SSG.
