<script setup lang="ts">
import type { CatalogItem } from '~/types/catalogs'
import type { SavedOriginAccountDto } from '~/types/payments'
import { BANK_ACCOUNT_TYPE_OPTIONS } from '~/types/payments'

// "Mis cuentas bancarias" — the origin accounts the caller pays FROM, which a payment form offers to reuse.
// Own data, so any logged-in user may manage them (no permission gate): the backend scopes every call to the
// caller's person (GET/POST/PUT/DELETE /v1/me/bank-accounts, V204). Banks come from the authenticated
// /v1/me/banks catalog, the same one the payment form uses.
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const toast = useToast()
const api = useMyBankAccounts()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('myBankAccounts.title') }) })

const accounts = ref<SavedOriginAccountDto[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    accounts.value = (await api.list()) ?? []
  }
  catch {
    accounts.value = []
  }
  finally {
    loading.value = false
  }
}

const bankItems = ref<CatalogItem[]>([])
const bankOptions = computed(() => bankItems.value.map(b => ({
  label: bankOptionLabel(b),
  value: b.uuid,
})))

async function loadBanks() {
  try {
    bankItems.value = ((await useApi<CatalogItem[]>('/v1/me/banks')) ?? []).filter(b => b.active)
  }
  catch {
    bankItems.value = []
  }
}

onMounted(() => {
  load()
  loadBanks()
})

function typeLabel(value?: string | null): string {
  return BANK_ACCOUNT_TYPE_OPTIONS.find(o => o.value === value)?.label ?? value ?? t('common.empty')
}

// ---- Create / edit ----
interface FormState {
  bankUuid: string
  accountType: string
  accountCode: string
  accountIdentifier: string
  identification: string
  alias: string
}

const emptyForm = (): FormState => ({
  bankUuid: '', accountType: '', accountCode: '', accountIdentifier: '', identification: '', alias: '',
})

const formOpen = ref(false)
const editing = ref<SavedOriginAccountDto | null>(null)
const state = reactive<FormState>(emptyForm())
const saving = ref(false)
const submitted = ref(false)

const missingBank = computed(() => submitted.value && !state.bankUuid)
const missingNumber = computed(() => submitted.value && !state.accountIdentifier.trim())

function openCreate() {
  editing.value = null
  Object.assign(state, emptyForm())
  submitted.value = false
  formOpen.value = true
}

function openEdit(account: SavedOriginAccountDto) {
  editing.value = account
  Object.assign(state, {
    bankUuid: account.bank_Uuid ?? '',
    accountType: account.accountType ?? '',
    accountCode: account.accountCode ?? '',
    accountIdentifier: account.accountIdentifier,
    identification: account.identification ?? '',
    alias: account.alias ?? '',
  })
  submitted.value = false
  formOpen.value = true
}

async function save() {
  submitted.value = true
  if (!state.bankUuid || !state.accountIdentifier.trim()) return
  saving.value = true
  const body = {
    bankUuid: state.bankUuid,
    accountType: state.accountType || null,
    accountCode: state.accountCode.trim() || null,
    accountIdentifier: state.accountIdentifier.trim(),
    identification: state.identification.trim() || null,
    alias: state.alias.trim() || null,
  }
  try {
    if (editing.value) await api.update(editing.value.uuid, body)
    else await api.create(body)
    toast.add({ title: t('myBankAccounts.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    formOpen.value = false
    await load()
  }
  catch (error) {
    // 400/404 reach the component instead of the global toast (useApi): show the backend's own message
    // (for example a duplicate bank + number).
    toast.add({
      title: (error as { message?: string }).message || t('errors.unexpected'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  }
  finally {
    saving.value = false
  }
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<SavedOriginAccountDto | null>(null)

function openDelete(account: SavedOriginAccountDto) {
  target.value = account
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await api.remove(target.value.uuid)
    toast.add({ title: t('myBankAccounts.removedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    await load()
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
  <div class="space-y-6 max-w-4xl">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('myBankAccounts.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('myBankAccounts.subtitle') }}</p>
      </div>
      <UButton icon="i-lucide-plus" @click="openCreate">{{ t('myBankAccounts.add') }}</UButton>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div v-if="loading" class="p-6 space-y-3">
        <USkeleton v-for="n in 3" :key="n" class="h-10 w-full rounded" />
      </div>

      <div v-else-if="!accounts.length" class="px-5 py-12 text-center text-prohealth-500">
        <UIcon name="i-lucide-landmark" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
        <p class="text-sm">{{ t('myBankAccounts.empty') }}</p>
      </div>

      <table v-else class="w-full text-sm">
        <thead class="bg-prohealth-50 text-left text-prohealth-700">
          <tr>
            <th class="px-5 py-3 font-semibold">{{ t('myBankAccounts.fields.bank') }}</th>
            <th class="px-5 py-3 font-semibold">{{ t('myBankAccounts.fields.accountType') }}</th>
            <th class="px-5 py-3 font-semibold">{{ t('myBankAccounts.fields.accountIdentifier') }}</th>
            <th class="px-5 py-3 font-semibold">{{ t('myBankAccounts.fields.identification') }}</th>
            <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <tr v-for="a in accounts" :key="a.uuid" class="hover:bg-prohealth-50/50">
            <td class="px-5 py-3 text-prohealth-900">
              {{ a.bank_Display ?? a.bank_Code ?? t('common.empty') }}
              <p v-if="a.alias" class="text-xs text-prohealth-500">{{ a.alias }}</p>
            </td>
            <td class="px-5 py-3 text-prohealth-600">{{ typeLabel(a.accountType) }}</td>
            <td class="px-5 py-3 font-mono text-prohealth-800">{{ a.accountIdentifier }}</td>
            <td class="px-5 py-3 text-prohealth-600">{{ a.identification ?? t('common.empty') }}</td>
            <td class="px-5 py-3 text-right">
              <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" :aria-label="t('common.edit')" @click="openEdit(a)" />
              <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :aria-label="t('common.delete')" @click="openDelete(a)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / edit modal -->
    <UModal
      v-model:open="formOpen"
      :title="editing ? t('myBankAccounts.editTitle') : t('myBankAccounts.addTitle')"
      :description="t('myBankAccounts.formHelp')"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('myBankAccounts.fields.bank')" required :error="missingBank ? t('validation.required') : undefined">
            <USelectMenu v-model="state.bankUuid" :items="bankOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('myBankAccounts.fields.accountType')">
              <USelectMenu v-model="state.accountType" clear :items="BANK_ACCOUNT_TYPE_OPTIONS" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField :label="t('myBankAccounts.fields.accountCode')">
              <UInput v-model="state.accountCode" class="w-full" maxlength="40" />
            </UFormField>
          </div>

          <UFormField :label="t('myBankAccounts.fields.accountIdentifier')" required :error="missingNumber ? t('validation.required') : undefined">
            <UInput v-model="state.accountIdentifier" class="w-full" maxlength="120" inputmode="numeric" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('myBankAccounts.fields.identification')" :help="t('myBankAccounts.identificationHelp')">
              <UInput v-model="state.identification" class="w-full" maxlength="80" />
            </UFormField>
            <UFormField :label="t('myBankAccounts.fields.alias')" :help="t('myBankAccounts.aliasHelp')">
              <UInput v-model="state.alias" class="w-full" maxlength="80" />
            </UFormField>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="saving" @click="formOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton :loading="saving" icon="i-lucide-check" @click="save">{{ t('common.save') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('myBankAccounts.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('myBankAccounts.deleteConfirm') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
