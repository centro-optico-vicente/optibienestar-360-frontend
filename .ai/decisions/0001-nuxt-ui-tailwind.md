# ADR 0001 (local frontend) — Nuxt UI + Tailwind CSS

**Estado:** Aceptado
**Fecha:** 2026-05-18

## Decisión

Usar **Nuxt UI** como librería de componentes principal, con **Tailwind CSS** como sistema de utilidades.

## Razón

- Oficial del equipo Nuxt → integración natural y mantenida
- Componentes accesibles por default (basados en Headless UI)
- Tailwind ya incluido → consistencia con landing
- Gratis, OSS, sin lock-in
- Theming sencillo via `app.config.ts`

## Alternativas descartadas

- **PrimeVue:** más componentes pero mayor bundle size; menos integración Nuxt
- **Vuetify:** Material Design no alinea con paleta del cliente (azul/lime corporativo)
- **shadcn-vue:** requiere copy/paste manual, menos consistencia

## Implementación

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
});

// app.config.ts
export default defineAppConfig({
  ui: {
    primary: 'blue',
    gray: 'slate',
  },
});
```

## Consecuencias

- Componentes con look-and-feel coherente
- Bundle size razonable (tree-shaking)
- Algunas customizaciones requieren overrides (documentar en `10-design-system.md`)
