# `.ai/` — Brief para asistencia IA (frontend admin)

> Brief específico del repo `optisalud-plus-frontend`. Para visión cross-stack, ver el hub maestro en [`../../centro-optico-vicente/.ai/`](../../centro-optico-vicente/.ai/).

## Qué es este repo

Frontend multi-rol (Vue 3 + Nuxt 3) que sirve a admin, operador, aliados, afiliados y promotores del programa OptiSalud Plus.

## Stack confirmado

- Vue 3 + Nuxt 3 (decidir SPA vs universal en ADR 0003)
- Nuxt UI (componentes accesibles con Tailwind)
- Pinia state
- VueUse, i18n, image, icon
- vee-validate + zod (forms)
- Tests: Playwright (E2E)

## Reglas de oro (locales)

1. **Lógica de negocio NO va en frontend.** Cálculos de pricing, comisiones, solvencia → siempre en backend. Frontend hace: UI, navegación, validación de FORMATO.
2. **Mensajes UI en español** (audiencia 100% hispanohablante). Código en inglés (ADR 0009 cross-stack).
3. **Permisos por endpoint y por UI:** usar `usePermissions()` + directiva `v-permission` para mostrar/ocultar acciones.
4. **Sesión:** JWT en cookies httpOnly + access token en memoria. Refresh silencioso en middleware global.
5. **Paleta heredada del landing:** azul `#245E9E`, lime `#9FD537`, cyan `#1094C5`. Ver [`context/design-tokens.md`](context/design-tokens.md).
6. **API consumida vía `useApi()` composable** (wrapper `$fetch` con interceptor JWT). Nunca usar `axios` u otra lib.

## Orden de lectura recomendado

1. Este `CLAUDE.md`
2. [`README.md`](README.md)
3. [`context/current-state.md`](context/current-state.md)
4. [`checklist.md`](checklist.md)
5. [`specs/01-project-structure.md`](specs/01-project-structure.md)
6. [`specs/04-api-client.md`](specs/04-api-client.md) + [`05-auth-flow.md`](specs/05-auth-flow.md)
7. Hub: [`../../centro-optico-vicente/.ai/specs/06-integration.md`](../../centro-optico-vicente/.ai/specs/06-integration.md)

## Para tareas comunes

| Tarea | Playbook |
|---|---|
| Nueva página | [`playbooks/new-page.md`](playbooks/new-page.md) |
| Nuevo formulario | [`playbooks/new-form.md`](playbooks/new-form.md) |
| Nueva tabla con filtros | [`playbooks/new-table.md`](playbooks/new-table.md) |
| Agregar vistas para nuevo rol | [`playbooks/new-role-views.md`](playbooks/new-role-views.md) |

## Decisiones congeladas

**Cross-stack:**
- [ADR 0001 Stack](../../centro-optico-vicente/.ai/decisions/0001-stack.md)
- [ADR 0004 Only free tools](../../centro-optico-vicente/.ai/decisions/0004-only-free-tools.md)
- [ADR 0009 Code conventions](../../centro-optico-vicente/.ai/decisions/0009-code-conventions.md)

**Locales:**
- [ADR 0001 Nuxt UI + Tailwind](decisions/0001-nuxt-ui-tailwind.md)
- [ADR 0002 Pinia state](decisions/0002-pinia-state.md)
- [ADR 0003 SPA mode](decisions/0003-spa-mode.md)
- [ADR 0004 Mobile-first](decisions/0004-mobile-first.md)
