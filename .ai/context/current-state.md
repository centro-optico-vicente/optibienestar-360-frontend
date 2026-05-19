# Estado actual del frontend (snapshot)

> **Actualizado:** 2026-05-18

## Resumen

| Aspecto | Estado |
|---|---|
| Bootstrap Nuxt 3 | ❌ Repo vacío (solo .git, LICENSE, README) |
| Estructura `.ai/` | ✅ Creada 2026-05-18 |
| package.json | ❌ No existe |
| Nuxt UI / Tailwind | ❌ No instalados |
| Páginas | ❌ Cero |
| Stores Pinia | ❌ Cero |
| Composables | ❌ Cero |
| Layouts | ❌ Cero |
| Middleware | ❌ Cero |
| i18n | ❌ No configurado |
| Tests | ❌ No configurados |
| Dockerfile | ❌ No existe |
| CI/CD | ❌ No configurado |

## Estructura del repo HOY

```
optisalud-plus-frontend/
├── CLAUDE.md                ← creado 2026-05-18
├── .ai/                     ← creado 2026-05-18
├── README.md                ← mínimo
├── LICENSE
└── .gitignore
```

## Próximos pasos

Tarea 1.9 del [`checklist.md`](../checklist.md):
1. `npx nuxi init .` (atención: hay archivos existentes, usar `--force` o init en subdirectorio)
2. Instalar Nuxt UI + dependencias
3. Configurar Tailwind con design tokens del landing
4. Crear estructura de carpetas (pages, layouts, composables, stores, middleware)
5. Crear composables `useApi.ts`, `useAuth.ts`, `usePermissions.ts`
6. Crear middleware auth + permission
7. Crear páginas base (login, recover, index)
8. Configurar i18n español
9. Dockerfile + CI/CD

## Cambios recientes

- **2026-05-18** — Bootstrap del `.ai/` local del frontend.
