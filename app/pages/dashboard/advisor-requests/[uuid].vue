<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { AdvisorRequestDetailDto } from '~/types/advisorRequests'
import { advisorRegistrationStatusColor } from '~/types/advisorRequests'

// Verification of one self-registered advisor. PENDING: approve (the advisor gets its real referral code, QR and
// commissions from then on, and its login becomes ASESOR) or reject with a mandatory reason. REJECTED: reopen.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ADVISOR_REGISTRATION_VIEW_ALL',
})

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const requestUuid = route.params.uuid as string

useSeoMeta({ title: () => t('common.seoTitle', { page: t('advisorRequests.detail.seoPage') }) })

const api = useAdvisorRequests()

const request = ref<AdvisorRequestDetailDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function load() {
  loading.value = true
  try {
    request.value = await api.get(requestUuid)
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    request.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const isPending = computed(() => request.value?.registrationStatus === 'PENDING')
const isRejected = computed(() => request.value?.registrationStatus === 'REJECTED')

function statusLabel(r: AdvisorRequestDetailDto): string {
  return r.registrationStatus_Display ?? t(`advisorRequests.status.${r.registrationStatus}`, r.registrationStatus)
}

const personRows = computed(() => {
  const r = request.value
  if (!r) return []
  return [
    { label: t('advisorRequests.detail.fields.firstName'), value: r.firstName },
    { label: t('advisorRequests.detail.fields.lastName'), value: r.lastName },
    { label: t('advisorRequests.detail.fields.document'), value: r.documentNumber ? `${r.documentType ?? ''}-${r.documentNumber}` : null, mono: true },
    { label: t('advisorRequests.detail.fields.email'), value: r.email },
    { label: t('advisorRequests.detail.fields.phone'), value: r.phone },
    { label: t('advisorRequests.detail.fields.city'), value: r.city_Display },
    { label: t('advisorRequests.detail.fields.referralCode'), value: r.referralCode, mono: true },
  ]
})

const profileRows = computed(() => {
  const r = request.value
  if (!r) return []
  return [
    { label: t('advisorRequests.detail.fields.assignedZone'), value: r.assignedZone },
    { label: t('advisorRequests.detail.fields.educationLevel'), value: r.educationLevel_Display ?? (r.educationLevel ? t(`promoters.dossier.educationLevel.${r.educationLevel}`) : null) },
    { label: t('advisorRequests.detail.fields.profession'), value: r.profession },
    { label: t('advisorRequests.detail.fields.yearsOfExperience'), value: r.yearsOfExperience != null ? String(r.yearsOfExperience) : null },
    { label: t('advisorRequests.detail.fields.lastCompany'), value: r.lastCompany },
    { label: t('advisorRequests.detail.fields.lastPosition'), value: r.lastPosition },
    { label: t('advisorRequests.detail.fields.vehicle'), value: r.vehicle },
  ]
})

// ---- Approve ----
const approveOpen = ref(false)
const approving = ref(false)
async function confirmApprove() {
  if (!request.value) return
  approving.value = true
  try {
    request.value = await api.approve(request.value.uuid)
    approveOpen.value = false
    toast.add({ title: t('advisorRequests.detail.approve.doneToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch { /* toast handled by useApi */ }
  finally { approving.value = false }
}

// ---- Reject ----
const rejectOpen = ref(false)
const rejectReason = ref('')
const rejectTouched = ref(false)
const rejecting = ref(false)
const rejectError = computed(() =>
  rejectTouched.value && !rejectReason.value.trim() ? t('validation.required') : undefined)
function openReject() {
  rejectReason.value = ''
  rejectTouched.value = false
  rejectOpen.value = true
}
async function confirmReject() {
  rejectTouched.value = true
  const reason = rejectReason.value.trim()
  if (!request.value || !reason) return
  rejecting.value = true
  try {
    request.value = await api.reject(request.value.uuid, reason)
    rejectOpen.value = false
    toast.add({ title: t('advisorRequests.detail.reject.doneToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch { /* toast handled by useApi */ }
  finally { rejecting.value = false }
}

// ---- Reopen ----
const reopening = ref(false)
async function reopen() {
  if (!request.value) return
  reopening.value = true
  try {
    request.value = await api.reopen(request.value.uuid)
    toast.add({ title: t('advisorRequests.detail.reopenToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch { /* toast handled by useApi */ }
  finally { reopening.value = false }
}
</script>

<template>
  <div class="space-y-5">
    <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" to="/dashboard/advisor-requests" size="sm">
      {{ t('advisorRequests.title') }}
    </UButton>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <div v-else-if="notFound || !request" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('advisorRequests.detail.notFoundTitle') }}</p>
    </div>

    <template v-else>
      <!-- Header + actions -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ request.displayName }}</h1>
              <UBadge :color="advisorRegistrationStatusColor(request.registrationStatus)" variant="subtle">{{ statusLabel(request) }}</UBadge>
            </div>
            <p class="text-sm text-prohealth-600 mt-1">
              {{ t('advisorRequests.detail.receivedAt', { date: request.createdAt_Display ?? request.createdAt }) }}
            </p>
            <p v-if="request.approvedAt" class="text-xs text-prohealth-500 mt-1">
              {{ t('advisorRequests.detail.approvedBy', { name: request.approvedBy_Display ?? t('common.empty'), date: request.approvedAt_Display ?? request.approvedAt }) }}
            </p>
            <p v-if="request.rejectedAt" class="text-xs text-prohealth-500 mt-1">
              {{ t('advisorRequests.detail.rejectedBy', { name: request.rejectedBy_Display ?? t('common.empty'), date: request.rejectedAt_Display ?? request.rejectedAt }) }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <template v-if="isPending">
              <UButton v-can="'ADVISOR_REGISTRATION_REJECT'" color="error" variant="outline" icon="i-lucide-x" @click="openReject">
                {{ t('advisorRequests.detail.reject.button') }}
              </UButton>
              <UButton v-can="'ADVISOR_REGISTRATION_APPROVE'" color="success" icon="i-lucide-check" @click="approveOpen = true">
                {{ t('advisorRequests.detail.approve.button') }}
              </UButton>
            </template>
            <UButton v-else-if="isRejected" v-can="'ADVISOR_REGISTRATION_REJECT'" color="warning" variant="outline" icon="i-lucide-rotate-ccw" :loading="reopening" @click="reopen">
              {{ t('advisorRequests.detail.reopen') }}
            </UButton>
          </div>
        </div>

        <UAlert
          v-if="isPending"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-shield-alert"
          :title="t('advisorRequests.detail.pendingNotice')"
        />
        <UAlert
          v-if="isRejected && request.rejectionReason"
          class="mt-4"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-x"
          :title="t('advisorRequests.detail.rejectionReason')"
          :description="request.rejectionReason"
        />
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
          <h2 class="text-lg font-bold text-prohealth-900">{{ t('advisorRequests.detail.personTitle') }}</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div v-for="row in personRows" :key="row.label">
              <dt class="text-xs text-prohealth-500">{{ row.label }}</dt>
              <dd class="text-prohealth-800" :class="{ 'font-mono': row.mono }">{{ row.value || t('common.empty') }}</dd>
            </div>
          </dl>
          <div class="pt-3 border-t border-prohealth-100 space-y-2">
            <h3 class="text-sm font-semibold text-prohealth-900">{{ t('advisorRequests.detail.userTitle') }}</h3>
            <p v-if="!request.user" class="text-sm text-prohealth-500">{{ t('advisorRequests.detail.noUser') }}</p>
            <div v-else class="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span class="text-prohealth-800">{{ request.user.email }}</span>
              <span class="flex flex-wrap gap-1">
                <UBadge v-for="role in request.user.roles ?? []" :key="role" color="neutral" variant="outline" size="sm">{{ t(`roles.names.${role}`, role) }}</UBadge>
                <UBadge v-if="request.user.status" color="neutral" variant="subtle" size="sm">{{ request.user.status }}</UBadge>
              </span>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
          <h2 class="text-lg font-bold text-prohealth-900">{{ t('advisorRequests.detail.profileTitle') }}</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div v-for="row in profileRows" :key="row.label">
              <dt class="text-xs text-prohealth-500">{{ row.label }}</dt>
              <dd class="text-prohealth-800">{{ row.value || t('common.empty') }}</dd>
            </div>
          </dl>
          <div class="pt-3 border-t border-prohealth-100">
            <p class="text-xs text-prohealth-500">{{ t('advisorRequests.detail.fields.note') }}</p>
            <p class="text-sm text-prohealth-800 whitespace-pre-line">{{ request.registrationNote || t('common.empty') }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- Approve -->
    <UModal v-model:open="approveOpen" :title="t('advisorRequests.detail.approve.title')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-prohealth-700">{{ t('advisorRequests.detail.approve.notice') }}</p>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="approving" @click="approveOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="success" icon="i-lucide-check" :loading="approving" @click="confirmApprove">{{ t('advisorRequests.detail.approve.button') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Reject -->
    <UModal v-model:open="rejectOpen" :title="t('advisorRequests.detail.reject.title')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-prohealth-700">{{ t('advisorRequests.detail.reject.notice') }}</p>
          <UFormField :label="t('advisorRequests.detail.rejectionReason')" required :error="rejectError">
            <UTextarea v-model="rejectReason" :rows="3" :maxlength="1000" class="w-full" @blur="rejectTouched = true" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="rejecting" @click="rejectOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="error" icon="i-lucide-x" :loading="rejecting" @click="confirmReject">{{ t('advisorRequests.detail.reject.button') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
