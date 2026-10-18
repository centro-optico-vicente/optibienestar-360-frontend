<script setup lang="ts">
import { z } from 'zod'
import type { CatalogItem } from '~/types/catalogs'
import type { PromoterPayoutProfileDto, PromoterPayoutProfileRequest } from '~/types/promoters'

// "Datos de cobro" tab of the advisor detail (backend V180, dossier section V):
// 1:1 payout profile used to prefill commission payouts (OutPaymentFormModal).
// GET always answers 200 when the promoter exists — `exists=false` means "not
// filled yet" (empty state), never a 404. PUT is a full replace.
const props = defineProps<{
  promoterUuid: string
  /** PROMOTER_UPDATE and not the INSTITUCION system row. */
  canEdit: boolean
}>()

const { t } = useI18n()
const promoters = usePromoters()
const banksApi = useCatalog('/v1/admin/banks')
const toast = useToast()

const profile = ref<PromoterPayoutProfileDto | null>(null)
const loading = ref(false)
const editing = ref(false)
const saving = ref(false)
const deleteOpen = ref(false)
const deleting = ref(false)

const bankOptions = ref<{ label: string, value: string }[]>([])
async function loadBanks() {
  try {
    const banks = await banksApi.listAll()
    bankOptions.value = banks
      .filter((bank: CatalogItem) => bank.active)
      .map((bank: CatalogItem) => ({ label: bank.code ? `${bank.code} — ${bank.name}` : bank.name, value: bank.uuid }))
  }
  catch {
    bankOptions.value = []
  }
}

const holderDocumentTypeOptions = ['V', 'E', 'J', 'G', 'P'].map(v => ({ label: v, value: v }))

interface FormState {
  bankUuid: string | undefined
  accountNumber: string
  accountHolderDocumentType: string | undefined
  accountHolderDocumentNumber: string
  mobilePaymentPhone: string
  mobilePaymentBankUuid: string | undefined
  ubiiAccount: string
  ubiiHolderName: string
}

const state = reactive<FormState>({
  bankUuid: undefined,
  accountNumber: '',
  accountHolderDocumentType: undefined,
  accountHolderDocumentNumber: '',
  mobilePaymentPhone: '',
  mobilePaymentBankUuid: undefined,
  ubiiAccount: '',
  ubiiHolderName: '',
})

function populate(p: PromoterPayoutProfileDto | null) {
  state.bankUuid = p?.bank_Uuid ?? undefined
  state.accountNumber = p?.accountNumber ?? ''
  state.accountHolderDocumentType = p?.accountHolderDocumentType ?? undefined
  state.accountHolderDocumentNumber = p?.accountHolderDocumentNumber ?? ''
  state.mobilePaymentPhone = p?.mobilePaymentPhone ?? ''
  state.mobilePaymentBankUuid = p?.mobilePaymentBank_Uuid ?? undefined
  state.ubiiAccount = p?.ubiiAccount ?? ''
  state.ubiiHolderName = p?.ubiiHolderName ?? ''
}

async function load() {
  loading.value = true
  try {
    profile.value = await promoters.getPayoutProfile(props.promoterUuid)
  }
  catch {
    profile.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
defineExpose({ load })

function startEdit() {
  populate(profile.value)
  if (!bankOptions.value.length) loadBanks()
  editing.value = true
}

const schema = computed(() => z.object({
  accountNumber: z.string().regex(/^(\d{20})?$/, t('promoters.payoutProfile.validation.accountNumber')).optional(),
  accountHolderDocumentNumber: z.string().regex(/^(\d{1,10})?$/, t('validation.digitsOnly')).optional(),
  mobilePaymentPhone: z.string().max(30, t('validation.maxChars', { n: 30 })).optional(),
  ubiiAccount: z.string().max(60, t('validation.maxChars', { n: 60 })).optional(),
  ubiiHolderName: z.string().max(150, t('validation.maxChars', { n: 150 })).optional(),
}).refine(v => Boolean(state.accountHolderDocumentType) === Boolean(v.accountHolderDocumentNumber?.trim()), {
  message: t('promoters.payoutProfile.validation.holderPair'),
  path: ['accountHolderDocumentNumber'],
}))

async function onSubmit() {
  saving.value = true
  try {
    const body: PromoterPayoutProfileRequest = {
      bankUuid: state.bankUuid || null,
      accountNumber: state.accountNumber.trim() || null,
      accountHolderDocumentType: state.accountHolderDocumentType || null,
      accountHolderDocumentNumber: state.accountHolderDocumentNumber.trim() || null,
      mobilePaymentPhone: state.mobilePaymentPhone.trim() || null,
      mobilePaymentBankUuid: state.mobilePaymentBankUuid || null,
      ubiiAccount: state.ubiiAccount.trim() || null,
      ubiiHolderName: state.ubiiHolderName.trim() || null,
    }
    profile.value = await promoters.savePayoutProfile(props.promoterUuid, body)
    toast.add({ title: t('promoters.payoutProfile.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    editing.value = false
  }
  catch {
    // useApi already reported the API error.
  }
  finally {
    saving.value = false
  }
}

async function confirmDelete() {
  deleting.value = true
  try {
    await promoters.removePayoutProfile(props.promoterUuid)
    toast.add({ title: t('promoters.payoutProfile.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    await load()
  }
  catch {
    // useApi already reported the API error.
  }
  finally {
    deleting.value = false
  }
}

function holderDocument(p: PromoterPayoutProfileDto): string {
  return p.accountHolderDocumentType && p.accountHolderDocumentNumber
    ? `${p.accountHolderDocumentType}-${p.accountHolderDocumentNumber}`
    : t('common.empty')
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('promoters.payoutProfile.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('promoters.payoutProfile.hint') }}</p>
      </div>
      <div v-if="!editing" class="flex items-center gap-2">
        <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
        <UButton v-if="canEdit && profile?.exists" size="xs" color="info" variant="soft" icon="i-lucide-pencil" @click="startEdit">
          {{ t('common.edit') }}
        </UButton>
        <UButton v-if="canEdit && profile?.exists" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('common.delete')" @click="deleteOpen = true" />
      </div>
    </div>

    <div v-if="loading" class="p-6 space-y-3">
      <USkeleton class="h-4 w-64 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- Form (create or edit) -->
    <UForm v-else-if="editing" :schema="schema" :state="state" class="p-6 space-y-6" @submit="onSubmit">
      <section class="space-y-4">
        <h3 class="text-sm font-semibold text-prohealth-800">{{ t('promoters.payoutProfile.sections.bankAccount') }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('promoters.payoutProfile.fields.bank')" name="bankUuid">
            <CommonEntityReferenceSelect v-model="state.bankUuid" :items="bankOptions" :placeholder="t('common.select')" />
          </UFormField>
          <UFormField :label="t('promoters.payoutProfile.fields.accountNumber')" name="accountNumber" :help="t('promoters.payoutProfile.accountNumberHelp')">
            <UInput v-model="state.accountNumber" inputmode="numeric" maxlength="20" class="w-full font-mono" />
          </UFormField>
          <UFormField :label="t('promoters.payoutProfile.fields.holderDocumentType')" name="accountHolderDocumentType">
            <USelect v-model="state.accountHolderDocumentType" :items="holderDocumentTypeOptions" class="w-full" :placeholder="t('common.select')" />
          </UFormField>
          <UFormField :label="t('promoters.payoutProfile.fields.holderDocumentNumber')" name="accountHolderDocumentNumber">
            <UInput v-model="state.accountHolderDocumentNumber" inputmode="numeric" class="w-full" />
          </UFormField>
        </div>
      </section>

      <section class="space-y-4">
        <h3 class="text-sm font-semibold text-prohealth-800">{{ t('promoters.payoutProfile.sections.mobilePayment') }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('promoters.payoutProfile.fields.mobilePaymentPhone')" name="mobilePaymentPhone">
            <UInput v-model="state.mobilePaymentPhone" class="w-full" :placeholder="t('promoters.payoutProfile.placeholders.phone')" />
          </UFormField>
          <UFormField :label="t('promoters.payoutProfile.fields.mobilePaymentBank')" name="mobilePaymentBankUuid">
            <CommonEntityReferenceSelect v-model="state.mobilePaymentBankUuid" :items="bankOptions" :placeholder="t('common.select')" />
          </UFormField>
        </div>
      </section>

      <section class="space-y-4">
        <h3 class="text-sm font-semibold text-prohealth-800">{{ t('promoters.payoutProfile.sections.ubii') }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('promoters.payoutProfile.fields.ubiiAccount')" name="ubiiAccount">
            <UInput v-model="state.ubiiAccount" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.payoutProfile.fields.ubiiHolderName')" name="ubiiHolderName">
            <UInput v-model="state.ubiiHolderName" class="w-full" />
          </UFormField>
        </div>
      </section>

      <div class="flex justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="saving" @click="editing = false">{{ t('common.cancel') }}</UButton>
        <UButton type="submit" color="primary" variant="outline" icon="i-lucide-save" :loading="saving">{{ t('common.save') }}</UButton>
      </div>
    </UForm>

    <!-- Empty state -->
    <div v-else-if="!profile?.exists" class="px-6 py-12 text-center">
      <UIcon name="i-lucide-wallet" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('promoters.payoutProfile.emptyTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('promoters.payoutProfile.emptyBody') }}</p>
      <UButton v-if="canEdit" class="mt-4" color="primary" icon="i-lucide-plus" @click="startEdit">
        {{ t('promoters.payoutProfile.add') }}
      </UButton>
    </div>

    <!-- Read-only view -->
    <dl v-else class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
      <div>
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.payoutProfile.fields.bank') }}</dt>
        <dd class="text-prohealth-800 mt-0.5">{{ profile.bank_Display || t('common.empty') }}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.payoutProfile.fields.accountNumber') }}</dt>
        <dd class="text-prohealth-800 mt-0.5 font-mono">{{ profile.accountNumber || t('common.empty') }}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.payoutProfile.fields.holderDocument') }}</dt>
        <dd class="text-prohealth-800 mt-0.5 font-mono">{{ holderDocument(profile) }}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.payoutProfile.fields.mobilePaymentPhone') }}</dt>
        <dd class="text-prohealth-800 mt-0.5">{{ profile.mobilePaymentPhone || t('common.empty') }}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.payoutProfile.fields.mobilePaymentBank') }}</dt>
        <dd class="text-prohealth-800 mt-0.5">{{ profile.mobilePaymentBank_Display || t('common.empty') }}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.payoutProfile.fields.ubiiAccount') }}</dt>
        <dd class="text-prohealth-800 mt-0.5">{{ profile.ubiiAccount || t('common.empty') }}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.payoutProfile.fields.ubiiHolderName') }}</dt>
        <dd class="text-prohealth-800 mt-0.5">{{ profile.ubiiHolderName || t('common.empty') }}</dd>
      </div>
    </dl>

    <UModal v-model:open="deleteOpen" :title="t('promoters.payoutProfile.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('promoters.payoutProfile.deleteConfirm') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" icon="i-lucide-trash-2" :loading="deleting" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
