<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { SECURITY_POLICY_MIN, type SecurityPolicyDto, type SecurityPolicyUpdateRequest } from '~/types/securityPolicy'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'SECURITY_POLICY_VIEW',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('securityPolicy.seoTitle') })

const securityPolicyApi = useSecurityPolicy()
const { can } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('SECURITY_POLICY_UPDATE'))

type PolicyField = keyof SecurityPolicyUpdateRequest

// Render order of the inputs; each field's label/help live under
// `securityPolicy.fields.<field>` and `securityPolicy.fields.<field>Help`.
const FIELDS: { key: PolicyField, unitKey: string }[] = [
  { key: 'maxLoginAttempts', unitKey: 'securityPolicy.units.attempts' },
  { key: 'lockoutDurationMinutes', unitKey: 'securityPolicy.units.minutes' },
  { key: 'daysPasswordExpires', unitKey: 'securityPolicy.units.days' },
  { key: 'passwordHistoryCount', unitKey: 'securityPolicy.units.passwords' },
  { key: 'maxConcurrentSessions', unitKey: 'securityPolicy.units.sessions' },
]

const loading = ref(false)
const isSubmitting = ref(false)

const state = reactive<SecurityPolicyUpdateRequest>({
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 30,
  daysPasswordExpires: 90,
  passwordHistoryCount: 5,
  maxConcurrentSessions: 3,
})

function intAtLeast(min: number) {
  return z
    .number({ message: t('validation.required') })
    .int(t('securityPolicy.validation.integer'))
    .min(min, t('securityPolicy.validation.min', { n: min }))
}

const schema = computed(() =>
  z.object({
    maxLoginAttempts: intAtLeast(SECURITY_POLICY_MIN.maxLoginAttempts),
    lockoutDurationMinutes: intAtLeast(SECURITY_POLICY_MIN.lockoutDurationMinutes),
    daysPasswordExpires: intAtLeast(SECURITY_POLICY_MIN.daysPasswordExpires),
    passwordHistoryCount: intAtLeast(SECURITY_POLICY_MIN.passwordHistoryCount),
    maxConcurrentSessions: intAtLeast(SECURITY_POLICY_MIN.maxConcurrentSessions),
  })
)

// Snapshot of the last server-loaded state, used to warn before a refresh
// throws away unsaved edits (same pattern as system-config).
const snapshot = ref('')
function snapshotState() { return JSON.stringify(state) }
const isDirty = computed(() => snapshot.value !== '' && snapshotState() !== snapshot.value)
const discardConfirmOpen = ref(false)

function applyDto(dto: SecurityPolicyDto) {
  state.maxLoginAttempts = dto.maxLoginAttempts
  state.lockoutDurationMinutes = dto.lockoutDurationMinutes
  state.daysPasswordExpires = dto.daysPasswordExpires
  state.passwordHistoryCount = dto.passwordHistoryCount
  state.maxConcurrentSessions = dto.maxConcurrentSessions
}

async function load() {
  loading.value = true
  try {
    applyDto(await securityPolicyApi.get())
  }
  catch {
    // handled by useApi
  }
  finally {
    loading.value = false
    snapshot.value = snapshotState()
  }
}

function onRefresh() {
  if (isDirty.value) discardConfirmOpen.value = true
  else load()
}

function discardAndRefresh() {
  discardConfirmOpen.value = false
  load()
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  if (!canUpdate.value) return
  isSubmitting.value = true
  try {
    const updated = await securityPolicyApi.update({
      maxLoginAttempts: state.maxLoginAttempts,
      lockoutDurationMinutes: state.lockoutDurationMinutes,
      daysPasswordExpires: state.daysPasswordExpires,
      passwordHistoryCount: state.passwordHistoryCount,
      maxConcurrentSessions: state.maxConcurrentSessions,
    })
    applyDto(updated)
    snapshot.value = snapshotState()
    toast.add({
      title: t('securityPolicy.updatedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  }
  catch {
    // handled by useApi
  }
  finally {
    isSubmitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('securityPolicy.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('securityPolicy.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <RefreshButton
          :loading="loading"
          :icon-only="false"
          :label="t('common.refresh')"
          :title="t('common.refresh')"
          @refresh="onRefresh"
        />
        <UButton
          v-if="canUpdate"
          type="submit"
          form="security-policy-form"
          color="info"
          variant="outline"
          icon="i-lucide-save"
          :loading="isSubmitting"
          :disabled="loading"
        >
          {{ t('common.save') }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
      <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
      <span class="text-sm">{{ t('common.loading') }}</span>
    </div>

    <UForm
      v-else
      id="security-policy-form"
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UAlert
        v-if="!canUpdate"
        color="info"
        variant="subtle"
        icon="i-lucide-eye"
        :title="t('securityPolicy.readOnly')"
      />

      <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <UFormField
            v-for="field in FIELDS"
            :key="field.key"
            :label="t(`securityPolicy.fields.${field.key}`)"
            :help="t(`securityPolicy.fields.${field.key}Help`)"
            :name="field.key"
          >
            <div class="flex items-center gap-2">
              <UInputNumber
                v-model="state[field.key]"
                :min="SECURITY_POLICY_MIN[field.key]"
                :step="1"
                class="w-full sm:w-40"
                :disabled="!canUpdate || isSubmitting"
              />
              <span class="text-sm text-prohealth-700/70">{{ t(field.unitKey) }}</span>
            </div>
          </UFormField>
        </div>
      </div>
    </UForm>

    <!-- Discard unsaved changes before refreshing -->
    <UModal v-model:open="discardConfirmOpen" :title="t('common.discardChangesTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('common.discardChangesBody') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="warning" icon="i-lucide-refresh-cw" @click="discardAndRefresh">
            {{ t('common.discardAndRefresh') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
