# Playbook — Nuevo formulario

> Ver [07-forms.md](../specs/07-forms.md) para el patrón completo.

## Paso 1 — Schema zod

```typescript
import { z } from 'zod';
import { venezuelanIdSchema } from '~/utils/validators';

const schema = z.object({
  document_number: venezuelanIdSchema,
  full_name: z.string().min(3).max(200),
  email: z.string().email(),
  plan_id: z.string().uuid(),
  // ...
});
```

## Paso 2 — useForm

```typescript
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';

const { handleSubmit, errors, defineField, isSubmitting, meta, resetForm } = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: { /* defaults */ },
});
```

## Paso 3 — Bind fields

```typescript
const [documentNumber, documentNumberProps] = defineField('document_number');
const [fullName, fullNameProps] = defineField('full_name');
// ...
```

## Paso 4 — Submit handler

```typescript
const foos = useFoos();
const notifications = useNotificationsStore();
const router = useRouter();

const onSubmit = handleSubmit(async (values) => {
  try {
    const created = await foos.create(values);
    notifications.success('Creado correctamente');
    router.push(`/admin/foos/${created.id}`);
  } catch (e: any) {
    if (e.status === 409) {
      notifications.error('Ya existe un registro con esos datos');
    } else if (e.status === 400 && e.data?.errors) {
      // Mapear errores del backend a campos del form
      for (const err of e.data.errors) {
        setFieldError(err.field, err.message);
      }
    }
    // Resto manejado por useApi (401, 403, 422, 500)
  }
});
```

## Paso 5 — Template

```vue
<template>
  <form @submit.prevent="onSubmit" class="space-y-4 max-w-2xl">
    <UFormField label="Cédula" :error="errors.document_number" required>
      <UInput
        v-model="documentNumber"
        v-bind="documentNumberProps"
        placeholder="V-12345678"
        size="lg"
      />
    </UFormField>

    <UFormField label="Nombre completo" :error="errors.full_name" required>
      <UInput v-model="fullName" v-bind="fullNameProps" size="lg" />
    </UFormField>

    <UFormField label="Email" :error="errors.email" required>
      <UInput v-model="email" v-bind="emailProps" type="email" size="lg" autocomplete="email" />
    </UFormField>

    <UFormField label="Plan" :error="errors.plan_id" required>
      <USelectMenu
        v-model="planId"
        v-bind="planIdProps"
        :options="plansOptions"
        value-attribute="id"
        option-attribute="name"
      />
    </UFormField>

    <div class="flex justify-end space-x-2 pt-4 border-t">
      <UButton color="gray" variant="ghost" @click="router.back()">Cancelar</UButton>
      <UButton type="submit" :loading="isSubmitting" :disabled="!meta.valid">
        Guardar
      </UButton>
    </div>
  </form>
</template>
```

## Wizard multi-step

Ver [07-forms.md sección "Wizard"](../specs/07-forms.md).

## Forms con file upload

```vue
<UFormField label="Soporte de pago" :error="errors.support">
  <UploadField
    v-model="support"
    accept="image/*,.pdf"
    :max-size-mb="3"
    @file-selected="setFieldValue('support', $event)"
  />
</UFormField>
```

```typescript
async function submit() {
  const formData = new FormData();
  formData.append('data', JSON.stringify({ amount, method, reference }));
  formData.append('file', support);
  await apiFetch('/v1/admin/payments', { method: 'POST', body: formData });
}
```

## Selects alimentados por catálogo (Tipo de documento, etc.)

> **Regla:** los campos cuyo dominio vive en un catálogo del backend (`/v1/admin/catalogs/*`)
> **NUNCA** se hardcodean. Se cargan dinámicamente para no desincronizarse del backend.

### Tipo de documento → usar SIEMPRE `useDocumentTypes()`

Cualquier campo "Tipo de documento" (alta de usuario, afiliado, aliado, etc.) debe tomar sus
opciones de `app/composables/useDocumentTypes.ts`, que lee `GET /v1/admin/catalogs/document-types`,
cachea con `useState` (una sola petición por sesión) y falla en silencio si no hay permiso.
El **valor** guardado es el `code` (`V`, `E`, `J`, …), que es lo que espera el backend.

```typescript
// script setup
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()
onMounted(loadDocumentTypes) // junto a las demás cargas (await Promise.all([...]))
```

```vue
<UFormField label="Tipo de documento" name="documentType">
  <USelectMenu
    v-model="state.documentType"
    :items="documentTypeOptions"
    label-key="label"
    value-key="value"
    placeholder="Selecciona"
    class="w-full"
  />
</UFormField>
```

❌ **Prohibido:** `const DOCUMENT_OPTIONS = ['V', 'E', 'J']` u otra lista fija de tipos de documento.

### Otros catálogos (selects genéricos)

Para selects de cualquier otro catálogo, usar el factory `useCatalog('/v1/admin/catalogs/<recurso>')`
(o `usePublicCatalog('<recurso>')` en formularios públicos sin login) y mapear a
`{ label, value }`. Si es un select recurrente en varias pantallas, encapsularlo en un composable
cacheado con `useState` (mismo patrón que `useDocumentTypes`).

## Confirmación antes de destructive actions

```vue
<UButton color="red" @click="confirmDelete">Eliminar</UButton>

<UModal v-model="showConfirm">
  <UCard>
    <p>¿Seguro que querés eliminar este registro? Esta acción no se puede deshacer.</p>
    <template #footer>
      <UButton color="gray" @click="showConfirm = false">Cancelar</UButton>
      <UButton color="red" @click="doDelete">Eliminar</UButton>
    </template>
  </UCard>
</UModal>
```

## Reglas

- **Selects de catálogo nunca hardcodeados.** Tipo de documento → `useDocumentTypes()`; otros → `useCatalog()`/`usePublicCatalog()` (ver sección arriba).
- **Validar formato en frontend, reglas de negocio en backend**
- **Loading state explícito** (`isSubmitting` deshabilita el botón)
- **Submit en Enter** funciona por default con `@submit.prevent`
- **Cancelar regresa atrás** sin guardar (`router.back()`)
- **Confirmación destructiva** obligatoria para delete/cancel
- **Atajos teclado:** Enter submit, Esc cancel
