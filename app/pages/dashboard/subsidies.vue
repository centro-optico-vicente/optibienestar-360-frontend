<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import type { SubsidyAuditLogDto, SubsidyCreateRequest, SubsidyDto, SubsidyUpdateRequest } from '~/types/subsidies'
import { subsidyPercentLabel } from '~/types/subsidies'
import { memberOptionLabel } from '~/types/members'

// Subsidies & exonerations (backend V41/V78): a member's monthly fee and/or inscription covered fully (100 %)
// or partially, with a mandatory reason and a validity window. The backend computes solvency from them; this
// screen lists the live subsidies, creates/edits/revokes them (granular permissions) and shows the immutable
// audit log the business requires ("registro formal en auditoría").
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'SUBSIDY_VIEW_ALL',
})

const { t, te } = useI18n()
const { can } = usePermissions()
const toast = useToast()
const subsidiesApi = useSubsidies()
const membersApi = useMembers()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('subsidies.title') }) })

const canCreate = computed(() => can('SUBSIDY_CREATE'))
const canUpdate = computed(() => can('SUBSIDY_UPDATE'))
const canRevoke = computed(() => can('SUBSIDY_DELETE'))

async function searchMembers(q: string): Promise<SelectItem[]> {
  const res = await membersApi.options({ ...(q ? { q } : {}), limit: DROPDOWN_PAGE_SIZE })
  return res.map(o => ({ label: memberOptionLabel(o), value: o.uuid }))
}

// ---- List ----
const data = ref<SubsidyDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)
const search = ref('')
const memberFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')

async function load() {
  loading.value = true
  try {
    const res = await subsidiesApi.list({
      page: page.value - 1,
      size: size.value,
      q: search.value.trim() || undefined,
      memberUuid: memberFilter.value || undefined,
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
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
watch([memberFilter, dateFrom, dateTo], reloadFromFirstPage)
const debouncedSearchLoad = useTableFilterDebounce(() => {
  reloadFromFirstPage()
})
watch(search, () => {
  debouncedSearchLoad()
})
watch(page, load)
onMounted(load)

/** "Exonerated" when both covered fees are at 100 %, otherwise "Partial". */
function isFullExoneration(s: SubsidyDto): boolean {
  const full = (v: number | string | null) => v === null || Number(v) >= 100
  return full(s.monthlyPercentage) && full(s.inscriptionPercentage)
}

// ---- Create / edit ----
const formOpen = ref(false)
const editing = ref<SubsidyDto | null>(null)
const saving = ref(false)
/** Row whose detail is being fetched for the edit form. */
const loadingDetailUuid = ref<string | null>(null)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

interface FormState {
  memberUuid: string | undefined
  monthlyPercentage: string
  inscriptionPercentage: string
  maxExoneratedBeneficiaries: string
  reason: string
  validFrom: string
  validUntil: string
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function emptyState(): FormState {
  return {
    memberUuid: undefined,
    monthlyPercentage: '100',
    inscriptionPercentage: '',
    maxExoneratedBeneficiaries: '',
    reason: '',
    validFrom: todayIso(),
    validUntil: '',
  }
}

const state = reactive<FormState>(emptyState())

const asText = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))
const blank = (v: string) => v.trim() === ''

const schema = computed(() => {
  const requiredMsg = t('validation.required')
  const percent = z.string().refine(v => blank(v) || (/^\d{1,3}(\.\d{1,2})?$/.test(v.trim()) && Number(v) >= 0 && Number(v) <= 100), t('subsidies.validation.percentRange'))
  const original = editing.value
  return z.object({
    memberUuid: original ? z.string().optional() : z.string({ message: requiredMsg }).min(1, requiredMsg),
    monthlyPercentage: percent,
    inscriptionPercentage: percent,
    maxExoneratedBeneficiaries: z.string().refine(v => blank(v) || /^\d+$/.test(v.trim()), t('subsidies.validation.wholeNumber')),
    reason: z.string().min(1, requiredMsg).max(1000, t('validation.maxChars', { n: 1000 })),
    validFrom: z.string().min(1, requiredMsg),
    validUntil: z.string(),
  })
    .refine(s => !blank(s.monthlyPercentage) || !blank(s.inscriptionPercentage), { message: t('subsidies.validation.coverageRequired'), path: ['monthlyPercentage'] })
    .refine(s => blank(s.validUntil) || s.validUntil >= s.validFrom, { message: t('subsidies.validation.untilBeforeFrom'), path: ['validUntil'] })
    // The update is PATCH-style: a blank value means "unchanged", so a value already stored cannot be cleared here.
    .refine(s => !original || original.monthlyPercentage === null || !blank(s.monthlyPercentage), { message: t('subsidies.validation.cannotClear'), path: ['monthlyPercentage'] })
    .refine(s => !original || original.inscriptionPercentage === null || !blank(s.inscriptionPercentage), { message: t('subsidies.validation.cannotClear'), path: ['inscriptionPercentage'] })
    .refine(s => !original || original.validUntil === null || !blank(s.validUntil), { message: t('subsidies.validation.cannotClear'), path: ['validUntil'] })
})

function openCreate() {
  editing.value = null
  Object.assign(state, emptyState())
  formOpen.value = true
}

/** Edit loads the detail (GET /{uuid}), never the list row. */
async function openEdit(row: SubsidyDto) {
  loadingDetailUuid.value = row.uuid
  try {
    const s = await subsidiesApi.get(row.uuid)
    editing.value = s
    Object.assign(state, {
      memberUuid: s.member_Uuid ?? undefined,
      monthlyPercentage: asText(s.monthlyPercentage),
      inscriptionPercentage: asText(s.inscriptionPercentage),
      maxExoneratedBeneficiaries: asText(s.maxExoneratedBeneficiaries),
      reason: s.reason ?? '',
      validFrom: s.validFrom,
      validUntil: s.validUntil ?? '',
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

const toNumber = (v: string): number | null => (blank(v) ? null : Number(v))

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  saving.value = true
  try {
    if (editing.value) {
      const body: SubsidyUpdateRequest = {
        monthlyPercentage: toNumber(state.monthlyPercentage),
        inscriptionPercentage: toNumber(state.inscriptionPercentage),
        maxExoneratedBeneficiaries: toNumber(state.maxExoneratedBeneficiaries),
        reason: state.reason.trim(),
        validFrom: state.validFrom,
        validUntil: state.validUntil || null,
      }
      await subsidiesApi.update(editing.value.uuid, body)
    }
    else {
      const body: SubsidyCreateRequest = {
        memberUuid: state.memberUuid!,
        monthlyPercentage: toNumber(state.monthlyPercentage),
        inscriptionPercentage: toNumber(state.inscriptionPercentage),
        maxExoneratedBeneficiaries: toNumber(state.maxExoneratedBeneficiaries),
        reason: state.reason.trim(),
        validFrom: state.validFrom,
        validUntil: state.validUntil || null,
      }
      await subsidiesApi.create(body)
    }
    toast.add({ title: t('subsidies.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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

// ---- Revoke (soft) ----
const revokeOpen = ref(false)
const revoking = ref(false)
const target = ref<SubsidyDto | null>(null)

function openRevoke(s: SubsidyDto) {
  target.value = s
  revokeOpen.value = true
}

async function confirmRevoke() {
  if (!target.value) return
  revoking.value = true
  try {
    await subsidiesApi.revoke(target.value.uuid)
    toast.add({ title: t('subsidies.revokedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    revokeOpen.value = false
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // useApi already notified the error
  }
  finally {
    revoking.value = false
  }
}

// ---- Audit log ----
const logOpen = ref(false)
const logLoading = ref(false)
const logEntries = ref<SubsidyAuditLogDto[]>([])
const logTarget = ref<SubsidyDto | null>(null)

async function openLog(s: SubsidyDto) {
  logTarget.value = s
  logEntries.value = []
  logOpen.value = true
  logLoading.value = true
  try {
    logEntries.value = await subsidiesApi.log(s.uuid)
  }
  catch {
    // useApi already notified the error
  }
  finally {
    logLoading.value = false
  }
}

function actionColor(a: string): 'success' | 'info' | 'error' | 'neutral' {
  if (a === 'CREATED') return 'success'
  if (a === 'MODIFIED') return 'info'
  if (a === 'REVOKED') return 'error'
  return 'neutral'
}

function fieldLabel(key: string): string {
  const k = `subsidies.fields.${key}`
  return te(k) ? t(k) : key
}

function snapshotValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no')
  return String(v)
}

/** Snapshot keys whose value changed between before and after (every key of `after` for a creation). */
function changedKeys(e: SubsidyAuditLogDto): string[] {
  const before = e.before ?? {}
  const after = e.after ?? {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('subsidies.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('subsidies.subtitle') }}</p>
      </div>
      <UButton v-if="canCreate" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreate">
        {{ t('common.new') }}
      </UButton>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('subsidies.searchPlaceholder')" class="w-full sm:w-72" />
      <CommonEntityReferenceSelect
        v-model="memberFilter"
        :search="searchMembers"
        entity="member"
        icon="i-lucide-user"
        :placeholder="t('subsidies.filters.member')"
        class="w-full sm:w-64"
      />
      <DateRangeFilter v-model:from="dateFrom" v-model:to="dateTo" :from-label="t('subsidies.filters.dateFrom')" :to-label="t('subsidies.filters.dateTo')" />
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col">
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('subsidies.columns.member') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('subsidies.columns.coverage') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('subsidies.columns.validity') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('subsidies.columns.reason') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="5" />
            <tr v-else-if="data.length === 0">
              <td colspan="5" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-hand-heart" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('subsidies.empty') }}
              </td>
            </tr>
            <tr v-for="s in data" v-else :key="s.uuid" class="hover:bg-prohealth-50/50 align-top">
              <td class="px-5 py-3 text-prohealth-800">
                <NuxtLink v-if="s.member_Uuid && can('MEMBER_VIEW_ALL')" :to="`/dashboard/members/${s.member_Uuid}`" class="text-cyan-700 hover:underline">
                  {{ s.member_Display ?? t('common.empty') }}
                </NuxtLink>
                <template v-else>{{ s.member_Display ?? t('common.empty') }}</template>
              </td>
              <td class="px-5 py-3">
                <div class="flex flex-wrap items-center gap-1">
                  <UBadge :color="isFullExoneration(s) ? 'success' : 'info'" variant="subtle" size="sm">
                    {{ isFullExoneration(s) ? t('subsidies.kind.exoneration') : t('subsidies.kind.partial') }}
                  </UBadge>
                </div>
                <span v-if="subsidyPercentLabel(s.monthlyPercentage, s.monthlyPercentage_Display)" class="block text-xs text-prohealth-600 mt-1">
                  {{ t('subsidies.monthlyShort', { value: subsidyPercentLabel(s.monthlyPercentage, s.monthlyPercentage_Display) }) }}
                </span>
                <span v-if="subsidyPercentLabel(s.inscriptionPercentage, s.inscriptionPercentage_Display)" class="block text-xs text-prohealth-600">
                  {{ t('subsidies.inscriptionShort', { value: subsidyPercentLabel(s.inscriptionPercentage, s.inscriptionPercentage_Display) }) }}
                </span>
                <span v-if="s.beneficiaries?.length" class="block text-xs text-prohealth-500">
                  {{ t('subsidies.beneficiaryCount', { count: s.beneficiaries.length }) }}
                </span>
              </td>
              <td class="px-5 py-3 text-prohealth-600 whitespace-nowrap">
                {{ s.validFrom_Display ?? s.validFrom }}
                <span class="text-prohealth-400">→</span>
                {{ s.validUntil ? (s.validUntil_Display ?? s.validUntil) : t('subsidies.indefinite') }}
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                <span class="block max-w-xs">{{ s.reason ?? t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-right whitespace-nowrap">
                <UTooltip :text="t('subsidies.viewLog')">
                  <UButton color="neutral" variant="ghost" icon="i-lucide-history" size="sm" :aria-label="t('subsidies.viewLog')" @click="openLog(s)" />
                </UTooltip>
                <UButton v-if="canUpdate" color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" :loading="loadingDetailUuid === s.uuid" :aria-label="t('common.edit')" @click="openEdit(s)" />
                <UTooltip v-if="canRevoke" :text="t('subsidies.revoke')">
                  <UButton color="error" variant="ghost" icon="i-lucide-ban" size="sm" :aria-label="t('subsidies.revoke')" @click="openRevoke(s)" />
                </UTooltip>
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
      :title="editing ? t('subsidies.editTitle') : t('subsidies.createTitle')"
      :description="t('subsidies.formDescription')"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField :label="t('subsidies.fields.member')" name="memberUuid" :required="!editing">
            <p v-if="editing" class="text-sm text-prohealth-800">{{ editing.member_Display ?? t('common.empty') }}</p>
            <CommonEntityReferenceSelect
              v-else
              v-model="state.memberUuid"
              :search="searchMembers"
              entity="member"
              icon="i-lucide-user"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField :label="t('subsidies.fields.monthlyPercentage')" name="monthlyPercentage" :help="t('subsidies.percentHelp')">
              <UInput v-model="state.monthlyPercentage" type="number" min="0" max="100" step="0.01" class="w-full" />
            </UFormField>
            <UFormField :label="t('subsidies.fields.inscriptionPercentage')" name="inscriptionPercentage" :help="t('subsidies.percentHelp')">
              <UInput v-model="state.inscriptionPercentage" type="number" min="0" max="100" step="0.01" class="w-full" />
            </UFormField>
            <UFormField :label="t('subsidies.fields.maxExoneratedBeneficiaries')" name="maxExoneratedBeneficiaries" :help="t('subsidies.maxBeneficiariesHelp')">
              <UInput v-model="state.maxExoneratedBeneficiaries" type="number" min="0" step="1" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('subsidies.fields.validFrom')" name="validFrom" required>
              <AppDatePicker v-model="state.validFrom" :clearable="false" />
            </UFormField>
            <UFormField :label="t('subsidies.fields.validUntil')" name="validUntil" :help="t('subsidies.validUntilHelp')">
              <AppDatePicker v-model="state.validUntil" />
            </UFormField>
          </div>
          <UFormField :label="t('subsidies.fields.reason')" name="reason" required>
            <UTextarea v-model="state.reason" :rows="3" class="w-full" maxlength="1000" />
          </UFormField>
          <p v-if="editing" class="text-xs text-prohealth-500">{{ t('subsidies.editHint') }}</p>
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

    <!-- Revoke confirmation modal -->
    <UModal v-model:open="revokeOpen" :title="t('subsidies.revokeTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ t('subsidies.revokeConfirm', { member: target?.member_Display ?? '' }) }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="revoking" @click="revokeOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="revoking" icon="i-lucide-ban" @click="confirmRevoke">{{ t('subsidies.revoke') }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit log modal -->
    <UModal
      v-model:open="logOpen"
      :title="t('subsidies.logTitle')"
      :description="logTarget?.member_Display ?? undefined"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <div v-if="logLoading" class="space-y-3">
          <USkeleton v-for="i in 3" :key="i" class="h-16 w-full" />
        </div>
        <p v-else-if="logEntries.length === 0" class="text-sm text-prohealth-500 text-center py-6">{{ t('subsidies.logEmpty') }}</p>
        <ol v-else class="space-y-4">
          <li v-for="e in logEntries" :key="e.uuid" class="border-l-2 border-prohealth-100 pl-4">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :color="actionColor(e.action)" variant="subtle" size="sm">
                {{ e.action_Display ?? t(`subsidies.actions.${e.action}`) }}
              </UBadge>
              <span class="text-xs text-prohealth-500">{{ e.at_Display ?? e.at }}</span>
            </div>
            <p v-if="e.reason" class="text-sm text-prohealth-700 mt-1">{{ e.reason }}</p>
            <ul v-if="changedKeys(e).length" class="mt-2 space-y-0.5 text-xs text-prohealth-600">
              <li v-for="k in changedKeys(e)" :key="k">
                <span class="font-semibold">{{ fieldLabel(k) }}:</span>
                <template v-if="e.before">{{ snapshotValue(e.before[k]) }} <span class="text-prohealth-400">→</span></template>
                {{ snapshotValue(e.after?.[k]) }}
              </li>
            </ul>
          </li>
        </ol>
      </template>
    </UModal>
  </div>
</template>
