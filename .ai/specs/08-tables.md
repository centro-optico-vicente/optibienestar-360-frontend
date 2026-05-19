# 08 — Tables (listados con paginación + RSQL)

## Patrón estándar

```vue
<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const members = useMembers();

// Estado de la tabla controlado por query params (shareable URLs)
const page = computed(() => Number(route.query.page) || 0);
const size = computed(() => Number(route.query.size) || 20);
const sort = computed(() => (route.query.sort as string) || 'createdAt,desc');
const filter = computed(() => (route.query.filter as string) || '');
const search = ref((route.query.q as string) || '');

const data = ref<PageDTO<MemberListItemDTO> | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const query: Record<string, any> = { page: page.value, size: size.value, sort: sort.value };
    if (filter.value) query.filter = filter.value;
    data.value = await members.list(query);
  } finally {
    loading.value = false;
  }
}

watch([page, size, sort, filter], load, { immediate: true });

function updateQuery(updates: Record<string, any>) {
  router.push({ query: { ...route.query, ...updates } });
}

const columns = [
  { key: 'document_number', label: 'Cédula', sortable: true },
  { key: 'full_name', label: 'Nombre', sortable: true },
  { key: 'plan_name', label: 'Plan' },
  { key: 'status', label: 'Estado' },
  { key: 'next_due_date', label: 'Próximo pago', sortable: true },
  { key: 'actions', label: '', class: 'w-20' },
];

const onSort = (col: string, direction: 'asc' | 'desc') => {
  updateQuery({ sort: `${col},${direction}` });
};
</script>

<template>
  <div class="space-y-4">
    <!-- Header con búsqueda + filtros + acciones -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Afiliados</h1>
      <UButton to="/admin/members/new" icon="i-heroicons-plus">Nuevo afiliado</UButton>
    </div>

    <div class="flex items-center space-x-2">
      <UInput
        v-model="search"
        placeholder="Buscar por nombre o cédula..."
        icon="i-heroicons-magnifying-glass"
        @keyup.enter="updateQuery({ q: search, page: 0 })"
        class="max-w-md"
      />
      <USelectMenu
        v-model="statusFilter"
        :options="statusOptions"
        placeholder="Estado"
        @update:modelValue="updateQuery({ filter: `status==${$event}`, page: 0 })"
      />
      <UButton variant="ghost" icon="i-heroicons-funnel" @click="showFilters = !showFilters">
        Más filtros
      </UButton>
      <UButton variant="ghost" icon="i-heroicons-arrow-down-tray" @click="exportCsv">
        Exportar CSV
      </UButton>
    </div>

    <!-- Tabla -->
    <UCard :ui="{ body: { padding: '' } }">
      <UTable
        :columns="columns"
        :rows="data?.content || []"
        :loading="loading"
        @select="row => router.push(`/admin/members/${row.id}`)"
      >
        <template #status-data="{ row }">
          <UBadge :color="statusColor(row.status)">
            {{ $t(`memberships.status.${row.status}`) }}
          </UBadge>
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

    <!-- Paginación -->
    <div class="flex items-center justify-between text-sm text-slate">
      <div>
        Mostrando {{ data?.content.length || 0 }} de {{ data?.total_elements || 0 }} afiliados
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

## RSQL builder

Helper para construir filtros:

```typescript
// utils/rsql.ts
export class RsqlBuilder {
  private conditions: string[] = [];

  eq(field: string, value: any) {
    if (value != null && value !== '') {
      this.conditions.push(`${field}==${value}`);
    }
    return this;
  }

  like(field: string, value: string) {
    if (value) this.conditions.push(`${field}=like=*${value}*`);
    return this;
  }

  gte(field: string, value: any) {
    if (value != null) this.conditions.push(`${field}=ge=${value}`);
    return this;
  }

  in(field: string, values: any[]) {
    if (values && values.length) this.conditions.push(`${field}=in=(${values.join(',')})`);
    return this;
  }

  build(): string {
    return this.conditions.join(';');
  }
}

// Uso:
const filter = new RsqlBuilder()
  .eq('status', 'ACTIVE')
  .like('full_name', search.value)
  .gte('created_at', dateFrom)
  .build();
```

## Virtualización (tablas grandes)

Para 1000+ filas en una sola página, usar `@tanstack/vue-table` con `useVirtualizer`:

```vue
<script setup>
import { useVirtualizer } from '@tanstack/vue-virtual';

const parentRef = ref();
const rowVirtualizer = useVirtualizer({
  count: data.value?.content.length || 0,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 50,
  overscan: 10,
});
</script>
```

Pero **mejor no necesitarlo**: paginar de a 20-50 filas y filtrar agresivamente.

## Mobile responsive (cards vs tabla)

```vue
<template>
  <!-- Desktop: tabla -->
  <UTable v-if="!isMobile" :columns="columns" :rows="rows" />

  <!-- Mobile: cards -->
  <div v-else class="space-y-3">
    <UCard v-for="row in rows" :key="row.id" @click="navigate(row)">
      <div class="font-bold">{{ row.full_name }}</div>
      <div class="text-sm text-slate">{{ row.document_number }}</div>
      <div class="flex justify-between mt-2">
        <UBadge :color="statusColor(row.status)">{{ row.status }}</UBadge>
        <span class="text-sm">{{ formatDate(row.next_due_date) }}</span>
      </div>
    </UCard>
  </div>
</template>
```

## Export CSV/XLSX

Delegar al backend:

```typescript
async function exportCsv() {
  const query = { format: 'csv', filter: filter.value };
  const url = `${config.public.apiBaseUrl}/v1/admin/reports/export?type=members&${new URLSearchParams(query)}`;
  window.open(url, '_blank');
}
```

Backend genera el CSV y devuelve con `Content-Disposition: attachment`.

## Reglas

- **Estado en query params** (page, sort, filter) → URLs shareables + back button funcional
- **Loading skeleton** durante load (no spinner full-screen para refrescos)
- **Empty state** explícito cuando no hay datos: ilustración + CTA
- **Error state** con retry button
- **Default sort** sensato por endpoint (usually `createdAt,desc`)
- **Whitelist de campos sortable/filterable** (definida por backend)

## Anti-patterns

❌ Cargar 10000 registros en una sola página
❌ Filtros en cliente sobre datos del backend (siempre delegar al backend)
❌ Sin paginación
❌ Sort que no respeta `Page` response del backend
❌ Loading state que oculta toda la tabla en cada refresh menor

## Referencias

- [07-forms.md](07-forms.md)
- [Nuxt UI Table](https://ui.nuxt.com/components/table)
- [TanStack Table (si vituralización)](https://tanstack.com/table)
