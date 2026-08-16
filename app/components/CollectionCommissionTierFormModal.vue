<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CollectionCommissionTierDto,
  CreateCollectionCommissionTierRequest,
  UpdateCollectionCommissionTierRequest,
} from '~/types/collectionCommissionTiers'

// Create/edit form for a collection commission tier (comisión de cobranza por
// días, ADR 0013 §3, V44) — a decreasing-% bucket by days-to-collect.
const props = defineProps<{
  open: boolean
  tier?: CollectionCommissionTierDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [tier: CollectionCommissionTierDto]
  'delete': [tier: CollectionCommissionTierDto]
}>()

const { t } = useI18n()
const tiers = useCollectionCommissionTiers()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.tier ? 'edit' : 'create'))
const isSubmitting = ref(false)

interface FormState {
  name: string
  maxDays: string
  commissionPct: string
}

const state = reactive<FormState>({ name: '', maxDays: '', commissionPct: '' })
// Kept outside `state` (a string-only form-state map) so the boolean isn't coerced.
const isActive = ref(true)

const schema = computed(() => z.object({
  name: z.string().min(3, t('validation.minChars', { n: 3 })).max(80, t('validation.maxChars', { n: 80 })),
  maxDays: z.string().regex(/^[1-9]\d*$/, t('commissionRules.form.integersOnly')),
  commissionPct: z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount')),
}))

function populateFrom(tier: CollectionCommissionTierDto | null) {
  if (!tier) {
    state.name = ''
    state.maxDays = ''
    state.commissionPct = ''
    isActive.value = true
    return
  }
  state.name = tier.name
  state.maxDays = String(tier.maxDays)
  state.commissionPct = String(tier.commissionPct)
  isActive.value = tier.active ?? true
}

watch(() => props.open, (open) => { if (open) populateFrom(props.tier ?? null) })

async function onSubmit(_e: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    let result: CollectionCommissionTierDto
    if (mode.value === 'create') {
      const body: CreateCollectionCommissionTierRequest = {
        name: state.name.trim(),
        maxDays: Number(state.maxDays),
        commissionPct: state.commissionPct.trim(),
      }
      result = await tiers.create(body)
      toast.add({ title: t('commissionRules.collectionTiers.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      const body: UpdateCollectionCommissionTierRequest = {
        name: state.name.trim(),
        maxDays: Number(state.maxDays),
        commissionPct: state.commissionPct.trim(),
      }
      body.active = isActive.value
      result = await tiers.update(props.tier!.uuid, body)
      toast.add({ title: t('commissionRules.collectionTiers.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error
  }
  finally {
    isSubmitting.value = false
  }
}

function openDeleteFromEdit() {
  if (!props.tier) return
  isOpen.value = false
  emit('delete', props.tier)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('commissionRules.collectionTiers.form.createTitle') : t('commissionRules.collectionTiers.form.editTitle')"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('commissionRules.collectionTiers.form.name')" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.collectionTiers.form.maxDays')" name="maxDays" required :help="t('commissionRules.collectionTiers.form.maxDaysHelp')">
            <UInput v-model="state.maxDays" inputmode="numeric" placeholder="5" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.collectionTiers.form.commissionPct')" name="commissionPct" required>
            <UInput v-model="state.commissionPct" placeholder="35.00" class="w-full">
              <template #trailing><span class="text-prohealth-400 text-sm">%</span></template>
            </UInput>
          </UFormField>
        </div>

        <UFormField v-if="mode === 'edit'" :label="t('commissionRules.collectionTiers.form.active')">
          <USwitch v-model="isActive" />
        </UFormField>

        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

        <div class="flex items-center justify-between gap-3 pt-2">
          <div v-if="mode === 'edit' && tier">
            <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :label="t('common.delete')" :disabled="isSubmitting" @click="openDeleteFromEdit" />
          </div>
          <div v-else />
          <div class="flex items-center gap-3">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
              {{ mode === 'create' ? t('commissionRules.collectionTiers.form.submitCreate') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
