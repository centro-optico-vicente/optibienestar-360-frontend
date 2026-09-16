# Playbook — Nueva tabla con filtros + paginación

> Ver [08-tables.md](../specs/08-tables.md) para el patrón completo.

## Paso 1 — Definir columnas

```typescript
const columns = [
  { key: 'document_number', label: 'Cédula', sortable: true },
  { key: 'full_name', label: 'Nombre', sortable: true },
  { key: 'plan_name', label: 'Plan' },
  { key: 'status', label: 'Estado' },
  { key: 'next_due_date', label: 'Próximo pago', sortable: true },
  { key: 'actions', label: '', class: 'w-20' },
];
```

## Paso 2 — Estado controlado por query params

```typescript
const route = useRoute();
const router = useRouter();

const page = computed(() => Number(route.query.page) || 0);
const size = computed(() => Number(route.query.size) || 20);
const sort = computed(() => (route.query.sort as string) || 'createdAt,desc');
const filter = computed(() => (route.query.filter as string) || '');

function updateQuery(updates: Record<string, any>) {
  router.push({ query: { ...route.query, ...updates } });
}
```

## Paso 3 — Load con watch

```typescript
const members = useMembers();
const data = ref<PageDTO<MemberListItemDTO> | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    data.value = await members.list({
      page: page.value,
      size: size.value,
      sort: sort.value,
      filter: filter.value || undefined,
    });
  } finally {
    loading.value = false;
  }
}

watch([page, size, sort, filter], load, { immediate: true });
```

## Paso 4 — Template

```vue
<template>
  <div class="space-y-4">
    <PageHeader title="Afiliados" :actions="[{ label: 'Nuevo', to: '/admin/members/new' }]" />

    <!-- Filtros -->
    <UCard>
      <div class="flex flex-wrap items-center gap-3">
        <UInput
          v-model="searchInput"
          placeholder="Buscar..."
          icon="i-heroicons-magnifying-glass"
          @keyup.enter="applySearch"
          class="max-w-md"
        />
        <USelectMenu
          v-model="statusFilter"
          :options="statusOptions"
          placeholder="Estado"
          @update:modelValue="applyStatus"
        />
        <UButton variant="ghost" icon="i-heroicons-arrow-down-tray" @click="exportCsv">
          Exportar
        </UButton>
      </div>
    </UCard>

    <!-- Tabla (desktop) -->
    <UCard v-if="!isMobile" :ui="{ body: { padding: '' } }">
      <UTable
        :columns="columns"
        :rows="data?.content || []"
        :loading="loading"
        :empty-state="{ icon: 'i-heroicons-circle-stack', label: 'Sin afiliados' }"
        @select="row => router.push(`/admin/members/${row.id}`)"
      >
        <template #status-data="{ row }">
          <MembershipStatusBadge :status="row.status" />
        </template>
        <template #next_due_date-data="{ row }">
          {{ formatDate(row.next_due_date) }}
        </template>
        <template #actions-data="{ row }">
          <UDropdown :items="rowActions(row)">
            <UButton variant="ghost" icon="i-heroicons-ellipsis-vertical" />
          </UDropdown>
        </template>
      </UTable>
    </UCard>

    <!-- Cards (mobile) -->
    <div v-else class="space-y-3">
      <UCard
        v-for="row in data?.content"
        :key="row.id"
        @click="router.push(`/admin/members/${row.id}`)"
      >
        <div class="font-bold">{{ row.full_name }}</div>
        <div class="text-sm text-slate">{{ row.document_number }}</div>
        <div class="flex justify-between mt-2">
          <MembershipStatusBadge :status="row.status" />
          <span class="text-sm">{{ formatDate(row.next_due_date) }}</span>
        </div>
      </UCard>
    </div>

    <!-- Paginación -->
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate">
        {{ data?.content.length || 0 }} de {{ data?.total_elements || 0 }}
      </div>
      <UPagination
        :model-value="page + 1"
        :total="data?.total_elements || 0"
        :page-count="size"
        @update:modelValue="p => updateQuery({ page: p - 1 })"
      />
    </div>
  </div>
</template>
```

## Filtros con RsqlBuilder

```typescript
function applySearch() {
  const filter = new RsqlBuilder()
    .like('full_name', searchInput.value)
    .like('document_number', searchInput.value)
    .build();
  updateQuery({ filter, page: 0 });
}

function applyStatus() {
  const filter = new RsqlBuilder().eq('status', statusFilter.value).build();
  updateQuery({ filter, page: 0 });
}
```

## Acciones por fila

```typescript
function rowActions(row: MemberListItemDTO) {
  const perms = usePermissions();
  return [
    [
      { label: 'Ver detalle', icon: 'i-heroicons-eye', click: () => router.push(`/admin/members/${row.id}`) },
    ],
    [
      ...(perms.has('MEMBER_UPDATE') ? [{ label: 'Editar', icon: 'i-heroicons-pencil', click: () => router.push(`/admin/members/${row.id}/edit`) }] : []),
      ...(perms.has('MEMBER_DELETE') ? [{ label: 'Eliminar', icon: 'i-heroicons-trash', click: () => confirmDelete(row) }] : []),
    ],
  ];
}
```

## Export CSV

```typescript
function exportCsv() {
  const params = new URLSearchParams({ format: 'csv', filter: filter.value });
  window.open(`${config.public.apiBaseUrl}/v1/admin/reports/export?type=members&${params}`, '_blank');
}
```

## Doble click en la fila

Toda tabla de listado (`<tr v-for="...">`) debe abrir el registro al hacer doble click:

- Si la entidad tiene página de detalle/ficha (`[uuid].vue`), navega ahí.
- Si no tiene detalle propio pero sí modal de edición (`openEdit(row)`), abre esa modal.
- Si no tiene ni detalle ni modal, no se agrega `@dblclick`.

Excluir siempre botones/links dentro de la fila con el guard `closest('button, a')`:

```vue
<!-- Navega a detalle -->
<tr
  v-for="u in data"
  :key="u.uuid"
  @dblclick="(e: MouseEvent) => { if (!(e.target as HTMLElement).closest('button, a')) navigateTo(`/dashboard/users/${u.uuid}`) }"
>

<!-- Abre modal de edición (sin página de detalle) -->
<tr
  v-for="e in data"
  :key="e.entityKey"
  @dblclick="(evt: MouseEvent) => { if (!(evt.target as HTMLElement).closest('button, a')) openEdit(e) }"
>
```

Ver `app/pages/dashboard/users/index.vue`, `allies/index.vue`, `roles/index.vue` (detalle) y `entity-config/index.vue` (modal) como referencia.

> Nota: varias tablas anteriores a esta regla (`members`, `promoters`, `plans`, `payments`, `scheduled-jobs`, `commission-rules`) usan un patrón previo de **un solo click** en toda la fila (`@click="... && openEdit(row)"` + `@click.stop` en la celda de acciones) en vez de doble click. Ese patrón sigue siendo válido y no hace falta migrarlo — pero **toda tabla nueva** debe usar el patrón de doble click descrito arriba.

## Reglas

- Estado en query params (shareable URLs)
- Loading skeleton (no spinner full-screen)
- Empty state explícito
- Mobile responsive (cards vs tabla)
- Whitelist de campos sortable/filterable (lo define backend)
- Default sort sensato
- Doble click en la fila abre detalle (si existe) o modal de edición (ver sección arriba)
