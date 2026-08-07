<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { MemberPromoterAssignmentDto } from '~/types/members'
<<<<<<< Updated upstream
import type { PromoterDto } from '~/types/promoters'

// Permanent member↔promoter link (v2 PDF 2.a): current promoter + reassign/link-by-code
// + history. Embedded in the member detail page (/dashboard/members/[uuid]) like
// MemberReferralCodeCard. Self-gated on MEMBER_ASSIGN_PROMOTER for the mutating actions;
// the current-promoter display and history are visible to anyone who can view the card
// (the page itself already gates on MEMBER_VIEW_ALL).
=======

// Shows the member's currently-attributed promoter (permanent link) and lets an
// admin reassign it (POST /assign-promoter, MEMBER_ASSIGN_PROMOTER) — by picking
// a promoter directly or entering their referral code (exactly one of the two,
// enforced both here and server-side). Also shows the reassignment history
// (GET /promoter-history). Embedded in the member detail page, like
// MemberReferralCodeCard / MemberMembershipsCard.
>>>>>>> Stashed changes
const props = defineProps<{
  memberUuid: string
  currentPromoterUuid?: string | null
  currentPromoterName?: string | null
}>()

<<<<<<< Updated upstream
const emit = defineEmits<{ changed: [] }>()
=======
const emit = defineEmits<{
  reassigned: [assignment: MemberPromoterAssignmentDto]
}>()
>>>>>>> Stashed changes

const { t } = useI18n()
const { formatDate } = useFormatters()
const members = useMembers()
const promoters = usePromoters()
const { can } = usePermissions()
const toast = useToast()

const canAssign = computed(() => can('MEMBER_ASSIGN_PROMOTER'))

<<<<<<< Updated upstream
// ---- History ----
const history = ref<MemberPromoterAssignmentDto[]>([])
const historyLoading = ref(false)
=======
// Local copy so a successful reassignment updates the card without refetching the
// whole member.
const promoterUuid = ref(props.currentPromoterUuid ?? null)
const promoterName = ref(props.currentPromoterName ?? null)
watch(() => [props.currentPromoterUuid, props.currentPromoterName], () => {
  promoterUuid.value = props.currentPromoterUuid ?? null
  promoterName.value = props.currentPromoterName ?? null
})

// ---- History (lazy: loaded the first time the section is expanded) ----
const historyOpen = ref(false)
const history = ref<MemberPromoterAssignmentDto[]>([])
const historyLoading = ref(false)
const historyLoaded = ref(false)
>>>>>>> Stashed changes

async function loadHistory() {
  historyLoading.value = true
  try {
    history.value = await members.promoterHistory(props.memberUuid)
<<<<<<< Updated upstream
=======
    historyLoaded.value = true
>>>>>>> Stashed changes
  }
  catch {
    history.value = []
  }
  finally {
    historyLoading.value = false
  }
}

<<<<<<< Updated upstream
onMounted(loadHistory)

// ---- Change / link form ----
// Same modal covers both flows: "change" (target picked from the list) when the member
// already has a promoter, "link by code" when it doesn't — the backend endpoint accepts
// promoterUuid XOR referralCode either way.
const formOpen = ref(false)
const submitting = ref(false)
const promoterOptions = ref<{ label: string, value: string }[]>([])
const loadingOptions = ref(false)

const state = reactive({
  mode: 'select' as 'select' | 'code',
  promoterUuid: undefined as string | undefined,
=======
function toggleHistory() {
  historyOpen.value = !historyOpen.value
  if (historyOpen.value && !historyLoaded.value) loadHistory()
}

// ---- Reassign modal ----
const formOpen = ref(false)
const submitting = ref(false)
const targetMode = ref<'promoter' | 'code'>('promoter')

type Option = { label: string, value: string }
const promoterSearch = ref('')
const promoterOptions = ref<Option[]>([])
const searchingPromoters = ref(false)

let promoterSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(promoterSearch, (q) => {
  clearTimeout(promoterSearchTimer)
  const term = q.trim()
  if (term.length < 2) {
    promoterOptions.value = []
    return
  }
  promoterSearchTimer = setTimeout(async () => {
    searchingPromoters.value = true
    try {
      const res = await promoters.list({ size: 10, q: term })
      promoterOptions.value = (res.content ?? []).map(p => ({ label: `${p.displayName} · ${p.referralCode}`, value: p.uuid }))
    }
    catch {
      promoterOptions.value = []
    }
    finally {
      searchingPromoters.value = false
    }
  }, 400)
})

const state = reactive({
  selectedPromoterUuid: '',
>>>>>>> Stashed changes
  referralCode: '',
  reason: '',
})

const schema = computed(() => z.object({
<<<<<<< Updated upstream
  promoterUuid: state.mode === 'select' ? z.string({ message: t('validation.required') }) : z.string().optional(),
  referralCode: state.mode === 'code'
    ? z.string().regex(/^[A-Z0-9-]{4,20}$/, t('referrals.code.form.customCodeFormat'))
    : z.string().optional(),
  reason: z.string().min(3, t('validation.minChars', { n: 3 })),
}))

async function loadPromoterOptions() {
  loadingOptions.value = true
  try {
    const page = await promoters.list({ size: 100, sort: 'displayName,asc' })
    promoterOptions.value = (page.content ?? [])
      .filter((p: PromoterDto) => p.active && p.uuid !== props.currentPromoterUuid)
      .map((p: PromoterDto) => ({ label: p.displayName, value: p.uuid }))
  }
  catch {
    promoterOptions.value = []
  }
  finally {
    loadingOptions.value = false
  }
}

function openForm(mode: 'select' | 'code') {
  state.mode = mode
  state.promoterUuid = undefined
  state.referralCode = ''
  state.reason = ''
  formOpen.value = true
  if (mode === 'select') loadPromoterOptions()
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  submitting.value = true
  try {
    await members.assignPromoter(props.memberUuid, {
      promoterUuid: state.mode === 'select' ? state.promoterUuid : undefined,
      referralCode: state.mode === 'code' ? state.referralCode.trim().toUpperCase() : undefined,
      reason: state.reason,
    })
    toast.add({
      title: props.currentPromoterUuid ? t('members.promoter.changedToast') : t('members.promoter.linkedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    formOpen.value = false
    await loadHistory()
    emit('changed')
  }
  catch {
    // toast handled by useApi
=======
  reason: z.string().min(1, t('validation.required')).max(2000, t('validation.maxChars', { n: 2000 })),
}))

function openForm() {
  targetMode.value = 'promoter'
  promoterSearch.value = ''
  promoterOptions.value = []
  state.selectedPromoterUuid = ''
  state.referralCode = ''
  state.reason = ''
  formOpen.value = true
}

const targetMissing = computed(() =>
  targetMode.value === 'promoter' ? !state.selectedPromoterUuid : !state.referralCode.trim(),
)

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  if (targetMissing.value) return
  submitting.value = true
  try {
    const assignment = await members.assignPromoter(props.memberUuid, {
      promoterUuid: targetMode.value === 'promoter' ? state.selectedPromoterUuid : undefined,
      referralCode: targetMode.value === 'code' ? state.referralCode.trim().toUpperCase() : undefined,
      reason: state.reason.trim(),
    })
    promoterUuid.value = assignment.toPromoterUuid ?? null
    promoterName.value = assignment.toPromoterName ?? null
    // Invalidate the cached history so it refetches (immediately if already open).
    historyLoaded.value = false
    if (historyOpen.value) await loadHistory()
    toast.add({ title: t('members.promoterCard.reassignedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('reassigned', assignment)
    formOpen.value = false
  }
  catch {
    // toast handled by useApi (422 for bad code, missing/duplicate target, etc.)
>>>>>>> Stashed changes
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
      <div>
<<<<<<< Updated upstream
        <h2 class="font-bold text-prohealth-900">{{ t('members.promoter.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('members.promoter.subtitle') }}</p>
      </div>
      <div v-if="canAssign" class="flex items-center gap-2">
        <UButton
          v-if="!currentPromoterUuid"
          color="primary"
          variant="soft"
          icon="i-lucide-link"
          size="sm"
          @click="openForm('code')"
        >
          {{ t('members.promoter.linkButton') }}
        </UButton>
        <UButton
          v-else
=======
        <h2 class="font-bold text-prohealth-900">{{ t('members.promoterCard.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('members.promoterCard.subtitle') }}</p>
      </div>
      <UTooltip :text="canAssign ? t('members.promoterCard.reassign') : t('members.promoterCard.noPermission')">
        <UButton
>>>>>>> Stashed changes
          color="primary"
          variant="soft"
          icon="i-lucide-repeat"
          size="sm"
<<<<<<< Updated upstream
          @click="openForm('select')"
        >
          {{ t('members.promoter.changeButton') }}
        </UButton>
      </div>
    </div>

    <div class="px-6 py-4">
      <div class="flex items-center gap-3">
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.promoter.current') }}</dt>
        <dd v-if="currentPromoterUuid">
          <NuxtLink :to="`/dashboard/promoters/${currentPromoterUuid}`" class="text-primary-600 hover:underline font-semibold">
            {{ currentPromoterName }}
          </NuxtLink>
        </dd>
        <dd v-else class="text-prohealth-400">{{ t('members.promoter.none') }}</dd>
      </div>
    </div>

    <!-- History -->
    <div class="border-t border-prohealth-100">
      <div class="px-6 py-3">
        <h3 class="text-sm font-semibold text-prohealth-800">{{ t('members.promoter.history.title') }}</h3>
      </div>
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-6 py-2 font-semibold">{{ t('members.promoter.history.columns.from') }}</th>
              <th class="px-6 py-2 font-semibold">{{ t('members.promoter.history.columns.to') }}</th>
              <th class="px-6 py-2 font-semibold">{{ t('members.promoter.history.columns.date') }}</th>
              <th class="px-6 py-2 font-semibold">{{ t('members.promoter.history.columns.reason') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="historyLoading" :rows="2" :cols="4" />
            <tr v-else-if="history.length === 0">
              <td colspan="4" class="px-6 py-6 text-center text-prohealth-400 text-sm">
                {{ t('members.promoter.history.empty') }}
              </td>
            </tr>
            <tr v-for="row in history" v-else :key="row.uuid">
              <td class="px-6 py-2 text-prohealth-600">{{ row.fromPromoterName || t('members.promoter.none') }}</td>
              <td class="px-6 py-2 text-prohealth-800 font-medium">{{ row.toPromoterName }}</td>
              <td class="px-6 py-2 text-prohealth-600">{{ formatDate(row.assignedAt, 'short') }}</td>
              <td class="px-6 py-2 text-prohealth-600">{{ row.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Change / link modal -->
    <UModal
      v-model:open="formOpen"
      :title="state.mode === 'select' ? t('members.promoter.form.changeTitle') : t('members.promoter.form.linkTitle')"
      :description="state.mode === 'select' ? t('members.promoter.form.changeDescription') : t('members.promoter.form.linkDescription')"
    >
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-info"
            :description="t('members.promoter.permanentNotice')"
          />

          <UFormField v-if="state.mode === 'select'" :label="t('members.promoter.form.promoter')" name="promoterUuid" required>
            <USelectMenu
              v-model="state.promoterUuid"
              :items="promoterOptions"
              :loading="loadingOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>

          <UFormField v-else :label="t('members.promoter.form.referralCode')" name="referralCode" required>
            <UInput v-model="state.referralCode" placeholder="VICENTE-2026" class="w-full font-mono" />
          </UFormField>

          <UFormField :label="t('members.promoter.form.reason')" name="reason" required>
            <UTextarea
              v-model="state.reason"
              :rows="2"
              :placeholder="t('members.promoter.form.reasonPlaceholder')"
              class="w-full"
            />
          </UFormField>

=======
          :disabled="!canAssign"
          @click="openForm"
        >
          {{ t('members.promoterCard.reassign') }}
        </UButton>
      </UTooltip>
    </div>

    <div class="p-6">
      <div v-if="promoterUuid" class="flex items-center gap-3">
        <UIcon name="i-lucide-megaphone" class="w-8 h-8 text-primary-500 shrink-0" />
        <div>
          <NuxtLink :to="`/dashboard/promoters/${promoterUuid}`" class="font-semibold text-prohealth-900 hover:underline">
            {{ promoterName || t('common.empty') }}
          </NuxtLink>
          <p class="text-xs text-prohealth-500">{{ t('members.promoterCard.currentlyAttributed') }}</p>
        </div>
      </div>
      <div v-else class="text-center py-4 text-prohealth-500">
        <UIcon name="i-lucide-megaphone-off" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
        <p class="text-sm">{{ t('members.promoterCard.none') }}</p>
      </div>

      <!-- History (lazy) -->
      <div class="mt-4 border-t border-prohealth-100 pt-4">
        <button
          type="button"
          class="flex items-center gap-1.5 text-xs font-semibold text-prohealth-500 hover:text-prohealth-700"
          @click="toggleHistory"
        >
          <UIcon :name="historyOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="w-3.5 h-3.5" />
          {{ t('members.promoterCard.history') }}
        </button>

        <div v-if="historyOpen" class="mt-3 space-y-3">
          <div v-if="historyLoading" class="space-y-2">
            <USkeleton class="h-10 w-full rounded" />
          </div>
          <p v-else-if="!history.length" class="text-sm text-prohealth-500">
            {{ t('members.promoterCard.historyEmpty') }}
          </p>
          <ul v-else class="space-y-3">
            <li v-for="row in history" :key="row.uuid" class="text-sm border border-prohealth-100 rounded-xl p-3">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-prohealth-500">{{ row.fromPromoterName || t('members.promoterCard.none') }}</span>
                <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5 text-prohealth-400" />
                <span class="font-semibold text-prohealth-900">{{ row.toPromoterName || t('members.promoterCard.none') }}</span>
              </div>
              <p class="text-prohealth-600 mt-1">{{ row.reason }}</p>
              <p class="text-xs text-prohealth-400 mt-1">{{ formatDate(row.assignedAt, 'datetime') }}</p>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Reassign modal -->
    <UModal
      v-model:open="formOpen"
      :title="t('members.promoterCard.form.title')"
      :description="t('members.promoterCard.form.description')"
    >
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UTabs
            v-model="targetMode"
            :content="false"
            :items="[
              { label: t('members.promoterCard.form.byPromoter'), value: 'promoter' },
              { label: t('members.promoterCard.form.byCode'), value: 'code' },
            ]"
          />

          <UFormField v-if="targetMode === 'promoter'" :label="t('members.promoterCard.form.searchPromoter')" :help="t('members.promoterCard.form.searchPromoterHelp')">
            <UInput
              v-model="promoterSearch"
              :placeholder="t('members.promoterCard.form.searchPromoterPlaceholder')"
              icon="i-lucide-search"
              :loading="searchingPromoters"
              class="w-full"
            />
            <USelectMenu
              v-model="state.selectedPromoterUuid"
              :items="promoterOptions"
              label-key="label"
              value-key="value"
              :placeholder="promoterOptions.length ? t('common.select') : t('members.promoterCard.form.searchFirst')"
              class="w-full mt-2"
            />
          </UFormField>

          <UFormField v-else :label="t('members.promoterCard.form.referralCode')">
            <UInput v-model="state.referralCode" placeholder="PROMO-2026" class="w-full font-mono" />
          </UFormField>

          <UFormField :label="t('members.promoterCard.form.reason')" name="reason" required>
            <UTextarea v-model="state.reason" :rows="3" class="w-full" />
          </UFormField>

          <p v-if="targetMissing" class="text-xs text-prohealth-500">
            {{ t('members.promoterCard.form.targetRequired') }}
          </p>

>>>>>>> Stashed changes
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="submitting" @click="formOpen = false">
              {{ t('common.cancel') }}
            </UButton>
<<<<<<< Updated upstream
            <UButton type="submit" color="primary" :loading="submitting" icon="i-lucide-save">
              {{ t('members.promoter.form.submit') }}
=======
            <UButton type="submit" color="primary" :loading="submitting" :disabled="targetMissing" icon="i-lucide-repeat">
              {{ t('members.promoterCard.form.submit') }}
>>>>>>> Stashed changes
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
