# 05 — Auth flow

## Login flow

```
[Usuario en /login]
  ↓
[Ingresa identifier + password]
  ↓
[POST /v1/auth/login]
  ↓
[Backend responde: user, access_token, refresh_token]
   + Set-Cookie: refresh_token=httpOnly
  ↓
[authStore.login() guarda en state]
  ↓
[Redirect a /admin /aliado /afiliado /promotor según rol]
```

## Implementación login page

```vue
<!-- pages/login.vue -->
<script setup>
definePageMeta({ layout: 'auth', auth: false });

const authStore = useAuthStore();
const route = useRoute();
const notifications = useNotificationsStore();

const form = reactive({
  identifier: '',
  password: '',
});
const loading = ref(false);
const error = ref<string | null>(null);

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    await authStore.login(form.identifier, form.password);
    const redirect = route.query.redirect as string || '/';
    await navigateTo(redirect, { replace: true });
  } catch (e: any) {
    error.value = e.status === 401
      ? 'Credenciales inválidas'
      : 'Error al iniciar sesión';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-paper p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-2xl font-bold text-blue-dark">Iniciar sesión</h1>
        <p class="text-sm text-slate">OptiSalud Plus</p>
      </template>

      <form @submit.prevent="submit" class="space-y-4">
        <UFormField label="Email o cédula" :error="error">
          <UInput v-model="form.identifier" placeholder="V-12345678" autocomplete="username" required />
        </UFormField>
        <UFormField label="Contraseña">
          <UInput v-model="form.password" type="password" autocomplete="current-password" required />
        </UFormField>
        <UAlert v-if="error" color="red" :description="error" />
        <UButton type="submit" :loading="loading" block size="lg">Ingresar</UButton>
      </form>

      <template #footer>
        <NuxtLink to="/recover-password" class="text-sm text-blue hover:underline">
          ¿Olvidaste tu contraseña?
        </NuxtLink>
      </template>
    </UCard>
  </div>
</template>
```

## Refresh silencioso

El middleware global `auth.global.ts` intenta refresh transparentemente:

```typescript
export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();

  const publicPaths = ['/login', '/recover-password', '/reset-password'];
  if (publicPaths.includes(to.path)) return;

  if (!authStore.isAuthenticated) {
    const refreshed = await authStore.tryRefresh();
    if (!refreshed) {
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    }
  }
});
```

## Manejo de 401 en requests

`useApi` reintenta automáticamente tras refresh exitoso:

```typescript
async onResponseError({ response, request, options }) {
  if (response.status === 401 && authStore.refreshToken) {
    const refreshed = await authStore.tryRefresh();
    if (refreshed) {
      return $fetch(request, options as any);  // retry
    } else {
      await authStore.logout();
    }
  }
}
```

## Logout

```typescript
async logout() {
  try {
    await apiFetch('/v1/auth/logout', {
      method: 'POST',
      body: { refresh_token: this.refreshToken },
    });
  } catch { /* ignorar errores de logout */ }
  this.$reset();
  await navigateTo('/login');
}
```

Backend mueve el refresh token a blacklist Redis. El cookie httpOnly se limpia con `Set-Cookie: refresh_token=; Max-Age=0`.

## Recover password flow

```
[Usuario en /recover-password]
  ↓
[Ingresa email/cédula]
  ↓
[POST /v1/auth/recover-password]
  ↓
[Backend envía email con link: https://app.dominio.com/reset-password?token=...]
  ↓
[Usuario abre link → /reset-password page]
  ↓
[Ingresa nuevo password 2 veces]
  ↓
[POST /v1/auth/reset-password con token + password]
  ↓
[Backend valida token + actualiza password]
  ↓
[Redirect a /login con mensaje "Password actualizado"]
```

## Reglas

- **Access token NUNCA en localStorage** (riesgo XSS).
- **Refresh token en cookie httpOnly** (manejado por backend).
- **Cambio password / cambio rol** → invalidar JWTs vigentes (backend blacklist).
- **Cierre de pestaña** no cierra sesión (refresh token vigente 30 días).
- **Bloqueo anti-brute-force** lo hace el backend (mostrar mensaje genérico al usuario).

## Tests

```typescript
test('login redirects to /admin for ADMIN role', async () => {
  // mock backend
  const store = useAuthStore();
  await store.login('admin@x.com', 'pass');
  expect(store.primaryRole).toBe('ADMIN');
});
```

## Referencias

- [03-state-management.md](03-state-management.md)
- [04-api-client.md](04-api-client.md)
- [02-routing-layouts.md](02-routing-layouts.md)
- [Hub `03-security.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/specs/03-security.md)
