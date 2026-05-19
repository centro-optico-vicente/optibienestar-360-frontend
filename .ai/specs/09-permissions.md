# 09 — Permissions (RBAC en UI)

## Composable `usePermissions()`

```typescript
// composables/usePermissions.ts
export const usePermissions = () => {
  const authStore = useAuthStore();

  const has = (permission: string): boolean => {
    return authStore.permissions.includes(permission);
  };

  const hasAny = (permissions: string[]): boolean => {
    return permissions.some(p => authStore.permissions.includes(p));
  };

  const hasAll = (permissions: string[]): boolean => {
    return permissions.every(p => authStore.permissions.includes(p));
  };

  const hasRole = (role: string): boolean => {
    return authStore.roles.includes(role);
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some(r => authStore.roles.includes(r));
  };

  return { has, hasAny, hasAll, hasRole, hasAnyRole };
};
```

## Directiva `v-permission`

```typescript
// directives/permission.ts
export default {
  mounted(el: HTMLElement, binding: any) {
    const perms = usePermissions();
    const required = Array.isArray(binding.value) ? binding.value : [binding.value];
    if (!perms.hasAny(required)) {
      el.remove();
    }
  },
};

// plugins/directives.client.ts
import permission from '~/directives/permission';
export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.vueApp.directive('permission', permission);
});
```

Uso:

```vue
<UButton v-permission="'PAYMENT_APPROVE'" @click="approve">
  Aprobar
</UButton>

<NuxtLink v-permission="['USER_VIEW_ALL', 'USER_VIEW_OWN']" to="/admin/users">
  Usuarios
</NuxtLink>
```

## En componente con script

```vue
<script setup>
const perms = usePermissions();
const canApprove = computed(() => perms.has('PAYMENT_APPROVE'));
</script>

<template>
  <UButton v-if="canApprove" @click="approve">Aprobar</UButton>
</template>
```

## Middleware per-route

```typescript
// middleware/permission.ts
export default defineNuxtRouteMiddleware((to) => {
  const required = to.meta.permissions as string[] | undefined;
  if (!required || required.length === 0) return;

  const perms = usePermissions();
  if (!perms.hasAny(required)) {
    return showError({ statusCode: 403, message: 'Sin permiso' });
  }
});
```

Uso:

```vue
<script setup>
definePageMeta({
  layout: 'dashboard',
  middleware: ['permission'],
  permissions: ['PAYMENT_APPROVE'],
});
</script>
```

## Sidebar items condicionales

```vue
<!-- components/Sidebar.vue -->
<script setup lang="ts">
const perms = usePermissions();
const authStore = useAuthStore();

const items = computed(() => {
  const all = [
    // Admin/Operador
    { label: 'Dashboard', to: '/admin', icon: 'i-heroicons-home', permission: 'REPORT_VIEW_DASHBOARD' },
    { label: 'Afiliados', to: '/admin/members', icon: 'i-heroicons-users', permission: 'MEMBER_VIEW_ALL' },
    { label: 'Aliados', to: '/admin/allies', icon: 'i-heroicons-building-storefront', permission: 'ALLY_VIEW_ALL' },
    { label: 'Pagos', to: '/admin/payments', icon: 'i-heroicons-banknotes', permission: 'PAYMENT_VIEW_ALL' },
    { label: 'Promotores', to: '/admin/promoters', icon: 'i-heroicons-megaphone', permission: 'PROMOTER_VIEW_ALL' },
    { label: 'Reportes', to: '/admin/reports', icon: 'i-heroicons-chart-bar', permission: 'REPORT_VIEW_DASHBOARD' },

    // Aliado
    { label: 'Validador', to: '/aliado/validator', icon: 'i-heroicons-identification', permission: 'ALLY_VALIDATE_MEMBER' },
    { label: 'Historial', to: '/aliado/history', icon: 'i-heroicons-clock', permission: 'ALLY_VALIDATE_MEMBER' },

    // Afiliado
    { label: 'Mi carnet', to: '/afiliado', icon: 'i-heroicons-credit-card', role: 'AFILIADO_USER' },
    { label: 'Mi familia', to: '/afiliado/family', icon: 'i-heroicons-users', role: 'AFILIADO_USER' },
    { label: 'Mis pagos', to: '/afiliado/payments', icon: 'i-heroicons-banknotes', role: 'AFILIADO_USER' },

    // Promotor
    { label: 'Dashboard', to: '/promotor', icon: 'i-heroicons-home', role: 'PROMOTOR' },
    { label: 'Mis afiliados', to: '/promotor/members', icon: 'i-heroicons-users', role: 'PROMOTOR' },
    { label: 'Mis comisiones', to: '/promotor/commissions', icon: 'i-heroicons-currency-dollar', role: 'PROMOTOR' },
  ];

  return all.filter(item => {
    if (item.permission) return perms.has(item.permission);
    if (item.role) return perms.hasRole(item.role);
    return true;
  });
});
</script>

<template>
  <aside class="w-64 bg-blue-deep text-white">
    <nav>
      <NuxtLink v-for="item in items" :key="item.to" :to="item.to" class="flex items-center px-4 py-3">
        <Icon :name="item.icon" />
        <span class="ml-3">{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </aside>
</template>
```

## Defensa en profundidad

- **UI hide:** `v-permission` oculta UI inalcanzable (mejor UX, no es seguridad)
- **Middleware route:** previene navegación directa
- **Backend validate:** SIEMPRE backend valida con `@PreAuthorize` (UI puede ser modificada, backend no)

**Asumir que el frontend es untrusted** — backend es la única fuente de verdad.

## Permisos por rol (resumen)

Ver detalle completo en [backend `05-roles-permissions.md`](../../../optisalud-plus-backend/.ai/specs/05-roles-permissions.md).

| Rol | Permisos clave |
|---|---|
| ADMIN | Todos |
| OPERADOR | Casi todos excepto USER_CHANGE_ROLE, MEDICAL_RECORD_* |
| OPERADOR_MEDICO | OPERADOR + MEDICAL_RECORD_* |
| ALIADO_USER | ALLY_VIEW_OWN + ALLY_VALIDATE_MEMBER + ALLY_REGISTER_USAGE |
| AFILIADO_USER | MEMBER_VIEW_OWN + MEMBERSHIP_VIEW_OWN + PAYMENT_VIEW_OWN |
| PROMOTOR | MEMBER_CREATE + COMMISSION_VIEW_OWN + REFERRAL_CODE_VIEW_OWN |

## Cambios de permisos en vivo

Cuando admin cambia el rol de un usuario:
- El JWT vigente tiene claims viejos
- Opciones:
  - Forzar relogin (más seguro)
  - Refresh silencioso al detectar 403 (más fluido)

## Anti-patterns

❌ Lógica de negocio basada SÓLO en frontend permissions (sin validar backend)
❌ Hardcodear roles en componente (usar permisos granulares)
❌ Mostrar mensajes "Sin permiso" cuando el item no debería existir (mejor ocultar)

## Referencias

- [02-routing-layouts.md](02-routing-layouts.md)
- [03-state-management.md](03-state-management.md)
- [Backend `05-roles-permissions.md`](../../../optisalud-plus-backend/.ai/specs/05-roles-permissions.md)
