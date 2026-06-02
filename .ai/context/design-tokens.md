# Design Tokens (paleta heredada del landing)

> Compartidos con [`centro-optico-vicente-web`](https://github.com/fenix-core/centro-optico-vicente-web) para coherencia visual. Originalmente definidos en el HTML monolítico legacy.

## Paleta

| Token | Hex | Uso |
|---|---|---|
| `--blue` | `#245E9E` | Primary, brand, links, CTA |
| `--blue-dark` | `#143458` | Headers, footer dark mode |
| `--blue-deep` | `#0E2A45` | Backgrounds dark, contraste fuerte |
| `--cyan` | `#1094C5` | Accents, info, hover states |
| `--cyan-soft` | `#E5F4FA` | Backgrounds suaves info |
| `--lime` | `#9FD537` | Secondary, success, highlights |
| `--lime-dark` | `#7AB220` | Success hover, badges |
| `--lime-soft` | `#F2F9DF` | Background success/positive |
| `--white` | `#FFFFFF` | Background principal |
| `--paper` | `#FBFAF7` | Background secundario (cálido) |
| `--bone` | `#F4F1EA` | Card backgrounds, dividers |
| `--stone` | `#E5E2D9` | Borders sutiles |
| `--ink` | `#1A2329` | Texto principal |
| `--slate` | `#4A5862` | Texto secundario |
| `--muted` | `#818D96` | Placeholders, disabled |

## Tipografía

| Token | Font family | Uso |
|---|---|---|
| Display/Headings | `Manrope` (sans) | H1, H2, H3 |
| Body | `Manrope` | Texto general |
| Serif decorativa | `Fraunces` (fallback Georgia) | Logo, citas, decorativos |
| Script | `Caveat` (cursive) | Acentos especiales (raro) |

## Tailwind config

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        blue: {
          DEFAULT: '#245E9E',
          dark: '#143458',
          deep: '#0E2A45',
        },
        cyan: {
          DEFAULT: '#1094C5',
          soft: '#E5F4FA',
        },
        lime: {
          DEFAULT: '#9FD537',
          dark: '#7AB220',
          soft: '#F2F9DF',
        },
        paper: '#FBFAF7',
        bone: '#F4F1EA',
        stone: '#E5E2D9',
        ink: '#1A2329',
        slate: {
          DEFAULT: '#4A5862',
        },
        muted: '#818D96',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        script: ['Caveat', 'cursive'],
      },
    },
  },
};
```

## Nuxt UI overrides

```typescript
// app.config.ts
export default defineAppConfig({
  ui: {
    primary: 'blue',       // mapea al token blue
    gray: 'slate',
    button: {
      default: {
        size: 'md',
      },
    },
  },
});
```

## Status colors (semantic)

| Status | Color | Token |
|---|---|---|
| Solvente / ACTIVE | Lime | `--lime` |
| Pendiente revisión | Cyan | `--cyan` |
| Suspendido / SUSPENDED | Amber (no en paleta — usar `text-amber-600`) | — |
| Expirado / EXPIRED | Red (no en paleta — usar `text-red-600`) | — |
| Cancelado / CANCELLED | Slate | `--slate` |

## Espaciado y radios

- Border radius default Nuxt UI: `rounded-md` (6px)
- Cards: `rounded-lg` (8px)
- Modales: `rounded-xl` (12px)
- Spacing: escala estándar Tailwind (4px base)

## Iconos

- `@nuxt/icon` con conjunto Heroicons + Lucide
- Tamaño default: `h-5 w-5` para inline, `h-6 w-6` para botones, `h-8 w-8` para hero areas

## Responsive

Mobile-first ([ADR 0004 local](../decisions/0004-mobile-first.md)):
- Default: mobile (sm)
- Breakpoints Tailwind: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px

## Referencias

- Landing HTML original (referencia): `https://github.com/fenix-core/centro-optico-vicente-web/blob/main/src/index.html`
- Tailwind CSS: https://tailwindcss.com
- Nuxt UI: https://ui.nuxt.com
