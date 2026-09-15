<script setup lang="ts">
import type { SelectItem } from '~/types/options'
import { toSelectItems } from '~/types/options'

/**
 * Reasigna el supervisor de un promotor SIN cambiar su cargo — para
 * ascender/degradar (cambio de cargo) ver `PromoterChangeRankModal`.
 * Compartido por la vista de organigrama (`/dashboard/promoters/hierarchy`).
 */
const props = defineProps<{
  open: boolean
  promoterUuid: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const { t } = useI18n()
const promotersApi = usePromoters()
const hierarchyApi = usePromoterHierarchy()
const toast = useToast()

function goToSupervisor(to: string) {
  isOpen.value = false
  navigateTo(to)
}

const loading = ref(false)
const submitting = ref(false)
const touched = ref(false)

const promoterName = ref('')
const currentRankUuid = ref<string | null>(null)
const currentRankDisplay = ref('')
const supervisorOptions = ref<SelectItem[]>([])
const selectedSupervisor = ref<string>('')
const detachSupervisor = ref(false)
const reason = ref('')

const reasonError = computed(() =>
  touched.value && !reason.value.trim() ? t('validation.required') : undefined)

async function load() {
  if (!props.promoterUuid) return
  loading.value = true
  supervisorOptions.value = []
  try {
    const promoter = await promotersApi.get(props.promoterUuid)
    promoterName.value = promoter.displayName
    currentRankUuid.value = promoter.rank_Uuid ?? null
    currentRankDisplay.value = promoter.rank_Display ?? ''
    selectedSupervisor.value = promoter.supervisor_Uuid ?? ''
    detachSupervisor.value = !promoter.supervisor_Uuid

    if (currentRankUuid.value) {
      // Every rank strictly above the promoter's own current rank — a plain
      // reassignment isn't constrained to the immediate-next rank the way
      // the change-rank flow's picker is (see PromoterChangeRankModal).
      const options = await hierarchyApi.eligibleSupervisors(currentRankUuid.value, { allSuperiors: true, limit: 200 })
      supervisorOptions.value = toSelectItems(options)
    }
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    loading.value = false
  }
}

watch([() => props.open, () => props.promoterUuid], ([open]) => {
  if (!open) return
  touched.value = false
  reason.value = ''
  load()
})

async function confirm() {
  if (!props.promoterUuid) return
  touched.value = true
  const text = reason.value.trim()
  if (!text) return
  submitting.value = true
  try {
    await hierarchyApi.assignSupervisor(props.promoterUuid, {
      supervisorUuid: detachSupervisor.value ? null : (selectedSupervisor.value || null),
      reason: text,
    })
    toast.add({ title: t('promoters.hierarchy.assignSupervisor.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved')
    isOpen.value = false
  }
  catch {
    // useApi ya notificó el error (p.ej. ciclo, rango no superior, capacidad)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('promoters.hierarchy.assignSupervisor.title', { name: promoterName })">
    <template #body>
      <div v-if="loading" class="space-y-3">
        <USkeleton class="h-9 w-full rounded" />
        <USkeleton class="h-20 w-full rounded" />
      </div>
      <div v-else class="space-y-4">
        <p class="text-sm text-prohealth-600">
          {{ t('promoters.hierarchy.assignSupervisor.currentRank', { rank: currentRankDisplay }) }}
        </p>

        <label class="flex items-center gap-2.5 cursor-pointer">
          <UCheckbox v-model="detachSupervisor" />
          <span class="text-sm text-prohealth-700">{{ t('promoters.hierarchy.detachSupervisorLabel') }}</span>
        </label>

        <UFormField
          v-if="!detachSupervisor"
          :label="t('promoters.hierarchy.supervisorLabel')"
          required
        >
          <CommonEntityReferenceSelect
            v-model="selectedSupervisor"
            :items="supervisorOptions"
            entity="promoter"
            :placeholder="t('promoters.hierarchy.supervisorPlaceholder')"
            @navigate="goToSupervisor"
          />
          <p v-if="supervisorOptions.length === 0" class="text-xs text-amber-600 mt-1">
            {{ t('promoters.hierarchy.noEligibleSupervisors') }}
          </p>
        </UFormField>

        <UFormField :label="t('promoters.hierarchy.reasonLabel')" required :error="reasonError">
          <UTextarea
            v-model="reason"
            :rows="3"
            :maxlength="2000"
            class="w-full"
            @blur="touched = true"
          />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-save"
            :loading="submitting"
            :disabled="!detachSupervisor && !selectedSupervisor"
            @click="confirm"
          >
            {{ t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
