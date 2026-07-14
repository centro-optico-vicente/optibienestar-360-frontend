# 10 — Design System

> Componentes propios reusables + overrides de Nuxt UI + design tokens en [`context/design-tokens.md`](../context/design-tokens.md).

## Componentes propios

Crear en `components/shared/` cuando se repite un patrón en >= 3 lugares:

### Ejemplos esperados

| Componente | Cuándo usarlo |
|---|---|
| `<DigitalCard>` | Carnet digital del afiliado (tarjeta + QR + status) |
| `<MembershipStatusBadge>` | Badge de estado de membresía con colores semánticos |
| `<PaymentStatusBadge>` | Badge de estado de pago |
| `<PaymentMethodIcon>` | Icono representativo Zelle/Transferencia/Efectivo |
| `<AmountFormat>` | Formato consistente de montos USD |
| `<DateFormat>` | Formato consistente de fechas |
| `<PageHeader>` | Header de página con título + breadcrumbs + acciones |
| `<EmptyState>` | Estado vacío con ilustración + CTA |
| `<LoadingSkeleton>` | Skeleton mientras carga |
| `<ConfirmDialog>` | Confirmación antes de acciones destructivas |
| `<UploadField>` | File upload con preview |
| `<MemberSearchInput>` | Autocomplete de afiliados por cédula/nombre |
| `<AllySearchInput>` | Autocomplete de aliados |

### Ejemplo: `<MembershipStatusBadge>`

```vue
<!-- components/shared/MembershipStatusBadge.vue -->
<script setup lang="ts">
interface Props {
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
}
const props = defineProps<Props>();

const colorMap = {
  ACTIVE: 'lime',
  SUSPENDED: 'amber',
  EXPIRED: 'red',
  CANCELLED: 'gray',
} as const;
</script>

<template>
  <UBadge :color="colorMap[status]">
    {{ $t(`memberships.status.${status}`) }}
  </UBadge>
</template>
```

### Ejemplo: `<DigitalCard>`

```vue
<!-- components/digital-card/DigitalCard.vue -->
<script setup lang="ts">
interface Props {
  member: { full_name: string; document_number: string };
  plan: { name: string };
  status: string;
  qrUrl: string;
  nextDueDate?: string;
}
defineProps<Props>();
</script>

<template>
  <div class="rounded-xl bg-gradient-to-br from-blue to-blue-dark text-white p-6 max-w-md shadow-xl">
    <div class="flex justify-between items-start mb-6">
      <div>
        <div class="text-xs uppercase tracking-wide text-cyan-soft">OptiBienestar 360</div>
        <div class="text-lg font-bold">{{ plan.name }}</div>
      </div>
      <MembershipStatusBadge :status="status" />
    </div>

    <div class="mb-6">
      <div class="text-2xl font-bold">{{ member.full_name }}</div>
      <div class="text-sm text-cyan-soft">{{ member.document_number }}</div>
    </div>

    <div class="flex justify-between items-end">
      <div v-if="nextDueDate" class="text-xs">
        <div class="uppercase text-cyan-soft">Próximo pago</div>
        <div>{{ formatDate(nextDueDate) }}</div>
      </div>
      <img :src="qrUrl" alt="QR" class="w-20 h-20 bg-white p-1 rounded" />
    </div>
  </div>
</template>
```

## Overrides Nuxt UI

`app.config.ts`:

```typescript
export default defineAppConfig({
  ui: {
    primary: 'blue',
    gray: 'slate',

    button: {
      default: {
        size: 'md',
        color: 'primary',
      },
      rounded: 'rounded-md',
      font: 'font-medium',
    },

    card: {
      shadow: 'shadow-sm',
      ring: 'ring-1 ring-stone',
      rounded: 'rounded-lg',
    },

    formField: {
      label: { base: 'text-sm font-medium text-ink' },
      error: 'text-sm text-red-600',
    },

    table: {
      th: { base: 'text-xs uppercase text-slate' },
      td: { base: 'text-sm' },
    },

    badge: {
      default: { size: 'sm' },
    },
  },
});
```

## Iconos

Usar `@nuxt/icon` con sets predefinidos:

```vue
<Icon name="i-heroicons-user" />
<Icon name="i-lucide-credit-card" />
```

Sets recomendados: Heroicons (default), Lucide (alternativa), Mdi (broader).

## Spacing y layout

Tailwind escala estándar (4px base):
- Spacing interno: `p-4`, `p-6` para contenedores
- Spacing entre elementos: `space-y-4`, `gap-4`
- Margins: usar gap del parent en vez de margin del hijo

Grids comunes:
- 2 cols responsive: `grid grid-cols-1 md:grid-cols-2 gap-4`
- 3 cols responsive: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Dashboard cards: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4`

## Estados visuales

| Estado | Color/clase |
|---|---|
| Loading | `<USkeleton>` o `<LoadingSkeleton>` |
| Empty | `<EmptyState>` con ilustración suave |
| Error | `<UAlert color="red">` con retry |
| Success | `<UAlert color="green">` o toast |
| Disabled | `opacity-50 cursor-not-allowed` |

## Animaciones

- Subtle, no distracting
- Transiciones default Nuxt UI (200ms)
- Para entrada/salida de listas: `<TransitionGroup>` con `enter-active-class="transition"`

## Reglas

- **Coherencia primero:** mejor reusar un componente shared aunque no encaje 100% que duplicar HTML
- **Accesibilidad:** todo focusable con teclado, contraste WCAG AA mínimo, aria-labels en iconos
- **Mobile-first:** ([ADR 0004](../decisions/0004-mobile-first.md))
- **Dark mode:** futuro (no en FASE 5)

## Documentación visual

Considerar Storybook (futuro) para catalogar componentes.

## Referencias

- [`context/design-tokens.md`](../context/design-tokens.md)
- [Nuxt UI docs](https://ui.nuxt.com)
- [Tailwind CSS docs](https://tailwindcss.com)
- [Heroicons](https://heroicons.com)
