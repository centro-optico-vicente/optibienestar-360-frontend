<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CreatePlanRequest,
  PlanDto,
  PlanType,
  UpdatePlanRequest,
} from '~/types/plans'
import { PLAN_TYPE_OPTIONS } from '~/types/plans'

// Formulario crear/editar de Plan, compartido por la lista (/dashboard/plans) y el
// detalle (/dashboard/plans/[uuid]) para no duplicar los 11 campos + validación.
// El padre controla la apertura (v-model:open) y gatea el permiso del botón que lo
// abre (PLAN_CREATE / PLAN_UPDATE); al guardar emite `saved` para que recargue.
const props = defineProps<{
  open: boolean
  /** Si se pasa, el modal opera en modo edición; si es null/undefined, en creación. */
  plan?: PlanDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [plan: PlanDto]
}>()

const plans = usePlans()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.plan ? 'edit' : 'create'))
const isSubmitting = ref(false)

interface FormState {
  code: string
  name: string
  description: string
  type: PlanType | undefined
  inscriptionFee: string
  monthlyFee: string
  extraBeneficiaryInscriptionFee: string
  includedBeneficiaries: string
  maxBeneficiaries: string
  gracePeriodDays: string
  published: boolean
}

const state = reactive<FormState>({
  code: '',
  name: '',
  description: '',
  type: undefined,
  inscriptionFee: '',
  monthlyFee: '',
  extraBeneficiaryInscriptionFee: '',
  includedBeneficiaries: '',
  maxBeneficiaries: '',
  gracePeriodDays: '',
  published: false,
})

// Montos: BigDecimal(10,2) → hasta 2 decimales. Requerido vs opcional (permite vacío).
const requiredMoney = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto no válido')
const optionalMoney = z.string().regex(/^\d*(\.\d{1,2})?$/, 'Monto no válido').optional().or(z.literal(''))
const optionalInt = z.string().regex(/^\d*$/, 'Solo números enteros').optional().or(z.literal(''))

const schema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/, 'UPPER_SNAKE_CASE (A-Z, 0-9, _)'),
  name: z.string().min(3, 'Mínimo 3 caracteres').max(100, 'Máximo 100 caracteres'),
  description: z.string().optional(),
  type: z.string({ message: 'Requerido' }).min(1, 'Requerido'),
  inscriptionFee: requiredMoney,
  monthlyFee: requiredMoney,
  extraBeneficiaryInscriptionFee: optionalMoney,
  includedBeneficiaries: optionalInt,
  maxBeneficiaries: optionalInt,
  gracePeriodDays: optionalInt,
})

function moneyToString(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

// True mientras se carga el detalle al abrir en modo edición.
const loadingDetail = ref(false)

function populateFrom(p: PlanDto | null) {
  if (!p) {
    state.code = ''
    state.name = ''
    state.description = ''
    state.type = undefined
    state.inscriptionFee = ''
    state.monthlyFee = ''
    state.extraBeneficiaryInscriptionFee = ''
    state.includedBeneficiaries = ''
    state.maxBeneficiaries = ''
    state.gracePeriodDays = ''
    state.published = false
    return
  }
  state.code = p.code ?? ''
  state.name = p.name ?? ''
  state.description = p.description ?? ''
  state.type = (p.type as PlanType) ?? undefined
  state.inscriptionFee = moneyToString(p.inscriptionFee)
  state.monthlyFee = moneyToString(p.monthlyFee)
  state.extraBeneficiaryInscriptionFee = moneyToString(p.extraBeneficiaryInscriptionFee)
  state.includedBeneficiaries = p.includedBeneficiaries != null ? String(p.includedBeneficiaries) : ''
  state.maxBeneficiaries = p.maxBeneficiaries != null ? String(p.maxBeneficiaries) : ''
  state.gracePeriodDays = p.gracePeriodDays != null ? String(p.gracePeriodDays) : ''
  state.published = p.published ?? false
}

// Al abrir: en creación limpia el form; en edición carga el detalle completo por UUID
// (el `plan` recibido puede ser una fila de listado) para poblar de forma fiable.
watch(() => props.open, async (open) => {
  if (!open) return
  if (!props.plan) {
    populateFrom(null)
    return
  }
  loadingDetail.value = true
  try {
    populateFrom(await plans.get(props.plan.uuid))
  }
  catch {
    // Si el detalle no carga, usa el registro recibido como respaldo.
    populateFrom(props.plan)
  }
  finally {
    loadingDetail.value = false
  }
})

function toInt(v: string): number | undefined {
  const t = v.trim()
  return t === '' ? undefined : Number(t)
}

function toMoney(v: string): string | undefined {
  const t = v.trim()
  return t === '' ? undefined : t
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    let result: PlanDto
    if (mode.value === 'create') {
      const body: CreatePlanRequest = {
        code: state.code.trim(),
        name: state.name.trim(),
        description: state.description.trim() || undefined,
        type: state.type!,
        inscriptionFee: state.inscriptionFee.trim(),
        monthlyFee: state.monthlyFee.trim(),
        extraBeneficiaryInscriptionFee: toMoney(state.extraBeneficiaryInscriptionFee),
        includedBeneficiaries: toInt(state.includedBeneficiaries),
        maxBeneficiaries: toInt(state.maxBeneficiaries),
        gracePeriodDays: toInt(state.gracePeriodDays),
        published: state.published,
      }
      result = await plans.create(body)
      toast.add({ title: 'Plan creado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      const body: UpdatePlanRequest = {
        code: state.code.trim(),
        name: state.name.trim(),
        description: state.description.trim() || undefined,
        type: state.type,
        inscriptionFee: state.inscriptionFee.trim(),
        monthlyFee: state.monthlyFee.trim(),
        extraBeneficiaryInscriptionFee: toMoney(state.extraBeneficiaryInscriptionFee),
        includedBeneficiaries: toInt(state.includedBeneficiaries),
        maxBeneficiaries: toInt(state.maxBeneficiaries),
        gracePeriodDays: toInt(state.gracePeriodDays),
        published: state.published,
      }
      result = await plans.update(props.plan!.uuid, body)
      toast.add({ title: 'Plan actualizado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi ya notificó el error (422 code duplicado, validaciones, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? 'Nuevo plan' : 'Editar plan'"
    :description="mode === 'create' ? 'Define un nuevo plan de cobertura y su pricing.' : 'Actualiza los datos y el pricing del plan.'"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div v-if="loadingDetail" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
        <span class="text-sm">Cargando datos del plan…</span>
      </div>
      <UForm
        v-else
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Código" name="code" required help="UPPER_SNAKE_CASE. Llave única del plan.">
            <UInput v-model="state.code" placeholder="INDIVIDUAL" class="w-full font-mono" />
          </UFormField>
          <UFormField label="Tipo" name="type" required>
            <USelectMenu
              v-model="state.type"
              :items="PLAN_TYPE_OPTIONS"
              label-key="label"
              value-key="value"
              placeholder="Selecciona"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Nombre" name="name" required>
          <UInput v-model="state.name" placeholder="Plan Individual" class="w-full" />
        </UFormField>

        <UFormField label="Descripción" name="description">
          <UTextarea v-model="state.description" :rows="3" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Inscripción (USD)" name="inscriptionFee" required help="Cargo único de afiliación.">
            <UInput v-model="state.inscriptionFee" placeholder="10.00" class="w-full">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField label="Mensualidad (USD)" name="monthlyFee" required help="Cargo recurrente mensual.">
            <UInput v-model="state.monthlyFee" placeholder="5.00" class="w-full">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
            </UInput>
          </UFormField>
        </div>

        <UFormField
          label="Inscripción por beneficiario extra (USD)"
          name="extraBeneficiaryInscriptionFee"
          help="Déjalo vacío si el plan no admite beneficiarios adicionales."
        >
          <UInput v-model="state.extraBeneficiaryInscriptionFee" placeholder="5.00" class="w-full">
            <template #leading>
              <span class="text-prohealth-400 text-sm">$</span>
            </template>
          </UInput>
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField label="Beneficiarios incluidos" name="includedBeneficiaries" help="Por defecto 0.">
            <UInput v-model="state.includedBeneficiaries" inputmode="numeric" placeholder="0" class="w-full" />
          </UFormField>
          <UFormField label="Beneficiarios máximos" name="maxBeneficiaries" help="Vacío = sin tope.">
            <UInput v-model="state.maxBeneficiaries" inputmode="numeric" placeholder="Sin tope" class="w-full" />
          </UFormField>
          <UFormField label="Días de gracia" name="gracePeriodDays" help="Por defecto 7.">
            <UInput v-model="state.gracePeriodDays" inputmode="numeric" placeholder="7" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Publicado" name="published" help="Visible en el directorio público de planes.">
          <USwitch v-model="state.published" />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
            Cancelar
          </UButton>
          <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
            {{ mode === 'create' ? 'Crear plan' : 'Guardar cambios' }}
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
