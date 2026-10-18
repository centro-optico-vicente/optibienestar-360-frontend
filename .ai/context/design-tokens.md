# Design Tokens (Manual de Marca OB360, 15-oct-2026)

> Fuente: `MANUAL DE MARCA OPTIBIENESTAR 360.pdf` (págs. 03–05), fuera de git en
> `~/workspace/fenix-core/optibienestar/`. Supera a `LOGOTIPO.docx` y a la paleta
> heredada del landing (`#245E9E` / `#1094C5` / `#9FD537`). Implementación en
> [`app/assets/css/main.css`](../../app/assets/css/main.css) (`@theme static`) y
> [`app.config.ts`](../../app.config.ts). Handoff:
> `centro-optico-vicente/.ai/notes/2026-10-17-brand-typography-portals-handoff.md`.

## Paleta

| Nombre (manual) | Hex | Token en la app |
|---|---|---|
| Azul Profundo | `#003F84` | `prohealth-800` · `--ui-bg-inverted` · inicio del degradado |
| Azul Vital | `#067DBC` | `prohealth-500` (= `primary`) · `cyan-600` (= `info`) |
| Azul Océano | `#0D498B` | `prohealth-700` |
| Verde Bienestar | `#7BC621` | `lime-500` (= `secondary`) |
| Verde Lima | `#8CDD12` | `lime-400` |
| Naranja Energía | `#FF7605` | `energia-500` (= `warning`, CTA) |
| Gris Carbón | `#1B2733` | `--ui-text` |
| Gris Perla | `#EEF2F6` | `--ui-bg-muted` |

- Los **nombres** de escala (`prohealth`, `lime`, `cyan`) se conservan para no
  renombrar ~2 300 clases; solo cambian los valores. Los pasos sin ancla se
  derivan en OKLCH conservando el tono.
- Degradado de marca: `.bg-hero-prohealth` = `#003F84 → #067DBC`.
- Proporción: blanco 45 % · Azul Profundo 25 % · Azul Vital 13 % · Verde 11 % ·
  Naranja 6 %. Verde y naranja son **acento**.

### Contraste (WCAG AA)

- Verde (`lime-400/500`) y naranja (`energia-500`) **nunca** como color de texto
  sobre blanco ni con texto blanco encima (2.1 y 2.7:1).
- Sobre verde o naranja, texto oscuro (`#1B2733` / `prohealth-950`), o usar el
  paso 700+ de la escala con texto blanco.
- Texto verde sobre blanco: `lime-700` o más oscuro (5.2:1).

## Tipografía

- **Poppins** (Google Fonts, 300–700, `display=swap`). El manual también nombra
  Satoshi en el espécimen; pendiente de confirmar con el diseñador.
- La familia vive en un solo lugar: `BRAND_FONT` en `nuxt.config.ts` +
  `--font-sans` en `main.css`. Los componentes solo usan `font-sans`.
- Light (300) solo en textos grandes; en tablas y formularios, Regular (400).

## Logo

- Componente único [`BrandLogo.vue`](../../app/components/BrandLogo.vue):
  `variant` = `horizontal` (fondos claros) · `negativo` (Azul Profundo /
  degradado) · `isotipo`. Mínimo 120 px de ancho en las horizontales; zona de
  protección ≈ 12 % de la altura como padding.
- Assets en `app/assets/brand/` — **raster provisional** recortado del PDF del
  manual, hasta que el diseñador entregue los SVG.
- Favicons (`public/`) generados desde el isotipo.

## Status colors (semantic)

| Status | Color | Token |
|---|---|---|
| Solvente / ACTIVE | Lime | `lime-700` (texto) |
| Pendiente revisión | Cyan | `cyan-600` |
| Suspendido / SUSPENDED | Amber (no en paleta — usar `text-amber-600`) | — |
| Expirado / EXPIRED | Red (no en paleta — usar `text-red-600`) | — |
| Cancelado / CANCELLED | Slate | `slate-500` |

## Espaciado y radios

- Border radius default Nuxt UI: `rounded-md` (6px)
- Cards: `rounded-lg` (8px)
- Modales: `rounded-xl` (12px)
- Spacing: escala estándar Tailwind (4px base)

## Iconos

- `@nuxt/icon` con conjunto Heroicons + Lucide
- Tamaño default: `h-5 w-5` para inline, `h-6 w-6` para botones, `h-8 w-8` para hero areas

## Responsive

Mobile-first ([ADR 0004 local](../decisions/loc-0004-mobile-first.md)):
- Default: mobile (sm)
- Breakpoints Tailwind: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px

## Referencias

- Landing HTML original (referencia): `https://github.com/fenix-core/centro-optico-vicente-web/blob/main/src/index.html`
- Tailwind CSS: https://tailwindcss.com
- Nuxt UI: https://ui.nuxt.com
