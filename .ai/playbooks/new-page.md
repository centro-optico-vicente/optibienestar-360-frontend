# Playbook — Nueva página

## Paso 1 — Crear archivo

```bash
# Para una página simple:
touch pages/admin/foo/index.vue

# Para detalle con [id]:
mkdir -p pages/admin/foo
touch pages/admin/foo/[id].vue
```

Naming: `kebab-case.vue`. Ver [02-routing-layouts.md](../specs/02-routing-layouts.md).

## Paso 2 — Página mínima

```vue
<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',                              // o 'auth' / 'default'
  middleware: ['permission'],                       // si requiere permiso
  permissions: ['FOO_VIEW_ALL'],                    // listar permisos requeridos
});

useHead({ title: 'Foos — OptiSalud Plus' });

const route = useRoute();
const api = useApi();

const data = ref(null);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    data.value = await api.apiFetch('/v1/admin/foos');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Foos" :actions="actions" />

    <USkeleton v-if="loading" class="h-64" />

    <EmptyState v-else-if="!data?.length" title="Sin foos" cta-to="/admin/foos/new" cta-label="Crear primer foo" />

    <UCard v-else>
      <!-- contenido -->
    </UCard>
  </div>
</template>
```

## Paso 3 — Agregar al sidebar

Editar `components/Sidebar.vue` agregando al array `items`:

```typescript
{ label: 'Foos', to: '/admin/foos', icon: 'i-heroicons-cube', permission: 'FOO_VIEW_ALL' },
```

## Paso 4 — Tipos TypeScript

`types/api.ts`:
```typescript
export interface FooListItemDTO { id: string; name: string; status: string; }
export interface FooDetailDTO { /* ... */ }
```

## Paso 5 — Composable opcional

Si la página hace múltiples requests al mismo dominio, crear composable:

`composables/useFoos.ts`:
```typescript
export const useFoos = () => {
  const { apiFetch } = useApi();
  return {
    list: (query: any) => apiFetch('/v1/admin/foos', { query }),
    findById: (id: string) => apiFetch(`/v1/admin/foos/${id}`),
    create: (data: any) => apiFetch('/v1/admin/foos', { method: 'POST', body: data }),
    update: (id: string, data: any) => apiFetch(`/v1/admin/foos/${id}`, { method: 'PUT', body: data }),
    softDelete: (id: string) => apiFetch(`/v1/admin/foos/${id}`, { method: 'DELETE' }),
  };
};
```

## Paso 6 — i18n

Agregar strings en `i18n/locales/es.json`:
```json
{
  "foos": {
    "title": "Foos",
    "new": "Nuevo foo",
    "fields": { ... }
  }
}
```

Usar en componente: `{{ $t('foos.title') }}`.

## Paso 7 — Tests E2E (Playwright)

`tests/e2e/admin-foos.spec.ts`:
```typescript
test('lists foos for admin', async ({ page }) => {
  await loginAs(page, 'admin@x.com');
  await page.goto('/admin/foos');
  await expect(page.getByText('Foos')).toBeVisible();
});

test('denies access without permission', async ({ page }) => {
  await loginAs(page, 'aliado@x.com');
  await page.goto('/admin/foos');
  await expect(page.getByText('Sin permiso')).toBeVisible();
});
```

## Paso 8 — Documentación

- Marcar `[x]` en [`../checklist.md`](../checklist.md)
- Actualizar [`../context/current-state.md`](../context/current-state.md)

## Checklist final

- [ ] `definePageMeta` con layout + middleware + permissions correctos
- [ ] `useHead` con título
- [ ] Loading state (skeleton)
- [ ] Empty state
- [ ] Error state
- [ ] Mobile responsive
- [ ] i18n para todos los textos
- [ ] Item en sidebar
- [ ] Tipos TypeScript
- [ ] Test E2E happy path + permisos
