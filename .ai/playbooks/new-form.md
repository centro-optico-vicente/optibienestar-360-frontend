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

## Selects que referencian otra entidad → `CommonEntityReferenceSelect`

> **Regla:** cualquier select cuyo valor sea el UUID (o código) de otra entidad **que tenga su
> propia pantalla** — pago, moneda, tipo de promotor, campaña, plan, usuario, aliado, etc. — no
> una lista de opciones fijas, se implementa con `CommonEntityReferenceSelect`
> (`app/components/common/EntityReferenceSelect.vue`), **nunca** un `USelectMenu` +
> `CommonEntityQuickLinkButton` a mano, y **nunca** un `USelectMenu` plano sin acceso rápido. El
> componente ya trae filtro (client-side vía `items` o server-side vía `search`), botón de
> limpiar (`clear`, siempre activo) y el **botón de acceso rápido** a la pantalla de la entidad
> referenciada — es obligatorio en todo select de este tipo, no opcional ni "solo si hay espacio".

```vue
<!-- Catálogo pequeño precargado (items estáticos) -->
<CommonEntityReferenceSelect
  v-model="state.promoterTypeUuid"
  :items="promoterTypeItems"
  entity="promoter_type"
  :placeholder="t('common.select')"
  @navigate="goToCatalogRecord"
/>

<!-- Búsqueda server-side (catálogo grande: usuarios, miembros...) -->
<CommonEntityReferenceSelect
  v-model="state.userUuid"
  :search="searchUsers"
  entity="user"
  icon="i-lucide-search"
  :placeholder="t('promoters.form.userPlaceholderSearch')"
  @navigate="goToCatalogRecord"
/>
```

El botón de acceso rápido (ruta + permiso requerido para verla) **no se pasa a mano** — se
resuelve internamente a partir de la prop `entity` contra el registro central
`app/utils/entity-references.ts`. Si la ruta de una pantalla cambia, se edita una sola vez ahí
en vez de en cada select que la referencia. Al agregar una entidad referenciable nueva:

1. Agregar su clave a `EntityReferenceKey` en `entity-references.ts`.
2. Si es un catálogo genérico (`/dashboard/catalogs/[resource]`), agregarla a `CATALOG_ENTITY_KEYS`
   (mapea al `key` del catálogo en `catalog-registry.ts`).
3. Si tiene pantalla propia (`/dashboard/<entidad>/[uuid]`), agregarla a `ENTITY_ROUTES` con su
   `path(uuid)` y el permiso `*_VIEW_ALL` que la protege.

`to`/`can` (ruta y permiso manuales) siguen existiendo como *fallback* solo para una referencia
que todavía no está en el registro — preferir siempre `entity`.

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
- **Selects que referencian otra entidad siempre usan `CommonEntityReferenceSelect`** con la prop `entity` (ver sección arriba) — nunca `USelectMenu` + `CommonEntityQuickLinkButton` a mano. El botón de acceso rápido a la pantalla de esa entidad (pago, moneda, tipo de promotor, campaña, etc.) es obligatorio siempre que la entidad tenga pantalla propia.
- **Montos/cantidades/números:** alineados a la derecha en campo, tabla o vista de detalle; negativos en texto rojo (ver [hub `09-numeric-value-alignment.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/specs/09-numeric-value-alignment.md)).
- **Validar formato en frontend, reglas de negocio en backend**
- **Loading state explícito** (`isSubmitting` deshabilita el botón)
- **Submit en Enter** funciona por default con `@submit.prevent`
- **Cancelar regresa atrás** sin guardar (`router.back()`)
- **Confirmación destructiva** obligatoria para delete/cancel
- **Atajos teclado:** Enter submit, Esc cancel
