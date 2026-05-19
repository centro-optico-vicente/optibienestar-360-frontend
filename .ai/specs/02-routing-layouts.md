# 02 — Routing y layouts

## File-based routing (Nuxt 3)

```
pages/
├── index.vue                    # /  → redirige a /admin /aliado /afiliado /promotor según rol
├── login.vue                    # /login
├── recover-password.vue         # /recover-password
├── reset-password.vue           # /reset-password?token=...
│
├── admin/                       # /admin/*  (rol ADMIN u OPERADOR)
│   ├── index.vue                # /admin → dashboard KPIs
│   ├── users/index.vue          # /admin/users
│   ├── users/new.vue            # /admin/users/new
│   ├── users/[id].vue           # /admin/users/{uuid}
│   ├── members/index.vue
│   ├── members/[id]/index.vue
│   ├── members/[id]/medical-record.vue
│   ├── allies/...
│   ├── plans/...
│   ├── payments/...
│   ├── promoters/...
│   ├── commissions/...
│   └── reports/...
│
├── aliado/                      # /aliado/*  (rol ALIADO_USER)
│   ├── index.vue                # /aliado → dashboard
│   ├── validator.vue            # /aliado/validator
│   ├── history.vue
│   └── dashboard.vue
│
├── afiliado/                    # /afiliado/*  (rol AFILIADO_USER)
│   ├── index.vue                # /afiliado → carnet + dashboard
│   ├── family.vue
│   ├── payments.vue
│   ├── usage-history.vue
│   └── referrals.vue
│
└── promotor/                    # /promotor/*  (rol PROMOTOR)
    ├── index.vue                # /promotor → dashboard ventas
    ├── members.vue
    └── commissions.vue
```

## Layouts

```
layouts/
├── default.vue          # NuxtPage wrap, sin chrome
├── auth.vue             # Login, recover (centrado, sin sidebar)
├── dashboard.vue        # Sidebar adaptable por rol + header + main + footer
└── error.vue            # Páginas de error (404, 500)
```

### Asignar layout

```vue
<!-- pages/admin/index.vue -->
<script setup>
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'permission'] });
</script>
```

### `dashboard.vue` (multi-rol)

```vue
<template>
  <div class="min-h-screen flex">
    <Sidebar :role="userRole" :collapsed="uiStore.sidebarCollapsed" />
    <div class="flex-1 flex flex-col">
      <Header :user="user" />
      <main class="flex-1 p-6 bg-paper">
        <slot />
      </main>
      <Footer />
    </div>
  </div>
</template>

<script setup>
const authStore = useAuthStore();
const uiStore = useUiStore();
const user = computed(() => authStore.user);
const userRole = computed(() => authStore.primaryRole);  // ADMIN > OPERADOR > ALIADO_USER > AFILIADO_USER > PROMOTOR
</script>
```

`Sidebar.vue` renderiza items diferentes según rol (ver [`09-permissions.md`](09-permissions.md)).

## Middleware

### `middleware/auth.global.ts` (global)

```typescript
export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();

  // Rutas públicas
  const publicPaths = ['/login', '/recover-password', '/reset-password'];
  if (publicPaths.includes(to.path)) return;

  // Si no hay session, redirigir a login
  if (!authStore.isAuthenticated) {
    // Intentar refresh silencioso
    const refreshed = await authStore.tryRefresh();
    if (!refreshed) {
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    }
  }
});
```

### `middleware/permission.ts` (per-page)

```typescript
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
  permissions: ['PAYMENT_APPROVE'],  // requiere al menos uno
});
</script>
```

### Redirección por rol en `pages/index.vue`

```vue
<script setup>
const authStore = useAuthStore();

onMounted(() => {
  const role = authStore.primaryRole;
  const path = {
    ADMIN: '/admin',
    OPERADOR: '/admin',
    ALIADO_USER: '/aliado',
    AFILIADO_USER: '/afiliado',
    PROMOTOR: '/promotor',
  }[role] || '/login';
  navigateTo(path, { replace: true });
});
</script>
```

## Referencias

- [03-state-management.md](03-state-management.md)
- [09-permissions.md](09-permissions.md)
- [05-auth-flow.md](05-auth-flow.md)
- [Nuxt 3 routing docs](https://nuxt.com/docs/getting-started/routing)
