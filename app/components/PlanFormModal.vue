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

// Plan create/edit form, shared by the list (/dashboard/plans) and the detail
// (/dashboard/plans/[uuid]) so the 11 fields + validation aren't duplicated.
// The parent controls opening (v-model:open) and gates the permission of the button
// that opens it (PLAN_CREATE / PLAN_UPDATE); on save it emits `saved` to reload.
const props = defineProps<{
  open: boolean
  /** If provided, the modal is in edit mode; if null/undefined, in create mode. */
  plan?: PlanDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [plan: PlanDto]
  /** Shortcut so the parent can close this modal and open its delete confirmation. */
  'delete': [plan: PlanDto]
}>()

const { t } = useI18n()
const plans = usePlans()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.plan ? 'edit' : 'create'))
const isSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

// Type options localized at the consumption point (labelKey → i18n).
const typeOptions = computed(() =>
  PLAN_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
)

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
// Kept outside `state` (a string-only-friendly form-state map) so the boolean isn't coerced.
const isActive = ref(true)

// Locale-reactive schema. Amounts: BigDecimal(10,2) → up to 2 decimals. Required vs
// optional (allows empty). Wrapped in computed so validation messages follow the UI locale.
const schema = computed(() => {
  const requiredMoney = z.string().regex(/^\d+(\.\d{1,2})?$/, t('plans.form.invalidAmount'))
  const optionalMoney = z.string().regex(/^\d*(\.\d{1,2})?$/, t('plans.form.invalidAmount')).optional().or(z.literal(''))
  const optionalInt = z.string().regex(/^\d*$/, t('plans.form.integersOnly')).optional().or(z.literal(''))
  return z.object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/, t('plans.form.codeFormat')),
    name: z.string().min(3, t('validation.minChars', { n: 3 })).max(100, t('validation.maxChars', { n: 100 })),
    description: z.string().optional(),
    type: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    inscriptionFee: requiredMoney,
    monthlyFee: requiredMoney,
    extraBeneficiaryInscriptionFee: optionalMoney,
    includedBeneficiaries: optionalInt,
    maxBeneficiaries: optionalInt,
    gracePeriodDays: optionalInt,
  })
})

function moneyToString(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

// True while the detail loads when opening in edit mode.
const loadingDetail = ref(false)

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify({ ...state, isActive: isActive.value }) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const reloading = ref(false)

function populateFrom(p: PlanDto | null) {
  if (!p) {
    editSnapshot.value = ''
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
    isActive.value = true
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
  isActive.value = p.active ?? true
  editSnapshot.value = snapEditState()
}

async function reloadForm() {
  if (!props.plan) return
  reloading.value = true
  try { populateFrom(await plans.get(props.plan.uuid)) }
  catch { /* useApi already notified */ }
  finally { reloading.value = false }
}
function onRefresh() {
  if (isEditDirty.value) discardConfirmOpen.value = true
  else reloadForm()
}
function discardAndRefresh() {
  discardConfirmOpen.value = false
  reloadForm()
}

// On open: in create mode clear the form; in edit mode load the full detail by UUID
// (the received `plan` may be a list row) to populate reliably.
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
    // If the detail fails to load, use the received record as a fallback.
    populateFrom(props.plan)
  }
  finally {
    loadingDetail.value = false
  }
})

function toInt(v: string): number | undefined {
  const trimmed = v.trim()
  return trimmed === '' ? undefined : Number(trimmed)
}

function toMoney(v: string): string | undefined {
  const trimmed = v.trim()
  return trimmed === '' ? undefined : trimmed
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
      toast.add({ title: t('plans.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
      body.active = isActive.value
      result = await plans.update(props.plan!.uuid, body)
      toast.add({ title: t('plans.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (422 duplicate code, validations, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

// Shortcut from the edit modal so the user doesn't have to close it first
// and hunt for the row's trash icon. Closes this modal and lets the parent
// open its own delete confirmation, so the two dialogs never stack.
function openDeleteFromEdit() {
  if (!props.plan) return
  isOpen.value = false
  emit('delete', props.plan)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('plans.form.createTitle') : t('plans.form.editTitle')"
    :description="mode === 'create' ? t('plans.form.createDescription') : t('plans.form.editDescription')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div v-if="loadingDetail" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
        <span class="text-sm">{{ t('plans.form.loadingDetail') }}</span>
      </div>
      <UForm
        v-else
        ref="formRef"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('plans.form.fields.code')" name="code" required :help="t('plans.form.codeHelp')">
            <UInput v-model="state.code" placeholder="INDIVIDUAL" class="w-full font-mono" />
          </UFormField>
          <UFormField :label="t('plans.form.fields.type')" name="type" required>
            <USelectMenu
              clear
              v-model="state.type"
              :items="typeOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField :label="t('plans.form.fields.name')" name="name" required>
          <UInput v-model="state.name" :placeholder="t('plans.form.namePlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('plans.form.fields.description')" name="description">
          <UTextarea v-model="state.description" :rows="3" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField :label="t('plans.beneficiaries.included')" name="includedBeneficiaries" :help="t('plans.form.includedHelp')">
            <UInput v-model="state.includedBeneficiaries" inputmode="numeric" placeholder="0" class="w-full" />
          </UFormField>
          <UFormField :label="t('plans.beneficiaries.max')" name="maxBeneficiaries" :help="t('plans.form.maxHelp')">
            <UInput v-model="state.maxBeneficiaries" inputmode="numeric" :placeholder="t('plans.beneficiaries.noLimit')" class="w-full" />
          </UFormField>
          <UFormField :label="t('plans.beneficiaries.graceDays')" name="gracePeriodDays" :help="t('plans.form.graceHelp')">
            <UInput v-model="state.gracePeriodDays" inputmode="numeric" placeholder="7" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('plans.form.fields.inscription')" name="inscriptionFee" required :help="t('plans.pricing.inscriptionHint')">
            <UInput v-model="state.inscriptionFee" placeholder="10.00" class="w-full">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField :label="t('plans.form.fields.monthly')" name="monthlyFee" required :help="t('plans.pricing.monthlyHint')">
            <UInput v-model="state.monthlyFee" placeholder="5.00" class="w-full">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
            </UInput>
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField
            :label="t('plans.form.fields.extraBeneficiary')"
            name="extraBeneficiaryInscriptionFee"
            :help="t('plans.form.extraBeneficiaryHelp')"
          >
            <UInput v-model="state.extraBeneficiaryInscriptionFee" placeholder="5.00" class="w-full">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
            </UInput>
          </UFormField>

          <UFormField :label="t('plans.published')" name="published" :help="t('plans.form.publishedHelp')">
            <USwitch v-model="state.published" />
          </UFormField>
        </div>

        <UFormField v-if="mode === 'edit'" :label="t('plans.form.fields.active')" :help="t('plans.form.activeHelp')">
          <USwitch v-model="isActive" />
        </UFormField>

        <!-- Discard unsaved changes before refreshing -->
        <UModal v-model:open="discardConfirmOpen" :title="t('common.discardChangesTitle')">
          <template #body>
            <p class="text-sm text-prohealth-700">{{ t('common.discardChangesBody') }}</p>
            <div class="flex items-center justify-end gap-3 pt-5">
              <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">{{ t('common.cancel') }}</UButton>
              <UButton color="warning" icon="i-lucide-refresh-cw" @click="discardAndRefresh">{{ t('common.discardAndRefresh') }}</UButton>
            </div>
          </template>
        </UModal>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

        <div class="flex items-center justify-between gap-3">
          <div v-if="mode === 'edit' && plan">
            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              size="sm"
              :label="t('common.delete')"
              :disabled="isSubmitting"
              @click="openDeleteFromEdit"
            />
          </div>
          <div v-else />

          <div class="flex items-center gap-3">
            <RefreshButton
              v-if="mode === 'edit'"
              :icon-only="false"
              :label="t('common.refresh')"
              :title="t('common.refresh')"
              :loading="reloading"
              :disabled="isSubmitting"
              @refresh="onRefresh"
            />
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              :color="mode === 'create' ? 'primary' : 'info'"
              variant="outline"
              :loading="isSubmitting"
              :disabled="loadingDetail"
              icon="i-lucide-save"
              @click="formRef?.submit()"
            >
              {{ mode === 'create' ? t('common.saveNew') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
