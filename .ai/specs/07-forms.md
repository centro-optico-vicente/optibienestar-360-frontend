# 07 — Forms (vee-validate + zod)

## Dependencias

```bash
pnpm add vee-validate @vee-validate/zod zod
```

## Patrón estándar

```vue
<script setup lang="ts">
import { z } from 'zod';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';

const schema = toTypedSchema(z.object({
  document_number: z.string().regex(/^[VE]-\d{6,9}$/, 'Formato inválido (V-12345678 o E-12345678)'),
  full_name: z.string().min(3, 'Mínimo 3 caracteres').max(200),
  email: z.string().email('Email inválido'),
  birth_date: z.date()
    .max(new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000), 'Debes ser mayor de 18'),
  plan_id: z.string().uuid(),
}));

const { handleSubmit, errors, defineField, isSubmitting } = useForm({
  validationSchema: schema,
  initialValues: {
    document_number: '',
    full_name: '',
    email: '',
    birth_date: null,
    plan_id: '',
  },
});

const [documentNumber, documentNumberProps] = defineField('document_number');
const [fullName, fullNameProps] = defineField('full_name');
const [email, emailProps] = defineField('email');
const [birthDate, birthDateProps] = defineField('birth_date');
const [planId, planIdProps] = defineField('plan_id');

const members = useMembers();
const notifications = useNotificationsStore();
const router = useRouter();

const onSubmit = handleSubmit(async (values) => {
  try {
    const created = await members.create(values);
    notifications.success('Afiliado creado correctamente');
    router.push(`/admin/members/${created.id}`);
  } catch (e: any) {
    if (e.status === 409) {
      notifications.error('Ya existe un afiliado con esa cédula');
    }
  }
});
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-4">
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
      <UInput v-model="email" v-bind="emailProps" type="email" size="lg" />
    </UFormField>

    <UFormField label="Fecha de nacimiento" :error="errors.birth_date" required>
      <UInput v-model="birthDate" v-bind="birthDateProps" type="date" size="lg" />
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

    <div class="flex justify-end space-x-2">
      <UButton color="gray" variant="ghost" @click="router.back()">Cancelar</UButton>
      <UButton type="submit" :loading="isSubmitting" :disabled="!meta.valid">Crear afiliado</UButton>
    </div>
  </form>
</template>
```

## Patrones útiles

### Validaciones custom reutilizables

```typescript
// utils/validators.ts
import { z } from 'zod';

export const venezuelanIdSchema = z.string().regex(
  /^[VE]-\d{6,9}$/,
  'Formato inválido (V-12345678 o E-12345678)'
);

export const phoneSchema = z.string().regex(
  /^04\d{2}-?\d{7}$/,
  'Formato inválido (0414-1234567)'
);

export const positiveDecimalSchema = z.number().positive('Debe ser mayor a 0');
```

### Wizard multi-step

```vue
<script setup>
const step = ref(1);
const totalSteps = 4;

function next() {
  if (validateCurrentStep()) step.value++;
}

function prev() {
  step.value--;
}
</script>

<template>
  <UStepper v-model="step" :steps="['Personal', 'Contacto', 'Plan', 'Beneficiarios']" />

  <Step1Form v-if="step === 1" @next="next" />
  <Step2Form v-if="step === 2" @prev="prev" @next="next" />
  <Step3Form v-if="step === 3" @prev="prev" @next="next" />
  <Step4Form v-if="step === 4" @prev="prev" @submit="submit" />
</template>
```

### Validación cross-field (zod refine)

```typescript
const schema = z.object({
  password: z.string().min(8),
  confirm_password: z.string(),
}).refine(
  data => data.password === data.confirm_password,
  { message: 'Las contraseñas no coinciden', path: ['confirm_password'] }
);
```

### Upload file con preview

```vue
<script setup>
const file = ref<File | null>(null);
const preview = ref<string | null>(null);

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (!target.files?.length) return;
  file.value = target.files[0];
  preview.value = URL.createObjectURL(file.value);
}

async function upload() {
  if (!file.value) return;
  const formData = new FormData();
  formData.append('file', file.value);
  await apiFetch('/v1/admin/payments/upload-support', { method: 'POST', body: formData });
}
</script>

<template>
  <input type="file" accept="image/*,application/pdf" @change="onFileChange" />
  <img v-if="preview" :src="preview" class="max-h-64 mt-2 rounded" />
  <UButton @click="upload" :disabled="!file">Subir</UButton>
</template>
```

## UX errores

- **Errores inline** debajo de cada campo (via `UFormField :error`)
- **Errores generales** (no-field) como `UAlert` arriba del form
- **Errores del backend** mapearlos a campos cuando sea posible (`error.errors[].field` → `setFieldError`)

```typescript
catch (e: any) {
  if (e.status === 400 && e.data?.errors) {
    // RFC 7807 con field errors
    for (const err of e.data.errors) {
      setFieldError(err.field, err.message);
    }
  }
}
```

## Reglas

- **Nunca validar reglas de negocio en frontend** (eso es del backend) — sólo formato
- **Defaults sensatos:** placeholder, autocomplete attributes, validación en blur (no on-input agresivo)
- **Loading state:** `isSubmitting` deshabilita el botón submit
- **Confirmación destructiva:** modal antes de delete/cancel (no destructive con un click)
- **Atajos teclado:** Enter submit, Esc cancel
- **`UCheckbox`/`USwitch` con texto asociado siempre clickeable desde el label** (ver sección siguiente)

## Checkbox / Switch con label clickeable

Todo `UCheckbox` o `USwitch` que lleve un texto al lado **debe** poder alternar su valor
clickeando ese texto, no solo el control — es el comportamiento estándar de cualquier
checkbox/switch bien hecho, y el usuario lo espera por default salvo que se indique
explícitamente lo contrario para un caso puntual.

Usar siempre la prop nativa `label` (o el slot `#label` para contenido enriquecido, íconos,
etc.) — **nunca** un `<span>`/texto suelto como hermano del componente, porque no queda
asociado al input y clickearlo no hace nada:

```vue
<!-- ✅ Correcto: label nativo, clickeable -->
<UCheckbox v-model="groupByPromoter" :label="t('commissions.payoutGenerate.groupByPromoter')" />
<USwitch v-model="active" label="Activo" />

<!-- ❌ Incorrecto: el texto no alterna el valor -->
<div class="flex items-center gap-2">
  <UCheckbox v-model="groupByPromoter" />
  <span>{{ t('commissions.payoutGenerate.groupByPromoter') }}</span>
</div>
```

Si el `UCheckbox`/`USwitch` ya vive dentro de un `UFormField` con su propio `label`, ese
`label` del `UFormField` ya resuelve la asociación — no hace falta duplicar. Si por algún
motivo no se puede usar la prop `label` (layouts muy específicos), envolver checkbox + texto
en un `<label>` real (`<label class="cursor-pointer">...<UCheckbox .../> texto</label>`) es
una alternativa válida, aunque menos idiomática que la prop nativa.

## Campos de solo lectura / deshabilitados

Un campo `:disabled` o `:readonly` por razón **estructural** (ej. `code`/`email` inmutable una vez creado el
registro, no un estado transitorio de carga o permisos) debe verse visualmente distinto de un
campo editable normal — el `disabled:opacity-75` por defecto de Nuxt UI es demasiado sutil para
leerse a simple vista como "este campo está bloqueado".

Convención: además de `:disabled`, pasar el override `READONLY_FIELD_UI` (de
`app/utils/formFieldStyles.ts`, auto-importado) al prop `:ui`:

```vue
<UInput
  v-model="state.code"
  :disabled="mode === 'edit'"
  :ui="mode === 'edit' ? READONLY_FIELD_UI : undefined"
/>
```

Aplica a cualquier campo (`UInput`, `UTextarea`, `USelectMenu`, etc.) que se vuelva
estructuralmente inmutable en modo edición — no solo a `code`. Ejemplos ya migrados:
`ScheduledJobFormModal.vue` (`code`), `UserFormModal.vue` (`email`).

## Moneda en selects

Todo `USelectMenu`/`CommonEntityReferenceSelect` que liste monedas (`Currency`) debe mostrar la etiqueta como:

```
<Código> (<Símbolo>)
```

Ejemplos: `USD ($)`, `VES (Bs.)`, `EUR (€)`. Es la convención por defecto para **cualquier dropdown de moneda**, salvo que se indique explícitamente otro formato. Se resuelve en el origen (backend), no por formateo client-side:

```java
// CurrencyService.labelOf
private static String labelOf(Currency c) {
    return c.getCode() + " (" + c.getSymbol() + ")";
}
```

El frontend consume `option.label` directamente (ver `CommissionTierFormModal.vue`, `currencyItems`), sin concatenar código/nombre por su cuenta.

## Atajos de fecha/hora (`AppDateTimePicker`, `AuditDateRangePicker`)

Todo selector de fecha/fecha-hora con panel de atajos agrupa los shortcuts en 3 secciones, en este orden, separadas por `USeparator`:

1. **Día** — Hoy, Ayer, Mañana
2. **Semana** — 1er día de la semana, Último día laborable de la semana (viernes), Último día de la semana (domingo)
3. **Mes** — 1er día del mes, Quincena (día 15), Último día del mes

La semana se calcula con un helper propio (`mondayOfWeek`), **no** con `startOfWeek(date, 'es-VE')` de `@internationalized/date` — el CLDR de `es-VE` empieza la semana en domingo, no en lunes, así que ese helper daba el día equivocado. `mondayOfWeek` usa `date.toDate('America/Caracas').getDay()` (0=dom…6=sáb, Gregoriano puro, sin locale) y resta el offset a lunes; el "último día laborable" es `mondayOfWeek + 4 días` (viernes) y el "último día de la semana" es `mondayOfWeek + 6 días` (domingo).

Componente de referencia para un campo de fecha-hora **único**: `app/components/AppDateTimePicker.vue`. Para un **rango**: `app/components/AuditDateRangePicker.vue` (pendiente unificar sus 3 grupos exactos con esta convención si se toca de nuevo — hoy agrupa Día/Semana completa/Mes sin el desglose de "último día laborable").

i18n: claves bajo `common.dateTimePicker.shortcuts.*` (picker único) / `audit.dateRange.shortcuts.*` (rango).

## Anti-patterns

❌ Calcular total/descuentos en frontend (backend lo hace)
❌ Validar cédula existe en BD desde frontend (es del backend al submit)
❌ Habilitar submit aunque haya errores (visualmente ok pero no submits)
❌ Sin handling del error 409 / 422 / 500

## Referencias

- [vee-validate docs](https://vee-validate.logaretm.com/v4/)
- [zod docs](https://zod.dev/)
- [Nuxt UI Form components](https://ui.nuxt.com/components/form)
