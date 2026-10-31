<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CatalogItem } from '~/types/catalogs'
import type { CompanyBankAccountDto, CompanyBankAccountRequest } from '~/types/payments'
import { BANK_ACCOUNT_TYPE_OPTIONS } from '~/types/payments'

// The company's own bank accounts (V201) — what payers see to know where to deposit, and what they
// pick on each payment line; also where a commission payout leaves from. Since V206 each account has a
// payment method and the form is method-first, like the advisor payout accounts: the method's `mandatory*`
// flags decide which fields show and are required (Pago Móvil = bank + document + phone; a transfer =
// account type + number; Zelle = email). Granular permissions per action; delete only deactivates.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'COMPANY_BANK_ACCOUNT_VIEW',
})

const { t } = useI18n()
const { can } = usePermissions()
const toast = useToast()
const accountsApi = useCompanyBankAccounts()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('payments.companyAccounts.title') }) })

const canCreate = computed(() => can('COMPANY_BANK_ACCOUNT_CREATE'))
const canUpdate = computed(() => can('COMPANY_BANK_ACCOUNT_UPDATE'))
const canDelete = computed(() => can('COMPANY_BANK_ACCOUNT_DELETE'))

// ---- List ----
const data = ref<CompanyBankAccountDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)
const search = ref('')
const includeInactive = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await accountsApi.list({
      page: page.value - 1,
      size: size.value,
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    // useApi already shows the error toast
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

const debouncedSearch = useTableFilterDebounce(() => {
  page.value = 1
  load()
})
watch(search, debouncedSearch)
watch(includeInactive, () => {
  page.value = 1
  load()
})
watch(page, load)

// ---- Bank / currency options (self-service read-only catalogs: no admin catalog permission needed) ----
const bankOptions = ref<{ label: string, value: string }[]>([])
const currencyOptions = ref<{ label: string, value: string }[]>([])
// The self-service method list already carries the `mandatory*` flags the form needs.
const methodItems = ref<CatalogItem[]>([])
const methodOptions = computed(() => methodItems.value.filter(m => m.active).map(m => ({ label: m.name, value: m.uuid })))

async function loadCatalogs() {
  try {
    const [banks, currencies, methods] = await Promise.all([
      useApi<CatalogItem[]>('/v1/me/banks'),
      useApi<CatalogItem[]>('/v1/me/currencies'),
      useApi<CatalogItem[]>('/v1/me/payment-methods'),
    ])
    methodItems.value = methods ?? []
    bankOptions.value = (banks ?? []).filter(b => b.active).map(b => ({ label: bankOptionLabel(b), value: b.uuid }))
    currencyOptions.value = (currencies ?? []).filter(c => c.active).map(c => ({ label: `${c.code} (${c.symbol})`, value: c.code! }))
  }
  catch {
    bankOptions.value = []
    currencyOptions.value = []
    methodItems.value = []
  }
}

onMounted(() => {
  load()
  loadCatalogs()
})

// ---- Create / edit ----
const formOpen = ref(false)
const editingUuid = ref<string | null>(null)
const saving = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

interface FormState {
  paymentMethodUuid: string
  bankUuid: string | undefined
  currency: string
  accountType: string
  accountNumber: string
  holderName: string
  holderDocument: string
  phone: string
  email: string
  notes: string
  sortOrder: string
  publicVisible: boolean
  active: boolean
}

function emptyState(): FormState {
  return {
    paymentMethodUuid: '',
    bankUuid: undefined,
    currency: 'USD',
    accountType: '',
    accountNumber: '',
    holderName: '',
    holderDocument: '',
    phone: '',
    email: '',
    notes: '',
    sortOrder: '0',
    publicVisible: false,
    active: true,
  }
}

const state = reactive<FormState>(emptyState())

const selectedMethod = computed(() => methodItems.value.find(m => m.uuid === state.paymentMethodUuid) ?? null)
// A transfer's account number may come from either flag (same rule as the backend).
const needsAccountNumber = computed(() => Boolean(selectedMethod.value?.mandatoryAccountCode || selectedMethod.value?.mandatoryBankAccount))

const requiredMsg = computed(() => t('validation.required'))
const schema = computed(() => {
  const m = selectedMethod.value
  const optional = (max: number) => z.string().max(max, t('validation.maxChars', { n: max })).optional()
  const required = (flag: boolean | undefined, max: number) => (flag
    ? z.string().min(1, requiredMsg.value).max(max, t('validation.maxChars', { n: max }))
    : optional(max))
  return z.object({
    paymentMethodUuid: z.string().min(1, requiredMsg.value),
    currency: z.string().min(1, requiredMsg.value),
    accountType: required(m?.mandatoryAccountType, 40),
    accountNumber: required(needsAccountNumber.value, 40),
    holderName: z.string().min(1, requiredMsg.value).max(160, t('validation.maxChars', { n: 160 })),
    holderDocument: required(m?.mandatoryIdentification, 30),
    phone: required(m?.mandatoryPhone, 30),
    email: m?.mandatoryEmail ? z.string().email(t('validation.emailInvalid')).max(160) : optional(160),
    notes: optional(255),
    sortOrder: z.string().regex(/^\d+$/, requiredMsg.value),
  }).refine(() => !m?.mandatoryBank || Boolean(state.bankUuid), { message: requiredMsg.value, path: ['bankUuid'] })
})

function openCreate() {
  editingUuid.value = null
  Object.assign(state, emptyState())
  formOpen.value = true
}

function openEdit(a: CompanyBankAccountDto) {
  editingUuid.value = a.uuid
  Object.assign(state, {
    paymentMethodUuid: a.paymentMethod_Uuid ?? '',
    bankUuid: a.bank_Uuid ?? undefined,
    currency: a.currency_Code,
    accountType: a.accountType ?? '',
    accountNumber: a.accountNumber ?? '',
    holderName: a.holderName,
    holderDocument: a.holderDocument ?? '',
    phone: a.phone ?? '',
    email: a.email ?? '',
    notes: a.notes ?? '',
    sortOrder: String(a.sortOrder),
    publicVisible: a.publicVisible,
    active: a.active,
  })
  formOpen.value = true
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  const m = selectedMethod.value
  saving.value = true
  try {
    // Fields the selected method does not use are sent as null, so switching the method does not leave the
    // previous method's data behind (same full-replace rule as the advisor payout accounts).
    const keep = (flag: boolean | undefined, value: string) => (flag && value.trim() ? value.trim() : null)
    const body: CompanyBankAccountRequest = {
      paymentMethodUuid: state.paymentMethodUuid,
      bankUuid: m?.mandatoryBank ? (state.bankUuid || null) : null,
      currency: state.currency,
      accountType: keep(m?.mandatoryAccountType, state.accountType),
      accountNumber: keep(needsAccountNumber.value, state.accountNumber),
      holderName: state.holderName.trim(),
      holderDocument: state.holderDocument.trim() || null,
      phone: keep(m?.mandatoryPhone, state.phone),
      email: keep(m?.mandatoryEmail, state.email),
      notes: state.notes.trim() || null,
      sortOrder: Number(state.sortOrder),
      publicVisible: state.publicVisible,
      active: state.active,
    }
    if (editingUuid.value) await accountsApi.update(editingUuid.value, body)
    else await accountsApi.create(body)
    toast.add({ title: t('payments.companyAccounts.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    formOpen.value = false
    await load()
  }
  catch {
    // useApi already notified the error
  }
  finally {
    saving.value = false
  }
}

function accountTypeLabel(value?: string | null): string {
  return BANK_ACCOUNT_TYPE_OPTIONS.find(option => option.value === value)?.label ?? value ?? ''
}

/** Account number, else phone, else email: what identifies the account at a glance. */
function destinationOf(a: CompanyBankAccountDto): string {
  return a.accountNumber || a.phone || a.email || ''
}

// ---- Delete (soft) ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<CompanyBankAccountDto | null>(null)

function openDelete(a: CompanyBankAccountDto) {
  target.value = a
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await accountsApi.remove(target.value.uuid)
    toast.add({ title: t('payments.companyAccounts.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // useApi already notified the error
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('payments.companyAccounts.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('payments.companyAccounts.subtitle') }}</p>
      </div>
      <UButton v-if="canCreate" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreate">
        {{ t('common.new') }}
      </UButton>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('payments.companyAccounts.searchPlaceholder')" class="w-full sm:w-80" />
      <USwitch v-model="includeInactive" :label="t('payments.companyAccounts.includeInactive')" />
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col">
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('payments.companyAccounts.fields.method') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.companyAccounts.fields.bank') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.companyAccounts.fields.destination') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.companyAccounts.fields.currency') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.companyAccounts.fields.holderName') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('catalogs.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="8" />
            <tr v-else-if="data.length === 0">
              <td colspan="8" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-piggy-bank" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('payments.companyAccounts.empty') }}
              </td>
            </tr>
            <tr v-for="a in data" v-else :key="a.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3 font-semibold text-prohealth-900">{{ a.paymentMethod_Display || a.paymentMethodCode || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-800">
                <BankName v-if="a.bank_Display || a.bankCode || a.bank_Code" :uuid="a.bank_Uuid" :code="a.bankCode ?? a.bank_Code" :name="a.bank_Display" />
                <template v-else>{{ t('common.empty') }}</template>
                <span v-if="a.accountType" class="block text-xs text-prohealth-500">{{ accountTypeLabel(a.accountType) }}</span>
              </td>
              <td class="px-5 py-3 font-mono text-prohealth-900">{{ destinationOf(a) || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ a.currency_Code }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ a.holderName }} <span v-if="a.holderDocument" class="text-xs text-prohealth-400">({{ a.holderDocument }})</span></td>
              <td class="px-5 py-3">
                <div class="flex flex-wrap items-center gap-1">
                  <UBadge :color="a.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                    {{ a.active ? t('catalogs.status.active') : t('catalogs.status.inactive') }}
                  </UBadge>
                  <UBadge :color="a.publicVisible ? 'info' : 'neutral'" variant="subtle" size="sm" :icon="a.publicVisible ? 'i-lucide-globe' : 'i-lucide-lock'">
                    {{ a.publicVisible ? t('payments.companyAccounts.public') : t('payments.companyAccounts.private') }}
                  </UBadge>
                </div>
              </td>
              <td class="px-5 py-3 text-right whitespace-nowrap">
                <UButton v-if="canUpdate" color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEdit(a)" />
                <UButton v-if="canDelete && a.active" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" @click="openDelete(a)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100">
        <p class="text-xs text-prohealth-500">{{ t('catalogs.recordCount', { count: total }) }}</p>
        <UPagination v-model:page="page" :total="total" :items-per-page="size" />
      </div>
    </div>

    <!-- Create / edit modal -->
    <UModal
      v-model:open="formOpen"
      :title="editingUuid ? t('payments.companyAccounts.editTitle') : t('payments.companyAccounts.createTitle')"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('payments.companyAccounts.fields.method')" name="paymentMethodUuid" required>
              <USelectMenu v-model="state.paymentMethodUuid" :items="methodOptions" label-key="label" value-key="value" :placeholder="t('common.select')" class="w-full" />
            </UFormField>
            <UFormField :label="t('payments.companyAccounts.fields.currency')" name="currency" required>
              <USelectMenu v-model="state.currency" :items="currencyOptions" label-key="label" value-key="value" class="w-full font-mono" />
            </UFormField>
          </div>
          <template v-if="selectedMethod">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField v-if="selectedMethod.mandatoryBank" :label="t('payments.companyAccounts.fields.bank')" name="bankUuid" required>
                <USelectMenu v-model="state.bankUuid" :items="bankOptions" label-key="label" value-key="value" :placeholder="t('common.select')" class="w-full" />
              </UFormField>
              <UFormField v-if="selectedMethod.mandatoryAccountType" :label="t('payments.companyAccounts.fields.accountType')" name="accountType" required>
                <USelectMenu v-model="state.accountType" :items="BANK_ACCOUNT_TYPE_OPTIONS" label-key="label" value-key="value" :placeholder="t('common.select')" class="w-full" />
              </UFormField>
              <UFormField v-if="needsAccountNumber" :label="t('payments.companyAccounts.fields.accountNumber')" name="accountNumber" required>
                <UInput v-model="state.accountNumber" class="w-full font-mono" maxlength="40" />
              </UFormField>
              <UFormField v-if="selectedMethod.mandatoryPhone" :label="t('payments.companyAccounts.fields.phone')" name="phone" required>
                <UInput v-model="state.phone" class="w-full font-mono" inputmode="tel" maxlength="30" :placeholder="t('payments.companyAccounts.phonePlaceholder')" />
              </UFormField>
              <UFormField v-if="selectedMethod.mandatoryEmail" :label="t('payments.companyAccounts.fields.email')" name="email" required>
                <UInput v-model="state.email" type="email" class="w-full" maxlength="160" />
              </UFormField>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField :label="t('payments.companyAccounts.fields.holderName')" name="holderName" required>
                <UInput v-model="state.holderName" class="w-full" maxlength="160" />
              </UFormField>
              <UFormField :label="t('payments.companyAccounts.fields.holderDocument')" name="holderDocument" :required="Boolean(selectedMethod.mandatoryIdentification)" :help="t('payments.companyAccounts.holderDocumentHelp')">
                <UInput v-model="state.holderDocument" class="w-full" maxlength="30" />
              </UFormField>
            </div>
          </template>
          <p v-else class="text-sm text-prohealth-500">{{ t('payments.companyAccounts.pickMethodHint') }}</p>
          <UFormField :label="t('payments.companyAccounts.fields.notes')" name="notes">
            <UTextarea v-model="state.notes" :rows="2" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <UFormField :label="t('payments.companyAccounts.fields.sortOrder')" name="sortOrder" :help="t('payments.companyAccounts.sortOrderHelp')">
              <UInput v-model="state.sortOrder" type="number" min="0" class="w-full" />
            </UFormField>
            <UFormField v-if="editingUuid" :label="t('catalogs.fields.active')" name="active">
              <USwitch v-model="state.active" />
            </UFormField>
          </div>
          <UCheckbox
            v-model="state.publicVisible"
            :label="t('payments.companyAccounts.fields.publicVisible')"
            :description="t('payments.companyAccounts.publicHelp')"
          />
        </UForm>
      </template>
      <template #footer>
        <div class="w-full space-y-2">
          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
          <div class="flex items-center justify-end gap-3">
            <UButton color="neutral" variant="ghost" :disabled="saving" @click="formOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" variant="outline" :loading="saving" icon="i-lucide-save" @click="formRef?.submit()">{{ t('common.save') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('payments.companyAccounts.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('payments.companyAccounts.deleteConfirm') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
