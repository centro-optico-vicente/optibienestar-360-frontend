<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CatalogItem } from '~/types/catalogs'
import type { CompanyBankAccountDto, CompanyBankAccountRequest } from '~/types/payments'
import { BANK_ACCOUNT_TYPE_OPTIONS } from '~/types/payments'

// The company's own bank accounts (V201) — what payers see to know where to deposit, and what they
// pick on each payment line. Granular permissions per action; delete only deactivates.
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

async function loadCatalogs() {
  try {
    const [banks, currencies] = await Promise.all([
      useApi<CatalogItem[]>('/v1/me/banks'),
      useApi<CatalogItem[]>('/v1/me/currencies'),
    ])
    bankOptions.value = (banks ?? []).filter(b => b.active).map(b => ({ label: b.code ? `${b.code} — ${b.name}` : b.name, value: b.uuid }))
    currencyOptions.value = (currencies ?? []).filter(c => c.active).map(c => ({ label: `${c.code} (${c.symbol})`, value: c.code! }))
  }
  catch {
    bankOptions.value = []
    currencyOptions.value = []
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

const state = reactive({
  bankUuid: '',
  currency: 'USD',
  accountType: 'CORRIENTE',
  accountNumber: '',
  holderName: '',
  holderDocument: '',
  notes: '',
  sortOrder: '0',
  active: true,
})

const schema = computed(() => z.object({
  bankUuid: z.string().min(1, t('validation.required')),
  currency: z.string().min(1, t('validation.required')),
  accountType: z.string().min(1, t('validation.required')),
  accountNumber: z.string().min(1, t('validation.required')).max(40, t('validation.maxChars', { n: 40 })),
  holderName: z.string().min(1, t('validation.required')).max(160, t('validation.maxChars', { n: 160 })),
  holderDocument: z.string().min(1, t('validation.required')).max(30, t('validation.maxChars', { n: 30 })),
  notes: z.string().max(255, t('validation.maxChars', { n: 255 })).optional(),
  sortOrder: z.string().regex(/^\d+$/, t('validation.required')),
}))

function openCreate() {
  editingUuid.value = null
  Object.assign(state, { bankUuid: '', currency: 'USD', accountType: 'CORRIENTE', accountNumber: '', holderName: '', holderDocument: '', notes: '', sortOrder: '0', active: true })
  formOpen.value = true
}

function openEdit(a: CompanyBankAccountDto) {
  editingUuid.value = a.uuid
  Object.assign(state, {
    bankUuid: a.bank_Uuid ?? '',
    currency: a.currency_Code,
    accountType: a.accountType,
    accountNumber: a.accountNumber,
    holderName: a.holderName,
    holderDocument: a.holderDocument,
    notes: a.notes ?? '',
    sortOrder: String(a.sortOrder),
    active: a.active,
  })
  formOpen.value = true
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  saving.value = true
  try {
    const body: CompanyBankAccountRequest = {
      bankUuid: state.bankUuid,
      currency: state.currency,
      accountType: state.accountType,
      accountNumber: state.accountNumber.trim(),
      holderName: state.holderName.trim(),
      holderDocument: state.holderDocument.trim(),
      notes: state.notes.trim() || undefined,
      sortOrder: Number(state.sortOrder),
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
              <th class="px-5 py-3 font-semibold">{{ t('payments.companyAccounts.fields.bank') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.companyAccounts.fields.accountNumber') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.companyAccounts.fields.accountType') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.companyAccounts.fields.currency') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.companyAccounts.fields.holderName') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('catalogs.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-piggy-bank" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('payments.companyAccounts.empty') }}
              </td>
            </tr>
            <tr v-for="a in data" v-else :key="a.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3 text-prohealth-800">{{ a.bank_Display ?? a.bank_Code }}</td>
              <td class="px-5 py-3 font-mono text-prohealth-900">{{ a.accountNumber }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ a.accountType }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ a.currency_Code }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ a.holderName }} <span class="text-xs text-prohealth-400">({{ a.holderDocument }})</span></td>
              <td class="px-5 py-3">
                <UBadge :color="a.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ a.active ? t('catalogs.status.active') : t('catalogs.status.inactive') }}
                </UBadge>
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
            <UFormField :label="t('payments.companyAccounts.fields.bank')" name="bankUuid" required>
              <USelectMenu v-model="state.bankUuid" :items="bankOptions" label-key="label" value-key="value" :placeholder="t('common.select')" class="w-full" />
            </UFormField>
            <UFormField :label="t('payments.companyAccounts.fields.currency')" name="currency" required>
              <USelectMenu v-model="state.currency" :items="currencyOptions" label-key="label" value-key="value" class="w-full font-mono" />
            </UFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('payments.companyAccounts.fields.accountType')" name="accountType" required>
              <USelectMenu v-model="state.accountType" :items="BANK_ACCOUNT_TYPE_OPTIONS" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField :label="t('payments.companyAccounts.fields.accountNumber')" name="accountNumber" required>
              <UInput v-model="state.accountNumber" class="w-full font-mono" />
            </UFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('payments.companyAccounts.fields.holderName')" name="holderName" required>
              <UInput v-model="state.holderName" class="w-full" />
            </UFormField>
            <UFormField :label="t('payments.companyAccounts.fields.holderDocument')" name="holderDocument" required>
              <UInput v-model="state.holderDocument" class="w-full" />
            </UFormField>
          </div>
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
