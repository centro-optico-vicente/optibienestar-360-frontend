# ADR 0004 (local frontend) — Diseño Mobile-first

**Estado:** Aceptado
**Fecha:** 2026-05-18

## Decisión

Diseñar **mobile-first** todas las páginas y componentes.

## Razón

- Mayoría de usuarios (afiliados, aliados, promotores) acceden desde el celular.
- Conexiones móviles en Venezuela suelen ser lentas → optimizar bundle.
- Recepcionistas de clínicas a veces usan tabletas/celulares (no siempre PC).
- Promotores trabajan en campo desde su celular.

## Implementación

### Tailwind breakpoints

Trabajar desde sm (mobile) y agregar utilidades para pantallas mayores:

```html
<!-- Mobile: full width, Tablet+: 2 col, Desktop+: 3 col -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

NO al revés:
```html
<!-- ❌ MAL: empieza desktop y achica -->
<div class="grid grid-cols-3 sm:grid-cols-1">
```

### Sidebar adaptable

- Mobile: drawer/hamburger
- Desktop: sidebar fijo

### Tablas

- Mobile: cards apilados verticalmente, no scroll horizontal de tabla
- Desktop: tabla normal con columnas múltiples

### Forms

- Mobile: campos full-width, botones grandes (mín 44x44px touch target)
- Desktop: layouts más densos con varias columnas

### Imágenes

- `@nuxt/image` con `loading="lazy"` + `sizes` responsive
- WebP por default
- Tamaños múltiples (`srcset`)

### Performance

- Bundle inicial < 300KB JS (no contar Nuxt UI vendor)
- Code-splitting por route (default Nuxt)
- LazyComponents para no-críticos: `<LazyDigitalCard />`

## Validación

Tests en:
- Chrome DevTools throttle 3G + mobile viewport
- Pantallas reales: iPhone SE, Samsung A30, iPad
- Tablet landscape/portrait

Lighthouse mobile score > 90 en performance/a11y/best-practices.

## Excepciones

Algunas vistas admin (dashboards con gráficos densos, reportes con muchas columnas) están optimizadas para desktop. Indicar en UI un mensaje si se accede desde mobile sugiriendo cambiar a desktop. No bloquear acceso pero degradar gracefully.

## Referencias

- Tailwind responsive design
- [`context/design-tokens.md`](../context/design-tokens.md)
