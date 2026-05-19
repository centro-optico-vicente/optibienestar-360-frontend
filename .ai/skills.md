# Skills externos recomendados (frontend)

| Skill | Cuándo invocar |
|---|---|
| `nuxt-best-practices` | Estructura pages/composables/stores, performance |
| `vue3-composition-api` | Refactor componentes, reactivity, composables |
| `tailwind-css` | Sistema de diseño, utilidades, responsive |
| `accessibility-a11y` | Audit ARIA, semantic HTML, contraste |
| `nuxt-ui` | Componentes Nuxt UI, theming, overrides |

## Comandos

```bash
npx skills add           # interactivo
npx skills list
npx skills update -p
npx skills remove <name>
```

## Reglas

- Skills viven en `.agents/skills/` con symlinks en `.claude/skills/`.
- No editar archivos en `.agents/skills/`.
- Si conflictúa con ADR local, prevalece ADR.

## Orden sugerido

1. `nuxt-best-practices`
2. `tailwind-css`
3. `accessibility-a11y`
4. `vue3-composition-api`
5. `nuxt-ui`
