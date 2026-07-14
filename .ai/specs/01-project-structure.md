# 01 — Project structure (Nuxt 3)

## Estructura

```
optibienestar-360-frontend/
├── nuxt.config.ts
├── tailwind.config.ts
├── app.config.ts                   # Nuxt UI config + theme overrides
├── app.vue                         # Root component (NuxtPage)
├── tsconfig.json
├── package.json
│
├── assets/
│   ├── css/
│   │   └── main.css                # Tailwind base + custom
│   └── images/
│
├── components/                     # Componentes globales auto-importados
│   ├── shared/                     # Reutilizables (forms, tables base)
│   ├── digital-card/
│   │   └── DigitalCard.vue
│   ├── members/
│   ├── allies/
│   ├── payments/
│   ├── promoters/
│   └── validator/
│
├── composables/                    # Auto-imports
│   ├── useApi.ts                   # $fetch wrapper con interceptor
│   ├── useAuth.ts                  # Login/logout/refresh
│   ├── usePermissions.ts           # Check permisos del user actual
│   ├── useNotifications.ts         # Toast notifications
│   ├── useFormatters.ts            # Currency, dates, etc.
│   └── useStorage.ts               # Local storage utils
│
├── directives/
│   └── v-permission.ts             # <button v-permission="'PAYMENT_APPROVE'">
│
├── i18n/
│   └── locales/
│       └── es.json                 # Mensajes UI español default
│
├── layouts/
│   ├── default.vue                 # Layout estándar autenticado
│   ├── auth.vue                    # Login, recover (sin sidebar)
│   ├── dashboard.vue               # Dashboard multi-rol con sidebar adaptable
│   └── error.vue                   # Páginas error
│
├── middleware/
│   ├── auth.global.ts              # Redirige a /login si no auth + refresh silencioso
│   └── permission.ts               # Verifica permission específico
│
├── pages/                          # File-based routing
│   ├── index.vue                   # Redirige a dashboard según rol
│   ├── login.vue
│   ├── recover-password.vue
│   ├── reset-password.vue
│   │
│   ├── admin/                      # Rol ADMIN + OPERADOR
│   │   ├── index.vue               # Dashboard con KPIs
│   │   ├── users/
│   │   │   ├── index.vue
│   │   │   ├── new.vue
│   │   │   └── [id].vue
│   │   ├── members/...
│   │   ├── allies/...
│   │   ├── plans/...
│   │   ├── payments/...
│   │   ├── promoters/...
│   │   ├── commissions/...
│   │   └── reports/...
│   │
│   ├── aliado/                     # Rol ALIADO_USER
│   │   ├── index.vue
│   │   ├── validator.vue           # CRÍTICO — validador en tiempo real
│   │   ├── history.vue
│   │   └── dashboard.vue
│   │
│   ├── afiliado/                   # Rol AFILIADO_USER
│   │   ├── index.vue               # Carnet digital + dashboard
│   │   ├── family.vue
│   │   ├── payments.vue
│   │   ├── usage-history.vue
│   │   └── referrals.vue
│   │
│   └── promotor/                   # Rol PROMOTOR
│       ├── index.vue               # Dashboard ventas
│       ├── members.vue
│       └── commissions.vue
│
├── plugins/
│   ├── api.client.ts               # Init API base URL
│   └── error-handler.client.ts     # Global error handler
│
├── public/
│   ├── favicon.ico
│   ├── robots.txt
│   └── images/
│
├── server/                          # Si en algún momento se usa server-side
│   └── (vacío al inicio)
│
├── stores/                          # Pinia (auto-imports)
│   ├── auth.ts
│   ├── catalogs.ts                  # Catálogos cacheados
│   ├── notifications.ts
│   └── ui.ts                        # Sidebar collapse, theme, etc.
│
├── tests/
│   ├── e2e/                         # Playwright
│   └── unit/                        # Vitest (futuro)
│
├── types/
│   ├── api.ts                       # Tipos DTOs del backend
│   ├── domain.ts                    # Tipos del dominio
│   └── ui.ts                        # Tipos UI específicos
│
├── utils/                           # Funciones puras
│   └── (vacío al inicio)
│
├── Dockerfile
├── docker-compose.dev.yaml
├── .gitignore
└── README.md
```

## Convenciones

- **Components:** PascalCase multi-word: `DigitalCard.vue`, `MemberDetailCard.vue`
- **Pages:** kebab-case: `usage-history.vue`, `medical-record.vue`
- **Composables:** `useXxx` camelCase: `useApi()`, `useAuth()`
- **Stores:** singular noun: `useAuthStore()`, `useUiStore()`
- **TypeScript estricto:** `strict: true` + `noUncheckedIndexedAccess: true`

## `nuxt.config.ts` mínimo

```typescript
export default defineNuxtConfig({
  compatibilityDate: '2026-05-18',
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    '@nuxt/icon',
    '@nuxt/image',
  ],

  ssr: false,  // SPA mode (ver ADR 0003)

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.API_BASE_URL || 'https://api.centroopticovicente.com',
      appEnvironment: process.env.APP_ENV || 'dev',
    },
  },

  i18n: {
    locales: [{ code: 'es', file: 'es.json' }],
    defaultLocale: 'es',
    strategy: 'no_prefix',
  },

  app: {
    head: {
      title: 'OptiBienestar 360',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#245E9E' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: '~/tailwind.config.ts',
  },
});
```

## Auto-imports

Nuxt 3 auto-importa por default:
- `components/**`
- `composables/**`
- `stores/**` (con `@pinia/nuxt`)
- `utils/**`

Explicit import si conflicto de nombres.

## TypeScript

`types/api.ts` debe sincronizarse con DTOs del backend. Idealmente generar desde OpenAPI spec:

```bash
# Futuro: openapi-typescript
pnpm dlx openapi-typescript https://api.dominio.com/v3/api-docs -o types/api.ts
```

## Referencias

- [02-routing-layouts.md](02-routing-layouts.md)
- [03-state-management.md](03-state-management.md)
- [Nuxt 3 docs](https://nuxt.com/docs)
