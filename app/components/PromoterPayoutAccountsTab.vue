<script setup lang="ts">
import { z } from 'zod'
import type { CatalogItem } from '~/types/catalogs'
import { BANK_ACCOUNT_TYPE_OPTIONS } from '~/types/payments'
import { requiredFields } from '~/utils/paymentMethodRequirements'
import type { PromoterPayoutAccountDto, PromoterPayoutAccountRequest } from '~/types/promoters'

// "Cuentas de cobro" tab of the advisor detail (backend V184, dossier section V):
// N payout accounts per advisor (transfer, Pago Móvil, Ubii, Zelle… — any payment
// method of the catalog), one of them the default used to prefill commission
// payouts (OutPaymentFormModal). The form fields adapt to the selected method's
// `mandatory*` flags, same as the payment forms. Each action has its own
// permission (PROMOTER_PAYOUT_ACCOUNT_CREATE / _UPDATE / _DELETE); the parent
// only mounts the tab with _VIEW_ALL and never on the INSTITUCION system row.
const props = defineProps<{
  promoterUuid: string
  canCreate: boolean
  /** Edit + "set as default". */
  canUpdate: boolean
  canDelete: boolean
}>()

const { t } = useI18n()
const promoters = usePromoters()
const methodsApi = useCatalog('/v1/admin/payment-methods')
const banksApi = useCatalog('/v1/admin/banks')
const toast = useToast()

const accounts = ref<PromoterPayoutAccountDto[]>([])
const loading = ref(false)
const hasActions = computed(() => props.canUpdate || props.canDelete)

async function load() {
  loading.value = true
  try {
    accounts.value = await promoters.listPayoutAccounts(props.promoterUuid)
  }
  catch {
    accounts.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
defineExpose({ load })

// ---- Catalog options (loaded lazily when the modal opens) ----
const methodOptions = ref<{ label: string, value: string }[]>([])
const bankOptions = ref<{ label: string, value: string }[]>([])

async function loadOptions() {
  if (methodOptions.value.length && bankOptions.value.length) return
  try {
    const [methods, banks] = await Promise.all([methodsApi.listAll(), banksApi.listAll()])
    methodOptions.value = methods
      .filter((method: CatalogItem) => method.active)
      .map((method: CatalogItem) => ({ label: method.name, value: method.uuid }))
    bankOptions.value = banks
      .filter((bank: CatalogItem) => bank.active)
      .map((bank: CatalogItem) => ({ label: bankOptionLabel(bank), value: bank.uuid }))
  }
  catch {
    // useApi already reported the API error; the selects stay empty.
  }
}

const holderDocumentTypeOptions = ['V', 'E', 'J', 'G', 'P'].map(v => ({ label: v, value: v }))

function accountTypeLabel(value?: string | null): string {
  return BANK_ACCOUNT_TYPE_OPTIONS.find(option => option.value === value)?.label ?? ''
}

// ---- Create / edit modal ----
const formOpen = ref(false)
const editingUuid = ref<string | null>(null)
const saving = ref(false)

interface FormState {
  paymentMethodUuids: string[]
  label: string
  bankUuid: string | undefined
  accountType: string
  accountNumber: string
  accountIdentifier: string
  holderName: string
  holderDocumentType: string | undefined
  holderDocumentNumber: string
  phone: string
  email: string
  isDefault: boolean
}

function emptyState(): FormState {
  return {
    paymentMethodUuids: [],
    label: '',
    bankUuid: undefined,
    accountType: '',
    accountNumber: '',
    accountIdentifier: '',
    holderName: '',
    holderDocumentType: undefined,
    holderDocumentNumber: '',
    phone: '',
    email: '',
    isDefault: false,
  }
}

const state = reactive<FormState>(emptyState())

// Detail of every accepted method (the list projection may not carry the `mandatory*` flags); the account must
// hold the sum of their checks (V217).
const selectedMethods = ref<CatalogItem[]>([])
const methodDetails = new Map<string, CatalogItem>()
watch(() => [...state.paymentMethodUuids], async (uuids) => {
  try {
    await Promise.all(uuids.filter(uuid => !methodDetails.has(uuid)).map(async (uuid) => {
      methodDetails.set(uuid, await useApi<CatalogItem>(`/v1/admin/payment-methods/${uuid}`))
    }))
  }
  catch {
    // useApi already reported the API error.
  }
  if (uuids.join() === state.paymentMethodUuids.join()) {
    selectedMethods.value = uuids.map(uuid => methodDetails.get(uuid)).filter((m): m is CatalogItem => Boolean(m))
  }
})
const required = computed(() => requiredFields(selectedMethods.value))

const requiredMsg = computed(() => t('validation.required'))
const schema = computed(() => {
  const req = required.value
  const mandatory = (flag?: boolean) => (flag ? z.string().min(1, requiredMsg.value) : z.string().optional())
  return z.object({
    paymentMethodUuids: z.array(z.string()).min(1, requiredMsg.value),
    label: z.string().max(60, t('validation.maxChars', { n: 60 })).optional(),
    accountType: mandatory(req.accountType),
    accountNumber: req.accountCode
      ? z.string().regex(/^\d{20}$/, t('promoters.payoutAccounts.validation.accountNumber'))
      : z.string().optional(),
    accountIdentifier: mandatory(req.bankAccount),
    holderName: z.string().max(150, t('validation.maxChars', { n: 150 })).optional(),
    holderDocumentNumber: req.identification
      ? z.string().regex(/^\d{1,10}$/, t('validation.digitsOnly'))
      : z.string().regex(/^(\d{1,10})?$/, t('validation.digitsOnly')).optional(),
    phone: req.phone ? z.string().min(1, requiredMsg.value).max(30) : z.string().max(30).optional(),
    email: req.email ? z.string().email(t('validation.emailInvalid')) : z.string().optional(),
  })
    .refine(() => !req.bank || Boolean(state.bankUuid), { message: requiredMsg.value, path: ['bankUuid'] })
    .refine(v => Boolean(state.holderDocumentType) === Boolean(v.holderDocumentNumber?.trim()), {
      message: t('promoters.payoutAccounts.validation.holderPair'),
      path: ['holderDocumentNumber'],
    })
})

function openCreate() {
  editingUuid.value = null
  Object.assign(state, emptyState())
  loadOptions()
  formOpen.value = true
}

function openEdit(a: PromoterPayoutAccountDto) {
  editingUuid.value = a.uuid
  Object.assign(state, {
    paymentMethodUuids: a.paymentMethods.map(m => m.uuid),
    label: a.label ?? '',
    bankUuid: a.bank_Uuid ?? undefined,
    accountType: a.accountType ?? '',
    accountNumber: a.accountNumber ?? '',
    accountIdentifier: a.accountIdentifier ?? '',
    holderName: a.holderName ?? '',
    holderDocumentType: a.holderDocumentType ?? undefined,
    holderDocumentNumber: a.holderDocumentNumber ?? '',
    phone: a.phone ?? '',
    email: a.email ?? '',
    isDefault: a.isDefault,
  })
  loadOptions()
  formOpen.value = true
}

async function onSubmit() {
  const req = required.value
  saving.value = true
  try {
    // Full replace: fields none of the accepted methods uses are sent as null,
    // so changing the methods does not leave the previous methods' data behind.
    const keep = (flag: boolean, value: string) => (flag && value.trim() ? value.trim() : null)
    const body: PromoterPayoutAccountRequest = {
      paymentMethodUuids: state.paymentMethodUuids,
      label: state.label.trim() || null,
      bankUuid: req.bank ? (state.bankUuid || null) : null,
      accountType: keep(req.accountType, state.accountType),
      accountNumber: keep(req.accountCode, state.accountNumber),
      accountIdentifier: keep(req.bankAccount, state.accountIdentifier),
      holderName: state.holderName.trim() || null,
      holderDocumentType: state.holderDocumentType || null,
      holderDocumentNumber: state.holderDocumentNumber.trim() || null,
      phone: keep(req.phone, state.phone),
      email: keep(req.email, state.email),
      isDefault: editingUuid.value ? null : state.isDefault,
    }
    if (editingUuid.value) {
      await promoters.updatePayoutAccount(props.promoterUuid, editingUuid.value, body)
      toast.add({ title: t('promoters.payoutAccounts.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      await promoters.createPayoutAccount(props.promoterUuid, body)
      toast.add({ title: t('promoters.payoutAccounts.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // useApi already reported the API error.
  }
  finally {
    saving.value = false
  }
}

function submitForm() {
  document.querySelector<HTMLFormElement>('[data-promoter-payout-account-form]')?.requestSubmit()
}

// ---- Set as default ----
const settingDefaultUuid = ref<string | null>(null)

async function makeDefault(a: PromoterPayoutAccountDto) {
  settingDefaultUuid.value = a.uuid
  try {
    await promoters.setDefaultPayoutAccount(props.promoterUuid, a.uuid)
    toast.add({ title: t('promoters.payoutAccounts.defaultToast'), color: 'success', icon: 'i-lucide-check-circle' })
    await load()
  }
  catch {
    // useApi already reported the API error.
  }
  finally {
    settingDefaultUuid.value = null
  }
}

// ---- Delete ----
const deleteTarget = ref<PromoterPayoutAccountDto | null>(null)
const deleting = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await promoters.removePayoutAccount(props.promoterUuid, deleteTarget.value.uuid)
    toast.add({ title: t('promoters.payoutAccounts.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteTarget.value = null
    await load()
  }
  catch {
    // useApi already reported the API error.
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('promoters.payoutAccounts.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('promoters.payoutAccounts.hint') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
        <UButton v-if="canCreate" size="xs" color="primary" icon="i-lucide-plus" @click="openCreate">
          {{ t('promoters.payoutAccounts.add') }}
        </UButton>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-6 py-3 font-semibold">{{ t('promoters.payoutAccounts.columns.method') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('promoters.payoutAccounts.columns.bank') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('promoters.payoutAccounts.columns.destination') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('promoters.payoutAccounts.columns.holder') }}</th>
            <th v-if="hasActions" class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <TableSkeleton v-if="loading" :rows="2" :cols="hasActions ? 5 : 4" />
          <tr v-else-if="accounts.length === 0">
            <td :colspan="hasActions ? 5 : 4" class="px-6 py-10 text-center text-prohealth-500">
              <UIcon name="i-lucide-wallet" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
              {{ t('promoters.payoutAccounts.empty') }}
            </td>
          </tr>
          <tr v-for="a in accounts" v-else :key="a.uuid" class="hover:bg-prohealth-50/50">
            <td class="px-6 py-3">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge v-for="m in a.paymentMethods" :key="m.uuid" color="primary" variant="subtle" size="sm">{{ m.name }}</UBadge>
                <UBadge v-if="a.isDefault" color="primary" variant="soft" size="sm">{{ t('promoters.payoutAccounts.defaultBadge') }}</UBadge>
              </div>
              <p v-if="a.label" class="text-xs text-prohealth-500 mt-0.5">{{ a.label }}</p>
            </td>
            <td class="px-6 py-3 text-prohealth-700">
              <BankName v-if="a.bank_Display || a.bank_Code" :uuid="a.bank_Uuid" :code="a.bank_Code" :name="a.bank_Display" />
              <template v-else>{{ t('common.empty') }}</template>
              <span v-if="a.accountType" class="block text-xs text-prohealth-500">{{ accountTypeLabel(a.accountType) }}</span>
            </td>
            <td class="px-6 py-3 text-prohealth-700 font-mono">{{ payoutDestination(a) || t('common.empty') }}</td>
            <td class="px-6 py-3 text-prohealth-700">
              {{ a.holderName || t('common.empty') }}
              <span v-if="payoutHolderDocument(a)" class="block text-xs text-prohealth-500 font-mono">{{ payoutHolderDocument(a) }}</span>
            </td>
            <td v-if="hasActions" class="px-6 py-3 text-right whitespace-nowrap">
              <UTooltip v-if="canUpdate && !a.isDefault" :text="t('promoters.payoutAccounts.makeDefault')">
                <UButton color="primary" variant="ghost" size="xs" icon="i-lucide-star" :loading="settingDefaultUuid === a.uuid" :aria-label="t('promoters.payoutAccounts.makeDefault')" @click="makeDefault(a)" />
              </UTooltip>
              <UButton v-if="canUpdate" color="info" variant="ghost" size="xs" icon="i-lucide-pencil" :aria-label="t('common.edit')" @click="openEdit(a)" />
              <UButton v-if="canDelete" color="error" variant="ghost" size="xs" icon="i-lucide-trash-2" :aria-label="t('common.delete')" @click="deleteTarget = a" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / edit -->
    <UModal v-model:open="formOpen" :title="editingUuid ? t('promoters.payoutAccounts.editTitle') : t('promoters.payoutAccounts.createTitle')" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <UForm data-promoter-payout-account-form :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('promoters.payoutAccounts.fields.methods')" name="paymentMethodUuids" required>
              <USelectMenu v-model="state.paymentMethodUuids" multiple class="w-full" :items="methodOptions" label-key="label" value-key="value" :placeholder="t('common.select')" />
            </UFormField>
            <UFormField :label="t('promoters.payoutAccounts.fields.label')" name="label" :help="t('promoters.payoutAccounts.labelHelp')">
              <UInput v-model="state.label" class="w-full" maxlength="60" />
            </UFormField>
          </div>

          <div v-if="selectedMethods.length" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField v-if="required.bank" :label="t('promoters.payoutAccounts.fields.bank')" name="bankUuid" required>
              <CommonEntityReferenceSelect v-model="state.bankUuid" :items="bankOptions" :placeholder="t('common.select')" />
            </UFormField>
            <UFormField v-if="required.accountType" :label="t('promoters.payoutAccounts.fields.accountType')" name="accountType" required>
              <USelectMenu v-model="state.accountType" class="w-full" :items="BANK_ACCOUNT_TYPE_OPTIONS" label-key="label" value-key="value" :placeholder="t('common.select')" />
            </UFormField>
            <UFormField v-if="required.accountCode" :label="t('promoters.payoutAccounts.fields.accountNumber')" name="accountNumber" :help="t('promoters.payoutAccounts.accountNumberHelp')" required>
              <UInput v-model="state.accountNumber" inputmode="numeric" maxlength="20" class="w-full font-mono" />
            </UFormField>
            <UFormField v-if="required.bankAccount" :label="t('promoters.payoutAccounts.fields.accountIdentifier')" name="accountIdentifier" required>
              <UInput v-model="state.accountIdentifier" class="w-full" maxlength="120" />
            </UFormField>
            <UFormField v-if="required.phone" :label="t('promoters.payoutAccounts.fields.phone')" name="phone" required>
              <UInput v-model="state.phone" class="w-full" maxlength="30" :placeholder="t('promoters.payoutAccounts.placeholders.phone')" />
            </UFormField>
            <UFormField v-if="required.email" :label="t('promoters.payoutAccounts.fields.email')" name="email" required>
              <UInput v-model="state.email" type="email" class="w-full" maxlength="160" />
            </UFormField>
            <UFormField :label="t('promoters.payoutAccounts.fields.holderName')" name="holderName">
              <UInput v-model="state.holderName" class="w-full" maxlength="150" />
            </UFormField>
            <div class="grid grid-cols-[6rem_1fr] gap-2">
              <UFormField :label="t('promoters.payoutAccounts.fields.holderDocumentType')" name="holderDocumentType" :required="required.identification">
                <USelect v-model="state.holderDocumentType" :items="holderDocumentTypeOptions" class="w-full" :placeholder="t('common.select')" />
              </UFormField>
              <UFormField :label="t('promoters.payoutAccounts.fields.holderDocumentNumber')" name="holderDocumentNumber" :required="required.identification">
                <UInput v-model="state.holderDocumentNumber" inputmode="numeric" class="w-full" />
              </UFormField>
            </div>
          </div>
          <p v-else class="text-sm text-prohealth-500">{{ t('promoters.payoutAccounts.pickMethodHint') }}</p>

          <UCheckbox v-if="!editingUuid" v-model="state.isDefault" :label="t('promoters.payoutAccounts.fields.isDefault')" :description="t('promoters.payoutAccounts.isDefaultHelp')" />
          <button type="submit" class="hidden" />
        </UForm>
      </template>
      <template #footer>
        <div class="w-full space-y-2">
          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
          <div class="flex items-center justify-end gap-3">
            <UButton color="neutral" variant="ghost" :disabled="saving" @click="formOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" variant="outline" icon="i-lucide-save" :loading="saving" :disabled="!selectedMethods.length" @click="submitForm">{{ t('common.save') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation -->
    <UModal :open="Boolean(deleteTarget)" :title="t('promoters.payoutAccounts.deleteTitle')" @update:open="v => { if (!v) deleteTarget = null }">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ t('promoters.payoutAccounts.deleteConfirm', { method: deleteTarget ? deleteTarget.paymentMethods.map(m => m.name).join(', ') : '' }) }}
        </p>
        <p v-if="deleteTarget?.isDefault" class="text-xs text-amber-700 mt-2">{{ t('promoters.payoutAccounts.deleteDefaultWarning') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteTarget = null">{{ t('common.cancel') }}</UButton>
          <UButton color="error" icon="i-lucide-trash-2" :loading="deleting" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
