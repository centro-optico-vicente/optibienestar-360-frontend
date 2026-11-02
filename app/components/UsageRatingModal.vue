<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import { RATING_COMMENT_MAX, type BenefitUsageDto } from '~/types/benefits'

/**
 * Member rates (or re-rates) one of their benefit usages:
 * PUT /v1/me/usage-history/{uuid}/rating (MEMBER_RATE_USAGE).
 * Ally stars are required; product stars only when the usage is catalogued
 * (`allyProductUuid`); the comment is optional. Emits the updated usage.
 */
const props = defineProps<{
  open: boolean
  usage: BenefitUsageDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [usage: BenefitUsageDto]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const { t } = useI18n()
const toast = useToast()
const { rateMine } = useBenefitUsage()

const allyRating = ref<number | null>(null)
const productRating = ref<number | null>(null)
const comment = ref('')
const touched = ref(false)
const submitting = ref(false)

const hasProduct = computed(() => !!props.usage?.allyProductUuid)
const isEdit = computed(() => props.usage?.allyRating != null)

const allyError = computed(() =>
  touched.value && !allyRating.value ? t('members.usage.rating.allyRequired') : undefined)

watch(() => props.open, (open) => {
  if (!open) return
  allyRating.value = props.usage?.allyRating ?? null
  productRating.value = props.usage?.productRating ?? null
  comment.value = props.usage?.ratingComment ?? ''
  touched.value = false
})

/** Backend business codes we phrase ourselves; anything else shows the (localized) ProblemDetail. */
const ERROR_KEYS: Record<string, string> = {
  'benefit_usage.rating.not_ratable': 'members.usage.rating.errors.notRatable',
  'benefit_usage.rating.product_not_applicable': 'members.usage.rating.errors.productNotApplicable',
  'benefit_usage.not_found': 'members.usage.rating.errors.notFound',
}

async function submit() {
  touched.value = true
  const usage = props.usage
  if (!usage || !allyRating.value) return
  submitting.value = true
  try {
    const text = comment.value.trim()
    const updated = await rateMine(usage.uuid, {
      allyRating: allyRating.value,
      productRating: hasProduct.value ? productRating.value : null,
      comment: text || null,
    }, { silent: true })
    toast.add({
      title: t(isEdit.value ? 'members.usage.rating.updatedToast' : 'members.usage.rating.savedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    emit('saved', updated)
    isOpen.value = false
  }
  catch (err) {
    const e = err as ApiError
    const code = typeof e.problem?.code === 'string' ? e.problem.code : ''
    const key = ERROR_KEYS[code]
    toast.add({
      title: t('members.usage.rating.errorToast'),
      description: key ? t(key) : e.message || t('errors.unexpected'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t(isEdit ? 'members.usage.rating.editTitle' : 'members.usage.rating.title')"
    :description="usage ? [usage.allyName, usage.usageDate_Display ?? usage.usageDate].filter(Boolean).join(' · ') : undefined"
  >
    <template #body>
      <form class="space-y-5" @submit.prevent="submit">
        <UFormField :label="t('members.usage.rating.allyLabel', { name: usage?.allyName || t('common.empty') })" required :error="allyError">
          <RatingStars
            v-model="allyRating"
            editable
            size="lg"
            :label="t('members.usage.rating.allyLabel', { name: usage?.allyName || t('common.empty') })"
            :disabled="submitting"
          />
        </UFormField>

        <UFormField
          v-if="hasProduct"
          :label="t('members.usage.rating.productLabel', { name: usage?.allyProductName || t('members.usage.rating.productFallback') })"
          :hint="t('members.usage.rating.optional')"
        >
          <RatingStars
            v-model="productRating"
            editable
            size="lg"
            :label="t('members.usage.rating.productLabel', { name: usage?.allyProductName || t('members.usage.rating.productFallback') })"
            :disabled="submitting"
          />
        </UFormField>

        <UFormField :label="t('members.usage.rating.commentLabel')" :hint="`${comment.length}/${RATING_COMMENT_MAX}`">
          <UTextarea
            v-model="comment"
            :rows="3"
            :maxlength="RATING_COMMENT_MAX"
            :placeholder="t('members.usage.rating.commentPlaceholder')"
            :disabled="submitting"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" icon="i-lucide-star" :loading="submitting">
            {{ t('members.usage.rating.submit') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
