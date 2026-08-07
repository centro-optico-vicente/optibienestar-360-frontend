<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
<<<<<<< Updated upstream
  CollectionCommissionTierDto,
  CreateCollectionCommissionTierRequest,
  UpdateCollectionCommissionTierRequest,
} from '~/types/collectionCommissionTiers'

// Create/edit form for a collection commission tier (comisión de cobranza por
// días, ADR 0013 §3, V44) — a decreasing-% bucket by days-to-collect.
=======
  CollectionCommissionTierCreateRequest,
  CollectionCommissionTierDto,
  CollectionCommissionTierUpdateRequest,
} from '~/types/promoters'

// Create/edit form for a collection-commission tier (V44): a band mapping
// "days of arrears collected" (maxDays) to a commission percentage. Shared by
// the list page (/dashboard/collection-commission-tiers). PATCH semantics on
// edit — every field is optional in CollectionCommissionTierUpdateRequest.
>>>>>>> Stashed changes
const props = defineProps<{
  open: boolean
  tier?: CollectionCommissionTierDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [tier: CollectionCommissionTierDto]
<<<<<<< Updated upstream
  'delete': [tier: CollectionCommissionTierDto]
=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  maxDays: string
  commissionPct: string
}

const state = reactive<FormState>({ name: '', maxDays: '', commissionPct: '' })

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
    return
  }
  state.name = tier.name
  state.maxDays = String(tier.maxDays)
  state.commissionPct = String(tier.commissionPct)
}

watch(() => props.open, (open) => { if (open) populateFrom(props.tier ?? null) })

async function onSubmit(_e: FormSubmitEvent<Record<string, unknown>>) {
=======
  maxDays: number
  commissionPct: number
  active: boolean
}

const state = reactive<FormState>({
  name: '',
  maxDays: 30,
  commissionPct: 20,
  active: true,
})

const schema = computed(() => z.object({
  name: z.string().min(1, t('validation.required')).max(120, t('validation.maxChars', { n: 120 })),
  maxDays: z.number().int().positive(t('collectionCommissionTiers.form.maxDaysInvalid')),
  commissionPct: z.number().min(0.01, t('collectionCommissionTiers.form.commissionPctInvalid')).max(100, t('collectionCommissionTiers.form.commissionPctInvalid')),
  active: z.boolean().optional(),
}))

function populateFrom(item: CollectionCommissionTierDto | null) {
  if (!item) {
    state.name = ''
    state.maxDays = 30
    state.commissionPct = 20
    state.active = true
    return
  }
  state.name = item.name
  state.maxDays = item.maxDays
  state.commissionPct = Number(item.commissionPct)
  state.active = item.active
}

watch(() => props.open, (open) => {
  if (!open) return
  populateFrom(props.tier ?? null)
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
>>>>>>> Stashed changes
  isSubmitting.value = true
  try {
    let result: CollectionCommissionTierDto
    if (mode.value === 'create') {
<<<<<<< Updated upstream
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
      result = await tiers.update(props.tier!.uuid, body)
      toast.add({ title: t('commissionRules.collectionTiers.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
=======
      const body: CollectionCommissionTierCreateRequest = {
        name: state.name.trim(),
        maxDays: state.maxDays,
        commissionPct: state.commissionPct,
      }
      result = await tiers.create(body)
      toast.add({ title: t('collectionCommissionTiers.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      const body: CollectionCommissionTierUpdateRequest = {
        name: state.name.trim(),
        maxDays: state.maxDays,
        commissionPct: state.commissionPct,
        active: state.active,
      }
      result = await tiers.update(props.tier!.uuid, body)
      toast.add({ title: t('collectionCommissionTiers.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
>>>>>>> Stashed changes
    }
    emit('saved', result)
    isOpen.value = false
  }
  catch {
<<<<<<< Updated upstream
    // useApi already notified the error
=======
    // useApi already notified the error (422 validations, etc.)
>>>>>>> Stashed changes
  }
  finally {
    isSubmitting.value = false
  }
}
<<<<<<< Updated upstream

function openDeleteFromEdit() {
  if (!props.tier) return
  isOpen.value = false
  emit('delete', props.tier)
}
=======
>>>>>>> Stashed changes
</script>

<template>
  <UModal
    v-model:open="isOpen"
<<<<<<< Updated upstream
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
=======
    :title="mode === 'create' ? t('collectionCommissionTiers.form.createTitle') : t('collectionCommissionTiers.form.editTitle')"
    :description="t('collectionCommissionTiers.form.description')"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('collectionCommissionTiers.form.fields.name')" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <UFormField
          :label="t('collectionCommissionTiers.form.fields.maxDays')"
          name="maxDays"
          required
          :help="t('collectionCommissionTiers.form.maxDaysHelp')"
        >
          <UInputNumber v-model="state.maxDays" :min="1" :step="1" class="w-full" />
        </UFormField>

        <UFormField
          :label="t('collectionCommissionTiers.form.fields.commissionPct')"
          name="commissionPct"
          required
          :help="t('collectionCommissionTiers.form.commissionPctHelp')"
        >
          <UInputNumber
            v-model="state.commissionPct"
            :min="0.01"
            :max="100"
            :step="0.5"
            :format-options="{ maximumFractionDigits: 2 }"
            class="w-full"
          />
        </UFormField>

        <UFormField v-if="mode === 'edit'" :label="t('collectionCommissionTiers.form.fields.active')" name="active">
          <USwitch v-model="state.active" />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
            {{ mode === 'create' ? t('collectionCommissionTiers.form.submitCreate') : t('common.saveChanges') }}
          </UButton>
>>>>>>> Stashed changes
        </div>
      </UForm>
    </template>
  </UModal>
</template>
