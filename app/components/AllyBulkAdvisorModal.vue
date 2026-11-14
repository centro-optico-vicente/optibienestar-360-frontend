<script setup lang="ts">
import { z } from 'zod'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'

// Sets the same advisor on the allies ticked in the allies list
// (POST /v1/admin/allies/advisor/bulk-assign, ALLY_ASSIGN_PROMOTER, at most 500 per request).
// Single-ally changes (and clearing the advisor) stay in AllyAdvisorModal on the ally detail.
const ALLY_BULK_ADVISOR_MAX = 500

const props = defineProps<{ open: boolean, allyUuids: string[] }>()
const emit = defineEmits<{ 'update:open': [boolean], 'done': [{ total: number, skipped: number }] }>()

const { t } = useI18n()
const toast = useToast()
const allies = useAllies()
const advisors = useAdvisorOptions()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const overLimit = computed(() => props.allyUuids.length > ALLY_BULK_ADVISOR_MAX)

// Active, non-system advisors (the `/options` default), searched on the server.
const advisorItems = useLazyOptions(q => advisors.search(q))

const { handleSubmit, errors, defineField, resetForm, isSubmitting } = useForm({
  validationSchema: computed(() => toTypedSchema(z.object({
    promoterUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  }))),
  initialValues: { promoterUuid: undefined as string | undefined },
})
const [promoterUuid] = defineField('promoterUuid')

watch(() => props.open, (open) => {
  if (open) resetForm()
})

const save = handleSubmit(async (values) => {
  if (overLimit.value || props.allyUuids.length === 0) return
  try {
    const res = await allies.bulkAssignAdvisor(props.allyUuids, values.promoterUuid)
    toast.add({
      title: t('allies.bulkAdvisor.doneToast', { total: res.total }),
      description: res.skipped ? t('allies.bulkAdvisor.skipped', { skipped: res.skipped }) : undefined,
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    isOpen.value = false
    emit('done', res)
  }
  catch {
    // useApi already toasted the backend's reason.
  }
})
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('allies.bulkAdvisor.modalTitle')" :ui="{ content: 'max-w-md' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="save">
        <p class="text-sm text-prohealth-700">{{ t('allies.bulkAdvisor.notice', { count: allyUuids.length }) }}</p>
        <UAlert
          v-if="overLimit"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="t('allies.bulkAdvisor.maxWarning', { max: ALLY_BULK_ADVISOR_MAX })"
        />
        <UFormField :label="t('allies.form.fields.capturedByPromoter')" required :error="errors.promoterUuid">
          <USelectMenu
            v-model="promoterUuid"
            v-model:search-term="advisorItems.searchTerm.value"
            clear
            :items="advisorItems.items.value"
            :loading="advisorItems.loading.value"
            ignore-filter
            label-key="label"
            value-key="value"
            icon="i-lucide-user-check"
            :placeholder="t('allies.bulkAdvisor.placeholder')"
            class="w-full"
            @update:open="advisorItems.onOpen"
            @update:model-value="advisorItems.remember($event)"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" :disabled="isSubmitting" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton type="submit" color="primary" icon="i-lucide-user-check" :loading="isSubmitting" :disabled="overLimit">
            {{ t('allies.bulkAdvisor.confirm') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
