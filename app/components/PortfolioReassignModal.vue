<script setup lang="ts">
import type { PromoterDto } from '~/types/promoters'

/**
 * Portfolio reassignment (MEMBER_ASSIGN_PROMOTER), from the promoter detail
 * page. `selected` moves the checked members to one promoter (repeat to split
 * a portfolio among several); `supervisor` rolls the whole portfolio up to the
 * nearest active supervisor, or INSTITUCION when there is none. Past
 * collections and commissions stay with the original promoter — only future
 * attribution moves.
 */
const props = defineProps<{
  open: boolean
  mode: 'selected' | 'supervisor'
  sourcePromoterUuid: string
  sourcePromoterName: string
  memberUuids: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'done': [movedCount: number]
}>()

const { t } = useI18n()
const members = useMembers()
const promoters = usePromoters()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const targetUuid = ref<string | undefined>(undefined)
const reason = ref('')
const touched = ref(false)
const submitting = ref(false)
const promoterOptions = ref<{ label: string, value: string }[]>([])
const loadingOptions = ref(false)

const targetError = computed(() =>
  props.mode === 'selected' && touched.value && !targetUuid.value ? t('validation.required') : undefined)
const reasonError = computed(() =>
  touched.value && reason.value.trim().length < 3 ? t('validation.minChars', { n: 3 }) : undefined)

async function loadPromoterOptions() {
  loadingOptions.value = true
  try {
    const page = await promoters.list({ size: 100, sort: ['displayName,asc'] })
    promoterOptions.value = (page.content ?? [])
      .filter((p: PromoterDto) => p.active && p.uuid !== props.sourcePromoterUuid)
      .map((p: PromoterDto) => ({ label: p.displayName, value: p.uuid }))
  }
  catch {
    promoterOptions.value = []
  }
  finally {
    loadingOptions.value = false
  }
}

watch(() => props.open, (open) => {
  if (!open) return
  targetUuid.value = undefined
  reason.value = ''
  touched.value = false
  if (props.mode === 'selected') loadPromoterOptions()
})

async function confirm() {
  touched.value = true
  if (targetError.value || reasonError.value) return
  submitting.value = true
  try {
    const moved = props.mode === 'selected'
      ? await members.bulkAssignPromoter({
          memberUuids: props.memberUuids,
          promoterUuid: targetUuid.value!,
          reason: reason.value.trim(),
        })
      : await members.portfolioToSupervisor({
          sourcePromoterUuid: props.sourcePromoterUuid,
          reason: reason.value.trim(),
        })
    toast.add({
      title: t('promoters.portfolio.doneToast', { count: moved.length }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    emit('done', moved.length)
    isOpen.value = false
  }
  catch {
    // toast handled by useApi
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'selected' ? t('promoters.portfolio.selectedTitle') : t('promoters.portfolio.supervisorTitle')"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-prohealth-700">
          {{ mode === 'selected'
            ? t('promoters.portfolio.selectedNotice', { count: memberUuids.length, name: sourcePromoterName })
            : t('promoters.portfolio.supervisorNotice', { name: sourcePromoterName }) }}
        </p>
        <p class="text-xs text-prohealth-500">{{ t('promoters.portfolio.historyNotice') }}</p>

        <UFormField v-if="mode === 'selected'" :label="t('promoters.portfolio.target')" required :error="targetError">
          <USelectMenu
            v-model="targetUuid"
            :items="promoterOptions"
            label-key="label"
            value-key="value"
            :loading="loadingOptions"
            :placeholder="t('promoters.portfolio.targetPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('promoters.portfolio.reason')" required :error="reasonError">
          <UTextarea
            v-model="reason"
            :rows="3"
            :maxlength="500"
            :placeholder="t('promoters.portfolio.reasonPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" icon="i-lucide-arrow-right-left" :loading="submitting" @click="confirm">
            {{ t('promoters.portfolio.confirm') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
