<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AuditMode, ConfigSortOrder } from '~/composables/useSystemConfig'
import { COMMON_SORT_FIELDS } from '~/composables/useSystemConfig'

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

// Whitelisted at the backend too (CommonSortFields) — this global default sort applies
// to any entity without its own configured default, so it can't rely on a per-entity
// sortable-fields map like entity_config.defaultSort can.
// Typed as plain string (not the COMMON_SORT_FIELDS literal union) so USelectMenu's
// v-model matches ConfigSortOrder.field's own `string` type — the whitelist is still
// enforced (these are the only selectable items, and the backend validates too).
const SORT_FIELD_OPTIONS: { label: string, value: string }[] = COMMON_SORT_FIELDS.map(f => ({
  label: t(`systemConfig.defaultSort.fields.${f}`),
  value: f,
}))
const SORT_DIRECTION_OPTIONS = [
  { label: t('systemConfig.defaultSort.ascLabel'), value: 'ASC' as const, icon: 'i-lucide-list-sort-ascending' },
  { label: t('systemConfig.defaultSort.descLabel'), value: 'DESC' as const, icon: 'i-lucide-list-sort-descending' },
]

const loading = ref(false)
const isSubmitting = ref(false)

const state = reactive({
  reportFooter: '',
  whatsapp: '',
  instagram: '',
  facebook: '',
  auditCreateMode: 'PER_ENTITY' as AuditMode,
  auditUpdateMode: 'PER_ENTITY' as AuditMode,
  auditDeleteMode: 'PER_ENTITY' as AuditMode,
  captureBeforeAfterMode: 'PER_ENTITY' as AuditMode,
  reportAuditMode: 'PER_ENTITY' as AuditMode,
  loginAuditEnabled: true,
  defaultSort: [] as ConfigSortOrder[],
  loginSessionExpirationDays: 30,
})

const schema = computed(() =>
  z.object({
    reportFooter: z
      .string()
      .max(500, t('validation.maxChars', { n: 500 }))
      .optional()
      .or(z.literal('')),
    whatsapp: z
      .string()
      .max(30, t('validation.maxChars', { n: 30 }))
      .optional()
      .or(z.literal('')),
    instagram: z
      .string()
      .max(255, t('validation.maxChars', { n: 255 }))
      .optional()
      .or(z.literal('')),
    facebook: z
      .string()
      .max(255, t('validation.maxChars', { n: 255 }))
      .optional()
      .or(z.literal('')),
    auditCreateMode: z.enum(['PER_ENTITY', 'FORCE_ENABLED', 'FORCE_DISABLED']),
    auditUpdateMode: z.enum(['PER_ENTITY', 'FORCE_ENABLED', 'FORCE_DISABLED']),
    auditDeleteMode: z.enum(['PER_ENTITY', 'FORCE_ENABLED', 'FORCE_DISABLED']),
    captureBeforeAfterMode: z.enum(['PER_ENTITY', 'FORCE_ENABLED', 'FORCE_DISABLED']),
    reportAuditMode: z.enum(['PER_ENTITY', 'FORCE_ENABLED', 'FORCE_DISABLED']),
    loginAuditEnabled: z.boolean(),
    loginSessionExpirationDays: z
      .number()
      .int()
      .positive(t('validation.positive')),
    // Loosely typed on purpose (not z.enum(COMMON_SORT_FIELDS)) — the
    // USelectMenu below already constrains input to that whitelist; a
    // stricter literal-union type here just fights ConfigSortOrder's plain
    // `string` field across the rest of the file for no real safety gain.
    defaultSort: z.array(z.object({
      field: z.string(),
      direction: z.enum(['ASC', 'DESC']),
    })),
  })
)

// Snapshot of the last server-loaded state, used to warn before a refresh
// throws away unsaved edits.
const snapshot = ref('')
function snapshotState() { return JSON.stringify(state) }
const isDirty = computed(() => snapshot.value !== '' && snapshotState() !== snapshot.value)
const discardConfirmOpen = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await systemConfigApi.get()
    state.reportFooter = res.reportFooter || ''
    state.whatsapp = res.whatsapp || ''
    state.instagram = res.instagram || ''
    state.facebook = res.facebook || ''
    state.auditCreateMode = res.auditCreateMode
    state.auditUpdateMode = res.auditUpdateMode
    state.auditDeleteMode = res.auditDeleteMode
    state.captureBeforeAfterMode = res.captureBeforeAfterMode
    state.reportAuditMode = res.reportAuditMode
    state.loginAuditEnabled = res.loginAuditEnabled
    state.loginSessionExpirationDays = res.loginSessionExpirationDays
    state.defaultSort = res.defaultSort ?? []
  }
  catch {
    state.reportFooter = ''
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

function addSortRow() {
  state.defaultSort.push({ field: COMMON_SORT_FIELDS[0], direction: 'ASC' })
}

function removeSortRow(index: number) {
  state.defaultSort.splice(index, 1)
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  if (!canUpdate.value) return
  isSubmitting.value = true
  try {
    const updated = await systemConfigApi.update({
      reportFooter: state.reportFooter,
      whatsapp: state.whatsapp,
      instagram: state.instagram,
      facebook: state.facebook,
      ...(canUpdateAudit.value
        ? {
            auditCreateMode: state.auditCreateMode,
            auditUpdateMode: state.auditUpdateMode,
            auditDeleteMode: state.auditDeleteMode,
            captureBeforeAfterMode: state.captureBeforeAfterMode,
            reportAuditMode: state.reportAuditMode,
            loginAuditEnabled: state.loginAuditEnabled,
            loginSessionExpirationDays: state.loginSessionExpirationDays,
            defaultSort: state.defaultSort,
          }
        : {}),
    })
    state.reportFooter = updated.reportFooter
    state.whatsapp = updated.whatsapp || ''
    state.instagram = updated.instagram || ''
    state.facebook = updated.facebook || ''
    state.auditCreateMode = updated.auditCreateMode
    state.auditUpdateMode = updated.auditUpdateMode
    state.auditDeleteMode = updated.auditDeleteMode
    state.captureBeforeAfterMode = updated.captureBeforeAfterMode
    state.reportAuditMode = updated.reportAuditMode
    state.loginAuditEnabled = updated.loginAuditEnabled
    state.loginSessionExpirationDays = updated.loginSessionExpirationDays
    state.defaultSort = updated.defaultSort ?? []
    snapshot.value = snapshotState()
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
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('systemConfig.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('systemConfig.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <RefreshButton
          :loading="loading"
          :icon-only="false"
          :label="t('common.refresh')"
          :title="t('common.refreshRecord')"
          @refresh="onRefresh"
        />
        <UButton
          type="submit"
          form="system-config-form"
          color="info"
          variant="outline"
          icon="i-lucide-save"
          :loading="isSubmitting"
          :disabled="!canUpdate || loading"
        >
          {{ t('systemConfig.saveButton') }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
      <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
      <span class="text-sm">{{ t('common.loading') }}</span>
    </div>

    <UForm
      v-else
      id="system-config-form"
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- Reportes -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm">
          <h2 class="text-base font-bold text-prohealth-900 mb-4">{{ t('systemConfig.sections.reports') }}</h2>
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
        </div>

        <!-- Redes sociales -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-4">
          <div>
            <h2 class="text-base font-bold text-prohealth-900">{{ t('systemConfig.sections.socialLinks') }}</h2>
            <p class="text-xs text-prohealth-700/70 mt-0.5">{{ t('systemConfig.sections.socialLinksHelp') }}</p>
          </div>
          <UFormField :label="t('systemConfig.fields.whatsapp')" name="whatsapp">
            <UInput
              v-model="state.whatsapp"
              icon="i-simple-icons-whatsapp"
              :placeholder="t('systemConfig.fields.whatsappPlaceholder')"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>
          <UFormField :label="t('systemConfig.fields.instagram')" name="instagram">
            <UInput
              v-model="state.instagram"
              icon="i-simple-icons-instagram"
              :placeholder="t('systemConfig.fields.instagramPlaceholder')"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>
          <UFormField :label="t('systemConfig.fields.facebook')" name="facebook">
            <UInput
              v-model="state.facebook"
              icon="i-simple-icons-facebook"
              :placeholder="t('systemConfig.fields.facebookPlaceholder')"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>
        </div>

        <template v-if="canUpdateAudit">
          <!-- Auditoría de cambios de datos -->
          <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-4">
            <div>
              <h2 class="text-base font-bold text-prohealth-900">{{ t('systemConfig.sections.dataChangeAudit') }}</h2>
              <p class="text-xs text-prohealth-700/70 mt-0.5">{{ t('systemConfig.audit.dataChangeAuditModeHelp') }}</p>
            </div>

            <UFormField :label="t('systemConfig.audit.auditCreateMode')" name="auditCreateMode">
              <USelectMenu
                v-model="state.auditCreateMode"
                :items="AUDIT_MODE_OPTIONS"
                label-key="label"
                value-key="value"
                :search-input="false"
                class="w-full"
                :disabled="isSubmitting"
              />
            </UFormField>

            <UFormField :label="t('systemConfig.audit.auditUpdateMode')" name="auditUpdateMode">
              <USelectMenu
                v-model="state.auditUpdateMode"
                :items="AUDIT_MODE_OPTIONS"
                label-key="label"
                value-key="value"
                :search-input="false"
                class="w-full"
                :disabled="isSubmitting"
              />
            </UFormField>

            <UFormField :label="t('systemConfig.audit.auditDeleteMode')" name="auditDeleteMode">
              <USelectMenu
                v-model="state.auditDeleteMode"
                :items="AUDIT_MODE_OPTIONS"
                label-key="label"
                value-key="value"
                :search-input="false"
                class="w-full"
                :disabled="isSubmitting"
              />
            </UFormField>

            <UFormField
              :label="t('systemConfig.audit.captureBeforeAfterMode')"
              :help="t('systemConfig.audit.captureBeforeAfterModeHelp')"
              name="captureBeforeAfterMode"
            >
              <USelectMenu
                v-model="state.captureBeforeAfterMode"
                :items="AUDIT_MODE_OPTIONS"
                label-key="label"
                value-key="value"
                :search-input="false"
                class="w-full"
                :disabled="isSubmitting"
              />
            </UFormField>
          </div>

          <!-- Auditoría de reportes -->
          <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm">
            <h2 class="text-base font-bold text-prohealth-900 mb-4">{{ t('systemConfig.sections.reportAudit') }}</h2>
            <UFormField
              :help="t('systemConfig.audit.reportAuditModeHelp')"
              name="reportAuditMode"
            >
              <USelectMenu
                v-model="state.reportAuditMode"
                :items="AUDIT_MODE_OPTIONS"
                label-key="label"
                value-key="value"
                :search-input="false"
                class="w-full"
                :disabled="isSubmitting"
              />
            </UFormField>
          </div>

          <!-- Sesión y uso del sistema -->
          <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-4">
            <h2 class="text-base font-bold text-prohealth-900">{{ t('systemConfig.sections.sessions') }}</h2>
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

          <!-- Orden predeterminado global -->
          <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-3 lg:col-span-2">
            <div>
              <h2 class="text-base font-bold text-prohealth-900">{{ t('systemConfig.defaultSort.sectionTitle') }}</h2>
              <p class="text-xs text-prohealth-700/70 mt-0.5">{{ t('systemConfig.defaultSort.sectionSubtitle') }}</p>
            </div>

            <p v-if="state.defaultSort.length === 0" class="text-xs text-prohealth-500">
              {{ t('systemConfig.defaultSort.empty') }}
            </p>

            <div
              v-for="(row, index) in state.defaultSort"
              :key="index"
              class="flex flex-wrap items-center gap-2"
            >
              <USelectMenu
                v-model="row.field"
                :items="SORT_FIELD_OPTIONS"
                label-key="label"
                value-key="value"
                :search-input="false"
                :aria-label="t('systemConfig.defaultSort.field')"
                class="w-full sm:w-56"
                :disabled="isSubmitting"
              />
              <USelectMenu
                v-model="row.direction"
                :items="SORT_DIRECTION_OPTIONS"
                label-key="label"
                value-key="value"
                :icon="row.direction === 'ASC' ? 'i-lucide-list-sort-ascending' : 'i-lucide-list-sort-descending'"
                :search-input="false"
                :aria-label="t('systemConfig.defaultSort.direction')"
                class="w-full sm:w-44"
                :disabled="isSubmitting"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                size="sm"
                :disabled="isSubmitting"
                :aria-label="t('systemConfig.defaultSort.remove')"
                @click="removeSortRow(index)"
              />
            </div>

            <UButton
              color="primary"
              variant="outline"
              icon="i-lucide-plus"
              size="sm"
              :disabled="isSubmitting"
              @click="addSortRow"
            >
              {{ t('systemConfig.defaultSort.addRow') }}
            </UButton>
          </div>
        </template>
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
