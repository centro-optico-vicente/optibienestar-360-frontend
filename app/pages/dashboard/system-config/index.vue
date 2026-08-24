<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AuditMode } from '~/composables/useSystemConfig'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'JOB_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('systemConfig.seoTitle') })

const systemConfigApi = useSystemConfig()
const { can } = usePermissions()
const toast = useToast()

// AUDIT_MANAGE_CONFIG is the specific permission for the PUT /v1/system-configs
// endpoint's audit-related fields (see backend SystemConfigController); reused
// here to gate the whole "Auditoría" section, on top of the general update
// permissions that already guard reportFooter on this page.
const canUpdate = computed(() => can('JOB_UPDATE') || can('ROLE_UPDATE') || can('USER_UPDATE') || can('AUDIT_MANAGE_CONFIG'))
const canUpdateAudit = computed(() => can('AUDIT_MANAGE_CONFIG'))

const AUDIT_MODE_OPTIONS: { label: string, value: AuditMode }[] = [
  { label: t('systemConfig.audit.modes.PER_ENTITY'), value: 'PER_ENTITY' },
  { label: t('systemConfig.audit.modes.FORCE_ENABLED'), value: 'FORCE_ENABLED' },
  { label: t('systemConfig.audit.modes.FORCE_DISABLED'), value: 'FORCE_DISABLED' },
]

const loading = ref(false)
const isSubmitting = ref(false)

const state = reactive({
  reportFooter: '',
  dataChangeAuditMode: 'PER_ENTITY' as AuditMode,
  reportAuditMode: 'PER_ENTITY' as AuditMode,
  loginAuditEnabled: true,
  loginSessionExpirationDays: 30,
})

const schema = computed(() =>
  z.object({
    reportFooter: z
      .string()
      .max(500, t('validation.maxChars', { n: 500 }))
      .optional()
      .or(z.literal('')),
    dataChangeAuditMode: z.enum(['PER_ENTITY', 'FORCE_ENABLED', 'FORCE_DISABLED']),
    reportAuditMode: z.enum(['PER_ENTITY', 'FORCE_ENABLED', 'FORCE_DISABLED']),
    loginAuditEnabled: z.boolean(),
    loginSessionExpirationDays: z
      .number()
      .int()
      .positive(t('validation.positive')),
  })
)

async function load() {
  loading.value = true
  try {
    const res = await systemConfigApi.get()
    state.reportFooter = res.reportFooter || ''
    state.dataChangeAuditMode = res.dataChangeAuditMode
    state.reportAuditMode = res.reportAuditMode
    state.loginAuditEnabled = res.loginAuditEnabled
    state.loginSessionExpirationDays = res.loginSessionExpirationDays
  }
  catch {
    state.reportFooter = ''
  }
  finally {
    loading.value = false
  }
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  if (!canUpdate.value) return
  isSubmitting.value = true
  try {
    const updated = await systemConfigApi.update({
      reportFooter: state.reportFooter,
      ...(canUpdateAudit.value
        ? {
            dataChangeAuditMode: state.dataChangeAuditMode,
            reportAuditMode: state.reportAuditMode,
            loginAuditEnabled: state.loginAuditEnabled,
            loginSessionExpirationDays: state.loginSessionExpirationDays,
          }
        : {}),
    })
    state.reportFooter = updated.reportFooter
    state.dataChangeAuditMode = updated.dataChangeAuditMode
    state.reportAuditMode = updated.reportAuditMode
    state.loginAuditEnabled = updated.loginAuditEnabled
    state.loginSessionExpirationDays = updated.loginSessionExpirationDays
    toast.add({
      title: t('systemConfig.updatedToast'),
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
  <div class="space-y-5 max-w-4xl">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('systemConfig.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">
        {{ t('systemConfig.subtitle') }}
      </p>
    </div>

    <!-- Main Card -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm">
      <div v-if="loading" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
        <span class="text-sm">{{ t('common.loading') }}</span>
      </div>

      <UForm
        v-else
        :schema="schema"
        :state="state"
        class="space-y-6"
        @submit="onSubmit"
      >
        <UFormField
          :label="t('systemConfig.fields.reportFooter')"
          :help="t('systemConfig.fields.reportFooterHelp')"
          name="reportFooter"
        >
          <UTextarea
            v-model="state.reportFooter"
            :placeholder="t('systemConfig.fields.reportFooterPlaceholder')"
            :rows="3"
            class="w-full"
            :disabled="!canUpdate || isSubmitting"
          />
        </UFormField>

        <div v-if="canUpdateAudit" class="space-y-4 pt-3 border-t border-prohealth-100">
          <div>
            <h2 class="text-base font-bold text-prohealth-900">{{ t('systemConfig.audit.sectionTitle') }}</h2>
            <p class="text-xs text-prohealth-700/70 mt-0.5">{{ t('systemConfig.audit.sectionSubtitle') }}</p>
          </div>

          <UFormField
            :label="t('systemConfig.audit.dataChangeAuditMode')"
            :help="t('systemConfig.audit.dataChangeAuditModeHelp')"
            name="dataChangeAuditMode"
          >
            <USelectMenu
              v-model="state.dataChangeAuditMode"
              :items="AUDIT_MODE_OPTIONS"
              label-key="label"
              value-key="value"
              :search-input="false"
              class="w-full sm:w-72"
              :disabled="isSubmitting"
            />
          </UFormField>

          <UFormField
            :label="t('systemConfig.audit.reportAuditMode')"
            :help="t('systemConfig.audit.reportAuditModeHelp')"
            name="reportAuditMode"
          >
            <USelectMenu
              v-model="state.reportAuditMode"
              :items="AUDIT_MODE_OPTIONS"
              label-key="label"
              value-key="value"
              :search-input="false"
              class="w-full sm:w-72"
              :disabled="isSubmitting"
            />
          </UFormField>

          <UFormField
            :label="t('systemConfig.audit.loginAuditEnabled')"
            :help="t('systemConfig.audit.loginAuditEnabledHelp')"
            name="loginAuditEnabled"
          >
            <USwitch v-model="state.loginAuditEnabled" :disabled="isSubmitting" />
          </UFormField>

          <UFormField
            :label="t('systemConfig.audit.loginSessionExpirationDays')"
            :help="t('systemConfig.audit.loginSessionExpirationDaysHelp')"
            name="loginSessionExpirationDays"
          >
            <UInputNumber
              v-model="state.loginSessionExpirationDays"
              :min="1"
              class="w-full sm:w-40"
              :disabled="isSubmitting || !state.loginAuditEnabled"
            />
          </UFormField>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-prohealth-100">
          <UButton
            type="submit"
            color="primary"
            icon="i-lucide-save"
            :loading="isSubmitting"
            :disabled="!canUpdate"
          >
            {{ t('systemConfig.saveButton') }}
          </UButton>
        </div>
      </UForm>
    </div>
  </div>
</template>
