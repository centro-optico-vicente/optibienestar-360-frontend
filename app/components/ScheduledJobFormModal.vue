<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  ScheduledJobCreateRequest,
  ScheduledJobDto,
  ScheduledJobUpdateRequest,
} from '~/types/scheduling'
import type { JsonKeyValueMode } from '~/composables/useJsonKeyValueEditor'
import { appTimeZone } from '~/utils/timezone'

// Scheduled-job create/edit form, shared by the list (/dashboard/scheduled-jobs)
// and the detail (/dashboard/scheduled-jobs/[uuid]) so the fields + validation
// aren't duplicated. The parent controls opening (v-model:open) and gates the
// permission of the button that opens it (JOB_CREATE / JOB_UPDATE); on save it
// emits `saved` to reload. `code` is immutable once created (PATCH semantics).
const props = defineProps<{
  open: boolean
  /** If provided, the modal is in edit mode; if null/undefined, in create mode. */
  job?: ScheduledJobDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [job: ScheduledJobDto]
  /** Shortcut so the parent can close this modal and open its delete confirmation. */
  'delete': [job: ScheduledJobDto]
}>()

const { t } = useI18n()
const jobs = useScheduledJobs()
const toast = useToast()
const { can } = usePermissions()
const canDelete = computed(() => can('JOB_DELETE'))

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.job ? 'edit' : 'create'))
const isSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

interface FormState {
  code: string
  displayName: string
  description: string
  cronExpression: string
  timezone: string
  enabled: boolean
  allowConcurrent: boolean
  maxSyncSeconds: string
  maxRetryAttempts: string
  retryDelaySeconds: string
  active: boolean
}

const state = reactive<FormState>({
  code: '',
  displayName: '',
  description: '',
  cronExpression: '',
  timezone: appTimeZone(),
  enabled: true,
  allowConcurrent: false,
  maxSyncSeconds: '30',
  maxRetryAttempts: '5',
  retryDelaySeconds: '10',
  active: true,
})

// Parámetros clave/valor ↔ JSON crudo (parameters JSONB del job).
const params = useJsonKeyValueEditor()

// Descripción legible de la expresión cron, junto al campo — se recalcula
// en vivo mientras el usuario edita.
const cronDescriptionText = computed(() => describeCron(state.cronExpression))

const paramTabs = computed(() => [
  { label: t('scheduledJobs.form.parameters.kvTab'), value: 'kv', icon: 'i-lucide-list' },
  { label: t('scheduledJobs.form.parameters.jsonTab'), value: 'json', icon: 'i-lucide-braces' },
])

// Locale-reactive schema — wrapped in computed so validation messages follow the
// UI locale. `code`: UPPER_SNAKE_CASE ^[A-Z][A-Z0-9_]{0,79}$. `maxSyncSeconds`,
// `maxRetryAttempts`, `retryDelaySeconds`: int >= 0 (backend caps 10 / 3600 resp.).
const schema = computed(() => {
  return z.object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/, t('scheduledJobs.form.codeFormat')),
    displayName: z.string().min(1, t('validation.required')).max(120, t('validation.maxChars', { n: 120 })),
    description: z.string().optional(),
    cronExpression: z.string().min(1, t('validation.required')),
    timezone: z.string().min(1, t('validation.required')),
    maxSyncSeconds: z.string().regex(/^\d+$/, t('validation.digitsOnly')),
    maxRetryAttempts: z.string().regex(/^\d+$/, t('validation.digitsOnly')),
    retryDelaySeconds: z.string().regex(/^\d+$/, t('validation.digitsOnly')),
  })
})

// True while the detail loads when opening in edit mode.
const loadingDetail = ref(false)

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify(state) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const reloading = ref(false)

function populateFrom(j: ScheduledJobDto | null) {
  if (!j) {
    editSnapshot.value = ''
    state.code = ''
    state.displayName = ''
    state.description = ''
    state.cronExpression = ''
    state.timezone = appTimeZone()
    state.enabled = true
    state.allowConcurrent = false
    state.maxSyncSeconds = '30'
    state.maxRetryAttempts = '5'
    state.retryDelaySeconds = '10'
    state.active = true
    params.load({})
    return
  }
  state.code = j.code ?? ''
  state.displayName = j.displayName ?? ''
  state.description = j.description ?? ''
  state.cronExpression = j.cronExpression ?? ''
  state.timezone = j.timezone ?? appTimeZone()
  state.enabled = j.enabled ?? true
  state.allowConcurrent = j.allowConcurrent ?? false
  state.maxSyncSeconds = j.maxSyncSeconds != null ? String(j.maxSyncSeconds) : '30'
  state.maxRetryAttempts = j.maxRetryAttempts != null ? String(j.maxRetryAttempts) : '5'
  state.retryDelaySeconds = j.retryDelaySeconds != null ? String(j.retryDelaySeconds) : '10'
  state.active = j.active ?? true
  params.load(j.parameters)
  editSnapshot.value = snapEditState()
}

async function reloadForm() {
  if (!props.job) return
  reloading.value = true
  try { populateFrom(await jobs.get(props.job.uuid)) }
  catch { /* useApi already notified */ }
  finally { reloading.value = false }
}
function onRefresh() {
  if (isEditDirty.value) discardConfirmOpen.value = true
  else reloadForm()
}
function discardAndRefresh() {
  discardConfirmOpen.value = false
  reloadForm()
}

// On open: in create mode clear the form; in edit mode load the full detail by UUID
// (the received `job` may be a list row) to populate reliably.
watch(() => props.open, async (open) => {
  if (!open) return
  if (!props.job) {
    populateFrom(null)
    return
  }
  loadingDetail.value = true
  try {
    populateFrom(await jobs.get(props.job.uuid))
  }
  catch {
    // If the detail fails to load, use the received record as a fallback.
    populateFrom(props.job)
  }
  finally {
    loadingDetail.value = false
  }
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  const parameters = params.resolve()
  if (parameters === null) {
    toast.add({ title: t('scheduledJobs.form.parameters.invalidJson'), color: 'error', icon: 'i-lucide-alert-triangle' })
    return
  }
  isSubmitting.value = true
  try {
    let result: ScheduledJobDto
    if (mode.value === 'create') {
      const body: ScheduledJobCreateRequest = {
        code: state.code.trim(),
        displayName: state.displayName.trim(),
        description: state.description.trim() || undefined,
        cronExpression: state.cronExpression.trim(),
        timezone: state.timezone.trim(),
        enabled: state.enabled,
        allowConcurrent: state.allowConcurrent,
        maxSyncSeconds: Number(state.maxSyncSeconds),
        maxRetryAttempts: Number(state.maxRetryAttempts),
        retryDelaySeconds: Number(state.retryDelaySeconds),
        parameters,
      }
      result = await jobs.create(body)
      toast.add({ title: t('scheduledJobs.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      const body: ScheduledJobUpdateRequest = {
        displayName: state.displayName.trim(),
        description: state.description.trim() || undefined,
        cronExpression: state.cronExpression.trim(),
        timezone: state.timezone.trim(),
        enabled: state.enabled,
        allowConcurrent: state.allowConcurrent,
        maxSyncSeconds: Number(state.maxSyncSeconds),
        maxRetryAttempts: Number(state.maxRetryAttempts),
        retryDelaySeconds: Number(state.retryDelaySeconds),
        parameters,
        active: state.active,
      }
      result = await jobs.update(props.job!.uuid, body)
      toast.add({ title: t('scheduledJobs.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (422 duplicate code, validations, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

// Shortcut from the edit modal so the user doesn't have to close it first
// and hunt for the row's trash icon. Closes this modal and lets the parent
// open its own delete confirmation, so the two dialogs never stack.
function openDeleteFromEdit() {
  if (!props.job) return
  isOpen.value = false
  emit('delete', props.job)
}

// ---- Restore (reverses a soft-deactivation) ----
const restoring = ref(false)

async function restoreJob() {
  if (!props.job) return
  restoring.value = true
  try {
    const result = await jobs.update(props.job.uuid, { active: true })
    toast.add({ title: t('scheduledJobs.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('scheduledJobs.form.createTitle') : t('scheduledJobs.form.editTitle')"
    :description="mode === 'create' ? t('scheduledJobs.form.createDescription') : t('scheduledJobs.form.editDescription')"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div v-if="loadingDetail" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
        <span class="text-sm">{{ t('scheduledJobs.form.loadingDetail') }}</span>
      </div>
      <UForm
        v-else
        ref="formRef"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('scheduledJobs.form.fields.code')" name="code" required :help="t('scheduledJobs.form.codeHelp')">
            <UInput
              v-model="state.code"
              placeholder="DAILY_BILLING"
              class="w-full font-mono"
              :disabled="mode === 'edit'"
              :ui="mode === 'edit' ? READONLY_FIELD_UI : undefined"
            />
          </UFormField>
          <UFormField :label="t('scheduledJobs.form.fields.timezone')" name="timezone" required>
            <UInput v-model="state.timezone" :placeholder="appTimeZone()" class="w-full font-mono" />
          </UFormField>
        </div>

        <UFormField :label="t('scheduledJobs.form.fields.displayName')" name="displayName" required>
          <UInput v-model="state.displayName" class="w-full" />
        </UFormField>

        <UFormField :label="t('scheduledJobs.form.fields.description')" name="description">
          <UTextarea v-model="state.description" :rows="3" class="w-full" />
        </UFormField>

        <UFormField
          :label="t('scheduledJobs.form.fields.cronExpression')"
          name="cronExpression"
          required
          :help="t('scheduledJobs.form.cronHelp')"
        >
          <div class="flex items-center gap-2">
            <UInput v-model="state.cronExpression" placeholder="0 0 3 * * *" class="w-full font-mono" />
            <UTooltip v-if="cronDescriptionText" :text="cronDescriptionText">
              <UIcon name="i-lucide-info" class="w-4 h-4 text-prohealth-400 shrink-0" />
            </UTooltip>
          </div>
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField :label="t('scheduledJobs.form.fields.maxSyncSeconds')" name="maxSyncSeconds" :help="t('scheduledJobs.form.maxSyncHelp')">
            <UInput v-model="state.maxSyncSeconds" inputmode="numeric" placeholder="30" class="w-full">
              <template #trailing>
                <span class="text-prohealth-400 text-sm">s</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField :label="t('scheduledJobs.form.fields.maxRetryAttempts')" name="maxRetryAttempts" :help="t('scheduledJobs.form.maxRetryAttemptsHelp')">
            <UInput v-model="state.maxRetryAttempts" inputmode="numeric" placeholder="0" class="w-full" />
          </UFormField>
          <UFormField :label="t('scheduledJobs.form.fields.retryDelaySeconds')" name="retryDelaySeconds" :help="t('scheduledJobs.form.retryDelayHelp')">
            <UInput v-model="state.retryDelaySeconds" inputmode="numeric" placeholder="0" class="w-full">
              <template #trailing>
                <span class="text-prohealth-400 text-sm">s</span>
              </template>
            </UInput>
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('scheduledJobs.form.fields.enabled')" name="enabled" :help="t('scheduledJobs.form.enabledHelp')">
            <USwitch v-model="state.enabled" />
          </UFormField>
          <UFormField :label="t('scheduledJobs.form.fields.allowConcurrent')" name="allowConcurrent" :help="t('scheduledJobs.form.allowConcurrentHelp')">
            <USwitch v-model="state.allowConcurrent" />
          </UFormField>
        </div>

        <UFormField
          v-if="mode === 'edit'"
          :label="t('scheduledJobs.form.fields.active')"
          name="active"
          :help="t('scheduledJobs.form.activeHelp')"
        >
          <USwitch v-model="state.active" />
        </UFormField>

        <!-- Read-only: which ScheduledJobRunner bean (if any) actually executes this
             code. Only shown in edit mode — in create mode the code may not have a
             runner yet (it's normally added in code before the row is created). -->
        <div v-if="mode === 'edit' && job">
          <p class="text-xs font-medium text-prohealth-700 mb-1">{{ t('scheduledJobs.form.runnerSection.title') }}</p>
          <div v-if="job.runnerRegistered" class="text-xs text-prohealth-600">
            {{ t('scheduledJobs.form.runnerSection.registered') }}
            <code class="font-mono text-xs bg-prohealth-100 rounded px-1 py-0.5">{{ job.runnerClass }}</code>
          </div>
          <UAlert
            v-else
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="t('scheduledJobs.form.runnerSection.notRegisteredTitle')"
            :description="t('scheduledJobs.form.runnerSection.notRegisteredBody', { code: job.code })"
          />
        </div>

        <!-- Parámetros libres (JSONB `parameters`) — clave/valor ↔ JSON crudo -->
        <div>
          <p class="text-xs font-medium text-prohealth-700 mb-2">{{ t('scheduledJobs.form.parameters.title') }}</p>
          <UTabs
            :model-value="params.mode.value"
            :items="paramTabs"
            :content="false"
            class="mb-3"
            @update:model-value="(v) => params.switchMode(v as JsonKeyValueMode)"
          />

          <div v-if="params.mode.value === 'kv'" class="space-y-2">
            <div v-for="(row, index) in params.pairs.value" :key="index" class="flex flex-wrap items-center gap-2">
              <UInput
                v-model="row.key"
                :placeholder="t('scheduledJobs.form.parameters.keyPlaceholder')"
                :aria-label="t('scheduledJobs.form.parameters.keyPlaceholder')"
                class="w-full sm:w-48 font-mono"
              />
              <UInput
                v-model="row.value"
                :placeholder="t('scheduledJobs.form.parameters.valuePlaceholder')"
                :aria-label="t('scheduledJobs.form.parameters.valuePlaceholder')"
                class="w-full sm:flex-1"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                size="sm"
                :aria-label="t('common.delete')"
                @click="params.removeRow(index)"
              />
            </div>
            <UButton color="primary" variant="outline" icon="i-lucide-plus" size="sm" @click="params.addRow()">
              {{ t('scheduledJobs.form.parameters.addRow') }}
            </UButton>
          </div>
          <div v-else>
            <UTextarea v-model="params.json.value" :rows="6" class="w-full font-mono text-xs" />
          </div>
        </div>

        <!-- Discard unsaved changes before refreshing -->
        <UModal v-model:open="discardConfirmOpen" :title="t('common.discardChangesTitle')">
          <template #body>
            <p class="text-sm text-prohealth-700">{{ t('common.discardChangesBody') }}</p>
            <div class="flex items-center justify-end gap-3 pt-5">
              <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">{{ t('common.cancel') }}</UButton>
              <UButton color="warning" icon="i-lucide-refresh-cw" @click="discardAndRefresh">{{ t('common.discardAndRefresh') }}</UButton>
            </div>
          </template>
        </UModal>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

        <div class="flex items-center justify-between gap-3">
          <div v-if="mode === 'edit' && job">
            <RestoreButton
              v-if="job.active === false"
              :active="job.active"
              :allowed="canDelete"
              :loading="restoring"
              :disabled="isSubmitting"
              @restore="restoreJob"
            />
            <UButton
              v-else
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              size="sm"
              :label="t('common.delete')"
              :disabled="isSubmitting"
              @click="openDeleteFromEdit"
            />
          </div>
          <div v-else />

          <div class="flex items-center gap-3">
            <RefreshButton
              v-if="mode === 'edit'"
              :icon-only="false"
              :label="t('common.refresh')"
              :title="t('common.refresh')"
              :loading="reloading"
              :disabled="isSubmitting"
              @refresh="onRefresh"
            />
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              :color="mode === 'create' ? 'primary' : 'info'"
              variant="outline"
              :loading="isSubmitting"
              :disabled="loadingDetail"
              icon="i-lucide-save"
              @click="formRef?.submit()"
            >
              {{ mode === 'create' ? t('common.saveNew') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
