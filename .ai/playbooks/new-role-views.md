# Playbook — Agregar vistas para un nuevo rol

> Cuando se agrega un nuevo rol al sistema (ej. `OPERADOR_MEDICO`), seguir este playbook para crear sus vistas.

## Pre-requisitos

- [ ] Rol ya creado en backend con sus permisos (ver [backend `playbooks/new-role.md`](https://github.com/fenix-core/optisalud-plus-backend/blob/main/.ai/playbooks/new-role.md))
- [ ] Permisos documentados en [backend `05-roles-permissions.md`](https://github.com/fenix-core/optisalud-plus-backend/blob/main/.ai/specs/05-roles-permissions.md)

## Paso 1 — Decidir estructura de rutas

| Decisión | Ejemplo |
|---|---|
| ¿Tendrá su propio prefijo? | `/operador-medico/*` o reusar `/admin/*` |
| ¿Layout dedicado? | Reusar `dashboard.vue` (default) o crear nuevo |
| ¿Páginas específicas? | Las que sólo ese rol puede ver |

Convención: si el rol comparte mayoría de funciones con un rol existente, reusar el prefijo. Si tiene flow propio significativo, prefijo nuevo.

## Paso 2 — Crear páginas

```bash
mkdir -p pages/operador-medico
touch pages/operador-medico/index.vue
touch pages/operador-medico/medical-records.vue
```

Cada página con `definePageMeta` apropiado:

```vue
<script setup>
definePageMeta({
  layout: 'dashboard',
  middleware: ['permission'],
  permissions: ['MEDICAL_RECORD_VIEW'],
});
</script>
```

## Paso 3 — Actualizar Sidebar

Editar `components/Sidebar.vue` agregando items para el nuevo rol:

```typescript
const items = computed(() => {
  const all = [
    // ... existentes
    { label: 'Antecedentes médicos', to: '/operador-medico/medical-records', icon: 'i-heroicons-clipboard-document', permission: 'MEDICAL_RECORD_VIEW' },
  ];

  return all.filter(item => {
    if (item.permission) return perms.has(item.permission);
    if (item.role) return perms.hasRole(item.role);
    return true;
  });
});
```

## Paso 4 — Actualizar redirección inicial

Si el rol nuevo tiene su propio "home page", actualizar `pages/index.vue`:

```typescript
const path = {
  ADMIN: '/admin',
  OPERADOR: '/admin',
  OPERADOR_MEDICO: '/admin',  // o '/operador-medico' si tiene flow propio
  ALIADO_USER: '/aliado',
  AFILIADO_USER: '/afiliado',
  PROMOTOR: '/promotor',
}[role] || '/login';
```

Y actualizar el computed `primaryRole` en `useAuthStore`:

```typescript
primaryRole: (state) => {
  const priority = ['ADMIN', 'OPERADOR_MEDICO', 'OPERADOR', 'ALIADO_USER', 'AFILIADO_USER', 'PROMOTOR'];
  return priority.find(r => state.roles.includes(r));
},
```

## Paso 5 — Permisos en componentes existentes

Si el nuevo rol debe ver/hacer cosas en páginas existentes, actualizar:

```vue
<!-- antes -->
<UButton v-permission="'MEDICAL_RECORD_VIEW'" @click="viewRecord">
  Ver antecedentes
</UButton>
```

(con el rol nuevo agregado al backend, `v-permission` ya funciona porque el JWT trae los nuevos permisos)

## Paso 6 — i18n

Si el rol introduce strings nuevos:

```json
{
  "operador_medico": {
    "title": "Operador médico",
    "medical_records": "Antecedentes médicos"
  }
}
```

## Paso 7 — Tests E2E

```typescript
test('OPERADOR_MEDICO can access medical records', async ({ page }) => {
  await loginAs(page, 'operador.medico@x.com');
  await page.goto('/admin/members/some-id/medical-record');
  await expect(page.getByText('Antecedentes médicos')).toBeVisible();
});

test('OPERADOR cannot access medical records', async ({ page }) => {
  await loginAs(page, 'operador@x.com');
  await page.goto('/admin/members/some-id/medical-record');
  await expect(page.getByText('Sin permiso')).toBeVisible();
});
```

## Paso 8 — Documentación

- [ ] Actualizar [`../specs/09-permissions.md`](../specs/09-permissions.md) con el rol nuevo
- [ ] Actualizar [`../specs/02-routing-layouts.md`](../specs/02-routing-layouts.md) si introduce rutas nuevas
- [ ] Actualizar [hub `stakeholders.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/context/stakeholders.md) con el perfil
- [ ] Marcar `[x]` en `../checklist.md`

## Checklist final

- [ ] Backend ya tiene el rol con sus permisos
- [ ] Páginas creadas con middleware + permissions correctos
- [ ] Sidebar muestra items relevantes
- [ ] Redirección inicial funciona si el rol tiene home propio
- [ ] Permisos verificados visualmente (UI esconde items inalcanzables)
- [ ] Tests E2E para happy path + negación
- [ ] i18n actualizado
- [ ] Documentación cross-stack actualizada
