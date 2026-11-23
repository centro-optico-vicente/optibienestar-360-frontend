<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import type { MemberListItemDto } from '~/types/members'
import type { CorporateContractCreateRequest, CorporateContractDto, CorporateContractUpdateRequest, PayerMode } from '~/types/corporateContracts'
import { PAYER_MODES } from '~/types/corporateContracts'

// Corporate contracts (backend V38/V79): an institution on a CORPORATIVO plan, billed either in bulk to the
// institution or member by member (payer mode). This screen lists, creates, edits and deletes contracts and
// shows the members enrolled under each one. Bulk enrollment stays on the API for now.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'CORPORATE_CONTRACT_VIEW_ALL',
})

const { t } = useI18n()
const { can } = usePermissions()
const toast = useToast()
const contractsApi = useCorporateContracts()
const plansApi = usePlans()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('plans.corporateContracts.title') }) })

const canCreate = computed(() => can('CORPORATE_CONTRACT_CREATE'))
const canUpdate = computed(() => can('CORPORATE_CONTRACT_UPDATE'))
const canDelete = computed(() => can('CORPORATE_CONTRACT_DELETE'))
const canViewMembers = computed(() => can('CORPORATE_CONTRACT_MEMBER_VIEW_ALL'))

const payerModeOptions = computed(() => PAYER_MODES.map(m => ({ label: t(`plans.corporateContracts.payerMode.${m}`), value: m })))

function planSearch(current: () => string | undefined) {
  return async (q: string): Promise<SelectItem[]> => {
    const value = current()
    const res = await plansApi.options({ ...(q ? { q } : {}), limit: DROPDOWN_PAGE_SIZE, ...(value ? { currentValues: [value] } : {}) })
    return res.map(o => ({ label: o.label, value: o.uuid }))
  }
}

// ---- List ----
const data = ref<CorporateContractDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)
const search = ref('')
const planFilter = ref('')
const searchPlansFilter = planSearch(() => planFilter.value || undefined)

async function load() {
  loading.value = true
  try {
    const res = await contractsApi.list({
      page: page.value - 1,
      size: size.value,
      q: search.value.trim() || undefined,
      planUuid: planFilter.value || undefined,
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

function reloadFromFirstPage() {
  if (page.value !== 1) page.value = 1
  else load()
}
watch(planFilter, reloadFromFirstPage)
const debouncedSearchLoad = useTableFilterDebounce(() => {
  reloadFromFirstPage()
})
watch(search, () => {
  debouncedSearchLoad()
})
watch(page, load)
onMounted(load)

// ---- Create / edit ----
const formOpen = ref(false)
const editingUuid = ref<string | null>(null)
const loadingDetailUuid = ref<string | null>(null)
const saving = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

interface FormState {
  planUuid: string | undefined
  institutionName: string
  institutionTaxId: string
  payerMode: PayerMode
  expectedMemberCount: string
  active: boolean
}

function emptyState(): FormState {
  return {
    planUuid: undefined,
    institutionName: '',
    institutionTaxId: '',
    payerMode: 'INSTITUTION_BULK',
    expectedMemberCount: '',
    active: true,
  }
}

const state = reactive<FormState>(emptyState())
const searchPlansForm = planSearch(() => state.planUuid)

const schema = computed(() => {
  const requiredMsg = t('validation.required')
  return z.object({
    planUuid: z.string({ message: requiredMsg }).min(1, requiredMsg),
    institutionName: z.string().trim().min(1, requiredMsg).max(200, t('validation.maxChars', { n: 200 })),
    institutionTaxId: z.string().trim().min(1, requiredMsg).max(20, t('validation.maxChars', { n: 20 })),
    payerMode: z.enum(PAYER_MODES),
    expectedMemberCount: z.string().refine(v => v.trim() === '' || /^\d+$/.test(v.trim()), t('plans.corporateContracts.validation.wholeNumber')),
  })
})

function openCreate() {
  editingUuid.value = null
  Object.assign(state, emptyState())
  formOpen.value = true
}

/** Edit loads the detail (GET /{uuid}), never the list row. */
async function openEdit(row: CorporateContractDto) {
  loadingDetailUuid.value = row.uuid
  try {
    const c = await contractsApi.get(row.uuid)
    editingUuid.value = c.uuid
    Object.assign(state, {
      planUuid: c.plan_Uuid ?? undefined,
      institutionName: c.institutionName,
      institutionTaxId: c.institutionTaxId,
      payerMode: c.payerMode,
      expectedMemberCount: c.expectedMemberCount === null ? '' : String(c.expectedMemberCount),
      active: c.active,
    })
    formOpen.value = true
  }
  catch {
    // useApi already notified the error
  }
  finally {
    loadingDetailUuid.value = null
  }
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  saving.value = true
  const expected = state.expectedMemberCount.trim() === '' ? null : Number(state.expectedMemberCount)
  try {
    if (editingUuid.value) {
      const body: CorporateContractUpdateRequest = {
        planUuid: state.planUuid ?? null,
        institutionName: state.institutionName.trim(),
        institutionTaxId: state.institutionTaxId.trim(),
        payerMode: state.payerMode,
        expectedMemberCount: expected,
        active: state.active,
      }
      await contractsApi.update(editingUuid.value, body)
    }
    else {
      const body: CorporateContractCreateRequest = {
        planUuid: state.planUuid!,
        institutionName: state.institutionName.trim(),
        institutionTaxId: state.institutionTaxId.trim(),
        payerMode: state.payerMode,
        expectedMemberCount: expected,
      }
      await contractsApi.create(body)
    }
    toast.add({ title: t('plans.corporateContracts.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<CorporateContractDto | null>(null)

function openDelete(c: CorporateContractDto) {
  target.value = c
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await contractsApi.remove(target.value.uuid)
    toast.add({ title: t('plans.corporateContracts.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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

// ---- Enrolled members ----
const membersOpen = ref(false)
const membersLoading = ref(false)
const membersTarget = ref<CorporateContractDto | null>(null)
const members = ref<MemberListItemDto[]>([])
const membersTotal = ref(0)
const membersPage = ref(1)
const membersSize = 10

async function loadMembers() {
  if (!membersTarget.value) return
  membersLoading.value = true
  try {
    const res = await contractsApi.members(membersTarget.value.uuid, { page: membersPage.value - 1, size: membersSize })
    members.value = res.content ?? []
    membersTotal.value = res.totalElements ?? 0
  }
  catch {
    members.value = []
    membersTotal.value = 0
  }
  finally {
    membersLoading.value = false
  }
}

function openMembers(c: CorporateContractDto) {
  membersTarget.value = c
  members.value = []
  membersTotal.value = 0
  membersOpen.value = true
  if (membersPage.value !== 1) membersPage.value = 1
  else loadMembers()
}
watch(membersPage, loadMembers)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('plans.corporateContracts.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('plans.corporateContracts.subtitle') }}</p>
      </div>
      <UButton v-if="canCreate" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreate">
        {{ t('common.new') }}
      </UButton>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('plans.corporateContracts.searchPlaceholder')" class="w-full sm:w-72" />
      <CommonEntityReferenceSelect
        v-model="planFilter"
        :search="searchPlansFilter"
        entity="plan"
        icon="i-lucide-package"
        :placeholder="t('plans.corporateContracts.filters.plan')"
        class="w-full sm:w-60"
      />
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col">
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('plans.corporateContracts.columns.institution') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('plans.corporateContracts.columns.plan') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('plans.corporateContracts.columns.payerMode') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('plans.corporateContracts.columns.members') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('catalogs.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-building" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('plans.corporateContracts.empty') }}
              </td>
            </tr>
            <tr v-for="c in data" v-else :key="c.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3">
                <span class="font-medium text-prohealth-900">{{ c.institutionName }}</span>
                <span class="block text-xs text-prohealth-500 font-mono">{{ c.institutionTaxId }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ c.plan_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ c.payerMode_Display ?? t(`plans.corporateContracts.payerMode.${c.payerMode}`) }}</td>
              <td class="px-5 py-3 text-prohealth-700 whitespace-nowrap">
                {{ c.expectedMemberCount === null
                  ? c.actualMemberCount
                  : t('plans.corporateContracts.memberCount', { actual: c.actualMemberCount, expected: c.expectedMemberCount }) }}
              </td>
              <td class="px-5 py-3">
                <UBadge :color="c.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ c.active ? t('catalogs.status.active') : t('catalogs.status.inactive') }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-right whitespace-nowrap">
                <UTooltip v-if="canViewMembers" :text="t('plans.corporateContracts.viewMembers')">
                  <UButton color="neutral" variant="ghost" icon="i-lucide-users" size="sm" :aria-label="t('plans.corporateContracts.viewMembers')" @click="openMembers(c)" />
                </UTooltip>
                <UButton v-if="canUpdate" color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" :loading="loadingDetailUuid === c.uuid" :aria-label="t('common.edit')" @click="openEdit(c)" />
                <UButton v-if="canDelete" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :aria-label="t('common.delete')" @click="openDelete(c)" />
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
      :title="editingUuid ? t('plans.corporateContracts.editTitle') : t('plans.corporateContracts.createTitle')"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('plans.corporateContracts.fields.institutionName')" name="institutionName" required>
              <UInput v-model="state.institutionName" class="w-full" maxlength="200" />
            </UFormField>
            <UFormField :label="t('plans.corporateContracts.fields.institutionTaxId')" name="institutionTaxId" required>
              <UInput v-model="state.institutionTaxId" class="w-full font-mono" maxlength="20" />
            </UFormField>
          </div>
          <UFormField :label="t('plans.corporateContracts.fields.plan')" name="planUuid" required :help="t('plans.corporateContracts.planHelp')">
            <CommonEntityReferenceSelect
              v-model="state.planUuid"
              :search="searchPlansForm"
              entity="plan"
              icon="i-lucide-package"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('plans.corporateContracts.fields.payerMode')" name="payerMode" required :help="t(`plans.corporateContracts.payerModeHelp.${state.payerMode}`)">
              <USelectMenu v-model="state.payerMode" :items="payerModeOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField :label="t('plans.corporateContracts.fields.expectedMemberCount')" name="expectedMemberCount">
              <UInput v-model="state.expectedMemberCount" type="number" min="0" step="1" class="w-full" />
            </UFormField>
          </div>
          <UFormField v-if="editingUuid" :label="t('catalogs.fields.active')" name="active">
            <USwitch v-model="state.active" />
          </UFormField>
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
    <UModal v-model:open="deleteOpen" :title="t('plans.corporateContracts.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ t('plans.corporateContracts.deleteConfirm', { name: target?.institutionName ?? '' }) }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- Enrolled members modal -->
    <UModal
      v-model:open="membersOpen"
      :title="t('plans.corporateContracts.membersTitle')"
      :description="membersTarget?.institutionName"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <div v-if="membersLoading" class="space-y-2">
          <USkeleton v-for="i in 4" :key="i" class="h-10 w-full" />
        </div>
        <p v-else-if="members.length === 0" class="text-sm text-prohealth-500 text-center py-6">{{ t('plans.corporateContracts.membersEmpty') }}</p>
        <ul v-else class="divide-y divide-prohealth-100">
          <li v-for="m in members" :key="m.uuid" class="py-2 flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <NuxtLink v-if="can('MEMBER_VIEW_ALL')" :to="`/dashboard/members/${m.uuid}`" class="font-medium text-cyan-700 hover:underline">{{ m.fullName }}</NuxtLink>
              <span v-else class="font-medium text-prohealth-900">{{ m.fullName }}</span>
              <span v-if="m.documentNumber" class="block text-xs text-prohealth-500">{{ [m.documentType, m.documentNumber].filter(Boolean).join('-') }}</span>
            </div>
            <UBadge :color="m.active ? 'success' : 'neutral'" variant="subtle" size="sm">
              {{ m.status_Display ?? (m.active ? t('catalogs.status.active') : t('catalogs.status.inactive')) }}
            </UBadge>
          </li>
        </ul>
        <div v-if="membersTotal > membersSize" class="flex justify-end pt-3">
          <UPagination v-model:page="membersPage" :total="membersTotal" :items-per-page="membersSize" />
        </div>
      </template>
    </UModal>
  </div>
</template>
