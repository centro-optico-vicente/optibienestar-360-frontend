# 03 — State management (Pinia)

> Implementa [ADR 0002 local](../decisions/0002-pinia-state.md).

## Stores

### `useAuthStore` (`stores/auth.ts`)

```typescript
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    accessToken: null as string | null,
    refreshToken: null as string | null,
    permissions: [] as string[],
    roles: [] as string[],
  }),

  getters: {
    isAuthenticated: (state) => !!state.accessToken && !!state.user,
    primaryRole: (state) => {
      const priority = ['ADMIN', 'OPERADOR', 'ALIADO_USER', 'AFILIADO_USER', 'PROMOTOR'];
      return priority.find(r => state.roles.includes(r));
    },
    fullName: (state) => state.user?.fullName ?? '',
  },

  actions: {
    async login(identifier: string, password: string) {
      const api = useApi();
      const { user, access_token, refresh_token } = await api.apiFetch('/v1/auth/login', {
        method: 'POST',
        body: { identifier, password },
      });
      this.user = user;
      this.accessToken = access_token;
      this.refreshToken = refresh_token;
      this.permissions = user.permissions;
      this.roles = user.roles;
    },

    async logout() {
      const api = useApi();
      try {
        await api.apiFetch('/v1/auth/logout', { method: 'POST', body: { refresh_token: this.refreshToken } });
      } catch { /* ignore */ }
      this.$reset();
      await navigateTo('/login');
    },

    async tryRefresh(): Promise<boolean> {
      if (!this.refreshToken) return false;
      try {
        const api = useApi();
        const { access_token, refresh_token } = await api.apiFetch('/v1/auth/refresh', {
          method: 'POST',
          body: { refresh_token: this.refreshToken },
        });
        this.accessToken = access_token;
        if (refresh_token) this.refreshToken = refresh_token;
        return true;
      } catch {
        this.$reset();
        return false;
      }
    },

    hasPermission(perm: string): boolean {
      return this.permissions.includes(perm);
    },
    hasAnyPermission(perms: string[]): boolean {
      return perms.some(p => this.permissions.includes(p));
    },
    hasRole(role: string): boolean {
      return this.roles.includes(role);
    },
  },
});
```

### `useCatalogsStore` (`stores/catalogs.ts`)

Catálogos cacheados (no cambian frecuentemente):

```typescript
export const useCatalogsStore = defineStore('catalogs', {
  state: () => ({
    medicalSpecialties: [] as MedicalSpecialty[],
    serviceCategories: [] as ServiceCategory[],
    allyTypes: [] as AllyType[],
    countries: [] as Country[],
    cities: {} as Record<string, City[]>,  // por countryId
    plans: [] as Plan[],
    lastFetched: {} as Record<string, number>,  // timestamps
  }),

  actions: {
    async loadMedicalSpecialties(force = false) {
      if (!force && this.medicalSpecialties.length && this.isFresh('medicalSpecialties')) return;
      const api = useApi();
      this.medicalSpecialties = await api.apiFetch('/v1/catalogs/medical-specialties');
      this.lastFetched.medicalSpecialties = Date.now();
    },
    // ... similar para otros
    isFresh(key: string, ttlMs = 60 * 60 * 1000): boolean {
      return (Date.now() - (this.lastFetched[key] || 0)) < ttlMs;
    },
  },
});
```

### `useNotificationsStore` (`stores/notifications.ts`)

Toast notifications transientes:

```typescript
export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as Notification[],
  }),
  actions: {
    success(message: string) { this.add({ type: 'success', message }); },
    error(message: string) { this.add({ type: 'error', message }); },
    info(message: string) { this.add({ type: 'info', message }); },
    add(n: Omit<Notification, 'id'>) {
      const id = crypto.randomUUID();
      this.items.push({ ...n, id });
      setTimeout(() => this.remove(id), 5000);
    },
    remove(id: string) {
      this.items = this.items.filter(i => i.id !== id);
    },
  },
});
```

### `useUiStore` (`stores/ui.ts`)

Preferencias UI persistidas:

```typescript
export const useUiStore = defineStore('ui', {
  state: () => ({
    sidebarCollapsed: false,
    theme: 'light' as 'light' | 'dark',
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      useStorage('ui.sidebarCollapsed', this.sidebarCollapsed);
    },
  },
});
```

Persistencia via `useStorage` de VueUse (localStorage).

## Persistencia

- **`auth`:** access token en memoria (riesgo XSS), refresh token en cookie httpOnly (manejado por backend).
- **`catalogs`:** sólo memoria (refresh al recargar app).
- **`notifications`:** sólo memoria (transient).
- **`ui`:** localStorage via VueUse `useStorage`.

## Anti-patterns

❌ Guardar tokens en localStorage
❌ Cachear datos sensibles (médicos, financieros) en store
❌ Hacer requests en cada componente cuando el dato vive en store
❌ Mutar state directo desde componente (siempre via actions)

## Reset al logout

`authStore.$reset()` limpia el store. Adicional: limpiar `catalogsStore` si hay datos sensibles (probablemente no — son catálogos públicos).

## Tests

```typescript
import { setActivePinia, createPinia } from 'pinia';

beforeEach(() => {
  setActivePinia(createPinia());
});

test('auth login sets user and tokens', async () => {
  const store = useAuthStore();
  // mock fetch
  await store.login('admin@x.com', 'password');
  expect(store.isAuthenticated).toBe(true);
});
```

## Referencias

- [ADR 0002 Pinia](../decisions/0002-pinia-state.md)
- [05-auth-flow.md](05-auth-flow.md)
- [Pinia docs](https://pinia.vuejs.org/)
