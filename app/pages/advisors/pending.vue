<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import { ROLES } from '~/types/auth'
import type { MyAdvisorRequestDto } from '~/types/advisorRequests'
import { advisorRegistrationStatusColor } from '~/types/advisorRequests'

// Status page of a self-registered advisor (role ASESOR_PENDIENTE, GET /v1/me/advisor-request). Until an operator
// verifies it there is no QR and no commissions. Once approved, the approval-watch plugin swaps the session to
// ASESOR and sends the person to its advisor portal.
definePageMeta({
  layout: 'dashboard',
  middleware: 'role',
  roles: [ROLES.ADVISOR_PENDING],
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('advisorPending.title') }) })

const api = useAdvisorRequests()
const request = ref<MyAdvisorRequestDto | null>(null)
const loading = ref(true)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    request.value = await api.mine()
  }
  catch (err) {
    failed.value = (err as ApiError)?.status !== 404
    request.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const status = computed(() => request.value?.registrationStatus)
const statusLabel = computed(() => {
  const r = request.value
  if (!r) return ''
  return r.registrationStatus_Display ?? t(`advisorRequests.status.${r.registrationStatus}`, r.registrationStatus)
})
const submittedAt = computed(() => request.value?.createdAt_Display ?? formatDate(request.value?.createdAt, 'datetime'))
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-5">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('advisorPending.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('advisorPending.subtitle') }}</p>
    </div>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-6 w-48 rounded" />
      <USkeleton class="h-4 w-full rounded" />
      <USkeleton class="h-4 w-2/3 rounded" />
    </div>

    <div v-else-if="!request" class="bg-white rounded-2xl border border-prohealth-100 p-10 text-center space-y-3">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto text-prohealth-300" />
      <p class="text-prohealth-700">{{ failed ? t('advisorPending.loadError') : t('advisorPending.notFound') }}</p>
      <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" @click="load">{{ t('advisorPending.retry') }}</UButton>
    </div>

    <div v-else class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="font-semibold text-prohealth-900">{{ request.displayName }}</p>
          <p v-if="request.email" class="text-sm text-prohealth-500">{{ request.email }}</p>
        </div>
        <UBadge :color="advisorRegistrationStatusColor(status)" variant="subtle" size="lg">{{ statusLabel }}</UBadge>
      </div>

      <UAlert
        v-if="status === 'PENDING'"
        color="warning"
        variant="subtle"
        icon="i-lucide-hourglass"
        :title="t('advisorPending.pendingTitle')"
        :description="t('advisorPending.pendingBody')"
      />
      <UAlert
        v-else-if="status === 'REJECTED'"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-x"
        :title="t('advisorPending.rejectedTitle')"
        :description="request.rejectionReason ? t('advisorPending.rejectedBody', { reason: request.rejectionReason }) : t('advisorPending.rejectedNoReason')"
      />
      <UAlert
        v-else-if="status === 'APPROVED'"
        color="success"
        variant="subtle"
        icon="i-lucide-party-popper"
        :title="t('advisorPending.approvedTitle')"
        :description="t('advisorPending.approvedBody')"
      />

      <p class="text-xs text-prohealth-500">{{ t('advisorPending.submittedAt', { date: submittedAt }) }}</p>
    </div>
  </div>
</template>
