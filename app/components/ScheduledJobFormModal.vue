<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  ScheduledJobCreateRequest,
  ScheduledJobDto,
  ScheduledJobUpdateRequest,
} from '~/types/scheduling'

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
}>()

const { t } = useI18n()
const jobs = useScheduledJobs()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.job ? 'edit' : 'create'))
const isSubmitting = ref(false)

interface FormState {
  code: string
  displayName: string
  description: string
  cronExpression: string
  timezone: string
  enabled: boolean
  allowConcurrent: boolean
  maxSyncSeconds: string
  active: boolean
}

const state = reactive<FormState>({
  code: '',
  displayName: '',
  description: '',
  cronExpression: '',
  timezone: 'America/Caracas',
  enabled: true,
  allowConcurrent: false,
  maxSyncSeconds: '30',
  active: true,
})

// Locale-reactive schema — wrapped in computed so validation messages follow the
// UI locale. `code`: UPPER_SNAKE_CASE ^[A-Z][A-Z0-9_]{0,79}$. `maxSyncSeconds`: int >= 0.
const schema = computed(() => {
  return z.object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/, t('scheduledJobs.form.codeFormat')),
    displayName: z.string().min(1, t('validation.required')).max(120, t('validation.maxChars', { n: 120 })),
    description: z.string().optional(),
    cronExpression: z.string().min(1, t('validation.required')),
    timezone: z.string().min(1, t('validation.required')),
    maxSyncSeconds: z.string().regex(/^\d+$/, t('validation.digitsOnly')),
  })
})

// True while the detail loads when opening in edit mode.
const loadingDetail = ref(false)

function populateFrom(j: ScheduledJobDto | null) {
  if (!j) {
    state.code = ''
    state.displayName = ''
    state.description = ''
    state.cronExpression = ''
    state.timezone = 'America/Caracas'
    state.enabled = true
    state.allowConcurrent = false
    state.maxSyncSeconds = '30'
    state.active = true
    return
  }
  state.code = j.code ?? ''
  state.displayName = j.displayName ?? ''
  state.description = j.description ?? ''
  state.cronExpression = j.cronExpression ?? ''
  state.timezone = j.timezone ?? 'America/Caracas'
  state.enabled = j.enabled ?? true
  state.allowConcurrent = j.allowConcurrent ?? false
  state.maxSyncSeconds = j.maxSyncSeconds != null ? String(j.maxSyncSeconds) : '30'
  state.active = j.active ?? true
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
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('scheduledJobs.form.createTitle') : t('scheduledJobs.form.editTitle')"
    :description="mode === 'create' ? t('scheduledJobs.form.createDescription') : t('scheduledJobs.form.editDescription')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div v-if="loadingDetail" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
        <span class="text-sm">{{ t('scheduledJobs.form.loadingDetail') }}</span>
      </div>
      <UForm
        v-else
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
            />
          </UFormField>
          <UFormField :label="t('scheduledJobs.form.fields.timezone')" name="timezone" required>
            <UInput v-model="state.timezone" placeholder="America/Caracas" class="w-full font-mono" />
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
          <UInput v-model="state.cronExpression" placeholder="0 0 3 * * *" class="w-full font-mono" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('scheduledJobs.form.fields.maxSyncSeconds')" name="maxSyncSeconds" :help="t('scheduledJobs.form.maxSyncHelp')">
            <UInput v-model="state.maxSyncSeconds" inputmode="numeric" placeholder="30" class="w-full">
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

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
            {{ mode === 'create' ? t('scheduledJobs.form.submitCreate') : t('common.saveChanges') }}
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
