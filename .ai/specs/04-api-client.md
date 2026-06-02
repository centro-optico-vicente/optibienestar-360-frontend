# 04 — API client (composable `useApi`)

> Wrapper de `$fetch` con interceptor JWT + manejo errores. Single source of truth para llamadas al backend.

## Composable

```typescript
// composables/useApi.ts
export const useApi = () => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const notifications = useNotificationsStore();

  const apiFetch = $fetch.create({
    baseURL: config.public.apiBaseUrl,
    credentials: 'include',
    timeout: 30000,

    onRequest({ options }) {
      options.headers = options.headers || {};
      if (authStore.accessToken) {
        (options.headers as Record<string, string>).Authorization = `Bearer ${authStore.accessToken}`;
      }
      // Trace ID para correlación
      (options.headers as Record<string, string>)['X-Trace-Id'] = crypto.randomUUID();
    },

    async onResponseError({ response, request, options }) {
      // 401 → intentar refresh + retry
      if (response.status === 401 && authStore.refreshToken) {
        const refreshed = await authStore.tryRefresh();
        if (refreshed) {
          // Retry original request
          return $fetch(request, options as any);
        } else {
          await authStore.logout();
        }
      }

      // 403 → mostrar mensaje
      if (response.status === 403) {
        notifications.error('No tenés permiso para realizar esta acción');
      }

      // 422 → regla de negocio
      if (response.status === 422) {
        notifications.error(response._data?.detail || 'Operación no permitida');
      }

      // 500 → error genérico
      if (response.status >= 500) {
        notifications.error('Error interno. Intentá nuevamente.');
      }

      // 400 / 404 → propagar para que el componente lo maneje
    },
  });

  return { apiFetch };
};
```

## Uso típico

### GET

```typescript
const { apiFetch } = useApi();
const member = await apiFetch<MemberDetailDTO>(`/v1/admin/members/${id}`);
```

### POST con body

```typescript
const result = await apiFetch<PaymentDTO>('/v1/admin/payments', {
  method: 'POST',
  body: paymentData,
  headers: { 'X-Idempotency-Key': crypto.randomUUID() },
});
```

### POST multipart (upload)

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('document_type', 'CEDULA');

await apiFetch(`/v1/admin/members/${id}/upload-document`, {
  method: 'POST',
  body: formData,
});
```

### Paginación con query params

```typescript
const page = await apiFetch<PageDTO<MemberListItemDTO>>('/v1/admin/members', {
  query: {
    page: 0,
    size: 20,
    sort: 'createdAt,desc',
    filter: `status==ACTIVE;city.name==${city}`,
  },
});
```

### Download con presigned URL

```typescript
// Obtener URL temporal
const { url } = await apiFetch<{ url: string }>(`/v1/admin/payments/${id}/support`);
// Usar directamente en <a> o <img>
window.open(url, '_blank');
```

## Manejo de errores en componentes

```vue
<script setup>
const { apiFetch } = useApi();
const error = ref<string | null>(null);
const loading = ref(false);

async function approve() {
  loading.value = true;
  error.value = null;
  try {
    await apiFetch(`/v1/admin/payments/${id}/approve`, {
      method: 'PUT',
      body: { notes: 'Validado en estado de cuenta' },
    });
    notifications.success('Pago aprobado');
  } catch (e: any) {
    if (e.status === 409) {
      error.value = 'Este pago ya fue procesado por otro operador';
    } else {
      // Las 401/403/422/500 ya las maneja onResponseError
      // Sólo manejar específicos de este endpoint acá
    }
  } finally {
    loading.value = false;
  }
}
</script>
```

## Composables específicos por dominio

Wrappers más finos por módulo:

```typescript
// composables/useMembers.ts
export const useMembers = () => {
  const { apiFetch } = useApi();

  return {
    list: (query: Record<string, any>) =>
      apiFetch<PageDTO<MemberListItemDTO>>('/v1/admin/members', { query }),

    findById: (id: string) =>
      apiFetch<MemberDetailDTO>(`/v1/admin/members/${id}`),

    create: (data: MemberCreateDTO) =>
      apiFetch<MemberDetailDTO>('/v1/admin/members', { method: 'POST', body: data }),

    update: (id: string, data: MemberUpdateDTO) =>
      apiFetch<MemberDetailDTO>(`/v1/admin/members/${id}`, { method: 'PUT', body: data }),

    softDelete: (id: string) =>
      apiFetch(`/v1/admin/members/${id}`, { method: 'DELETE' }),
  };
};
```

Uso:
```vue
const members = useMembers();
const list = await members.list({ page: 0, size: 20 });
```

## Tipos TypeScript

Sincronizar con backend OpenAPI:

```typescript
// types/api.ts
export interface MemberDetailDTO {
  id: string;
  document_number: string;
  full_name: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  is_active: boolean;
  created_at: string;
  // ...
}

export interface PageDTO<T> {
  content: T[];
  page: number;
  size: number;
  total_elements: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}
```

A futuro: auto-generar desde `https://api.dominio.com/v3/api-docs` con `openapi-typescript`.

## Reglas

- **Nunca usar `fetch` o `axios` directamente** — siempre `useApi()`.
- **No exponer detalles de errores del backend al usuario final** (e.g., stack traces, IDs internos).
- **Loading states explícitos:** todo botón debe deshabilitarse mientras se procesa.
- **Idempotency key** en POST que puedan reintentarse (pagos, etc.).

## Referencias

- [05-auth-flow.md](05-auth-flow.md)
- [Hub `06-integration.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/specs/06-integration.md)
