<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

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

const canUpdate = computed(() => can('JOB_UPDATE') || can('ROLE_UPDATE') || can('USER_UPDATE'))

const loading = ref(false)
const isSubmitting = ref(false)

const state = reactive({
  reportFooter: '',
})

const schema = computed(() =>
  z.object({
    reportFooter: z
      .string()
      .max(500, t('validation.maxChars', { n: 500 }))
      .optional()
      .or(z.literal('')),
  })
)

async function load() {
  loading.value = true
  try {
    const res = await systemConfigApi.get()
    state.reportFooter = res.reportFooter || ''
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
    })
    state.reportFooter = updated.reportFooter
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
