<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { PlanDto } from '~/types/plans'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PLAN_VIEW_ALL',
})

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('plans.detail.seoPage') }) })

const route = useRoute()
const planUuid = route.params.uuid as string

const plans = usePlans()
const { can } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('PLAN_UPDATE'))
const canDelete = computed(() => can('PLAN_DELETE'))

// ---- Plan load ----
const plan = ref<PlanDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadPlan() {
  loading.value = true
  try {
    plan.value = await plans.get(planUuid)
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    plan.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(loadPlan)

// Amount in USD, formatted in the VE convention (useFormatters). Empty → '—'.
function money(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

// Plan type label; falls back to the raw value for unknown types.
function typeLabel(type?: string | null): string {
  return type ? t(`plans.types.${type}`, type) : t('common.empty')
}

// Plan status label; falls back to the raw value for unknown statuses.
function statusLabel(status?: string | null): string {
  return status ? t(`plans.status.${status}`, status) : t('common.empty')
}

// ---- Edit (shared modal) ----
const formOpen = ref(false)

function openEdit() {
  formOpen.value = true
}

function onSaved(updated: PlanDto) {
  plan.value = updated
}

// ---- Publish / unpublish (single-field PATCH) ----
const togglingPublish = ref(false)

async function togglePublish() {
  if (!plan.value) return
  togglingPublish.value = true
  const next = !plan.value.published
  try {
    plan.value = await plans.update(plan.value.uuid, { published: next })
    toast.add({
      title: next ? t('plans.publishedToast') : t('plans.unpublishedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  }
  catch {
    // toast handled by useApi
  }
  finally {
    togglingPublish.value = false
  }
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const usageChecking = ref(false)
const usageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openDelete() {
  if (!plan.value) return
  deleteOpen.value = true
  usageChecking.value = true
  usageInfo.value = null
  try {
    usageInfo.value = await plans.usage(plan.value.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    usageInfo.value = null
  }
  finally {
    usageChecking.value = false
  }
}

async function confirmDelete() {
  if (!plan.value) return
  deleting.value = true
  const wasPhysical = usageInfo.value?.inUse === false
  try {
    await plans.remove(plan.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('plans.deletedPermanentToast')
        : t('plans.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    await navigateTo('/dashboard/plans')
  }
  catch {
    // toast handled by useApi
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Back -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/plans"
      size="sm"
    >
      {{ t('plans.title') }}
    </UButton>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound || !plan" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('plans.detail.notFoundTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('plans.detail.notFoundBody') }}</p>
    </div>

    <template v-else>
      <!-- Header + actions -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ plan.name }}</h1>
              <UBadge color="primary" variant="subtle">{{ typeLabel(plan.type) }}</UBadge>
              <UBadge :color="plan.published ? 'success' : 'neutral'" variant="subtle">
                {{ plan.published ? t('plans.published') : t('plans.draft') }}
              </UBadge>
              <UBadge v-if="plan.status" :color="plan.status === 'ACTIVE' ? 'success' : 'warning'" variant="subtle">
                {{ statusLabel(plan.status) }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1 font-mono">{{ plan.code }}</p>
          </div>

          <div class="flex items-center gap-2">
            <UTooltip :text="canUpdate ? (plan.published ? t('plans.unpublishTooltip') : t('plans.publishTooltip')) : t('plans.noPermissionEdit')">
              <UButton
                :color="plan.published ? 'neutral' : 'primary'"
                variant="soft"
                :icon="plan.published ? 'i-lucide-eye-off' : 'i-lucide-globe'"
                :loading="togglingPublish"
                :disabled="!canUpdate"
                @click="togglePublish"
              >
                {{ plan.published ? t('plans.unpublish') : t('plans.publish') }}
              </UButton>
            </UTooltip>
            <UTooltip :text="canUpdate ? t('plans.editTooltip') : t('plans.noPermissionEdit')">
              <UButton
                color="primary"
                icon="i-lucide-pencil"
                :disabled="!canUpdate"
                @click="openEdit"
              >
                {{ t('common.edit') }}
              </UButton>
            </UTooltip>
            <UTooltip :text="canDelete ? t('plans.deleteTooltip') : t('plans.noPermissionDelete')">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :disabled="!canDelete"
                @click="openDelete"
              />
            </UTooltip>
          </div>
        </div>

        <p v-if="plan.description" class="text-sm text-prohealth-700 mt-4 max-w-3xl">
          {{ plan.description }}
        </p>
      </div>

      <!-- Beneficiaries and validity -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('plans.sections.beneficiaries') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.beneficiaries.included') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ plan.includedBeneficiaries }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.beneficiaries.max') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ plan.maxBeneficiaries ?? t('plans.beneficiaries.noLimit') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.beneficiaries.graceDays') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ plan.gracePeriodDays }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.beneficiaries.publishedAt') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(plan.publishedAt, 'long') }}</dd>
          </div>
        </dl>
      </div>

      <!-- Pricing -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('plans.sections.pricing') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.pricing.inscription') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ money(plan.inscriptionFee) }}</dd>
            <dd class="text-xs text-prohealth-500">{{ t('plans.pricing.inscriptionHint') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.pricing.monthly') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ money(plan.monthlyFee) }}</dd>
            <dd class="text-xs text-prohealth-500">{{ t('plans.pricing.monthlyHint') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.pricing.extraBeneficiary') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">
              {{ plan.extraBeneficiaryInscriptionFee != null ? money(plan.extraBeneficiaryInscriptionFee) : t('plans.pricing.notAllowed') }}
            </dd>
            <dd class="text-xs text-prohealth-500">{{ t('plans.pricing.extraBeneficiaryHint') }}</dd>
          </div>
        </dl>
      </div>

      <!-- Metadata -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('plans.sections.metadata') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.metadata.created') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(plan.createdAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.metadata.updated') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(plan.updatedAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.metadata.uuid') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ plan.uuid }}</dd>
          </div>
        </dl>
      </div>
    </template>

    <!-- Edit modal (shared with the list) -->
    <PlanFormModal v-model:open="formOpen" :plan="plan" @saved="onSaved" @delete="openDelete" />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('plans.deleteTitle')">
      <template #body>
        <div v-if="usageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            usageInfo?.inUse === false
              ? t('plans.deleteConfirmPermanent')
              : t('plans.deleteConfirmDeactivate', { count: usageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" :disabled="usageChecking" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
