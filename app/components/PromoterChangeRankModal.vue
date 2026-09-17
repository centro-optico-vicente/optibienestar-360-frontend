<script setup lang="ts">
import type { CatalogItem } from '~/types/catalogs'
import type { SelectItem } from '~/types/options'
import { toSelectItems } from '~/types/options'

/**
 * Asciende o degrada el cargo de un promotor. Flujo de dos pasos: primero se
 * elige el rango nuevo (excluyendo el actual), y a partir de ese rango se
 * listan los supervisores elegibles — por defecto solo el rango inmediato
 * superior, con la opción de ampliar a todos los superiores. La reasignación
 * de supervisor va en la misma acción (hub plan §1 — resuelve por
 * construcción la pregunta de qué hacer con un ascenso que invalida al
 * supervisor actual).
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

function goToLinkedRecord(to: string) {
  isOpen.value = false
  navigateTo(to)
}

const loading = ref(false)
const loadingSupervisors = ref(false)
const submitting = ref(false)
const touched = ref(false)

const promoterName = ref('')
const currentRankUuid = ref<string | null>(null)
const currentRankDisplay = ref('')

const rankOptions = ref<SelectItem[]>([])
// Full rank records (with `parentRankUuid`) backing `rankOptions`' lightweight
// `Option[]` — needed to answer "is the selected rank the top of the
// hierarchy" directly instead of inferring it from an empty options list.
const allRanks = ref<CatalogItem[]>([])
const selectedRank = ref('')
const supervisorOptions = ref<SelectItem[]>([])
const selectedSupervisor = ref('')
const allSuperiors = ref(false)
const reason = ref('')

const reasonError = computed(() =>
  touched.value && !reason.value.trim() ? t('validation.required') : undefined)

async function loadSupervisors() {
  supervisorOptions.value = []
  selectedSupervisor.value = ''
  if (!selectedRank.value) return
  loadingSupervisors.value = true
  try {
    const options = await hierarchyApi.eligibleSupervisors(selectedRank.value, { allSuperiors: allSuperiors.value, limit: 200 })
    supervisorOptions.value = toSelectItems(options)
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    loadingSupervisors.value = false
  }
}

watch(selectedRank, loadSupervisors)
watch(allSuperiors, loadSupervisors)

async function load() {
  if (!props.promoterUuid) return
  loading.value = true
  rankOptions.value = []
  selectedRank.value = ''
  allSuperiors.value = false
  try {
    const promoter = await promotersApi.get(props.promoterUuid)
    promoterName.value = promoter.displayName
    currentRankUuid.value = promoter.rank_Uuid ?? null
    currentRankDisplay.value = promoter.rank_Display ?? ''

    const options = await hierarchyApi.rankOptions({
      excludeUuid: currentRankUuid.value ?? undefined,
      limit: 200,
    })
    rankOptions.value = toSelectItems(options)
    allRanks.value = await useCatalog('/v1/admin/promoter-ranks').listAll()
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

// El backend exige supervisor salvo que el rango nuevo sea el más alto de la
// jerarquía — ahora se determina directamente por el `parentRankUuid` real
// del rango elegido (`null` = tope), en vez de inferirlo de una lista de
// candidatos vacía (heurística previa, ambigua con "nadie califica todavía").
const selectedRankItem = computed(() => allRanks.value.find(r => r.uuid === selectedRank.value) ?? null)
const supervisorLooksOptional = computed(() => selectedRankItem.value?.parentRankUuid == null)

async function confirm() {
  if (!props.promoterUuid || !selectedRank.value) return
  touched.value = true
  const text = reason.value.trim()
  if (!text) return
  submitting.value = true
  try {
    await hierarchyApi.changeRank(props.promoterUuid, {
      newRankUuid: selectedRank.value,
      newSupervisorUuid: selectedSupervisor.value || null,
      reason: text,
    })
    toast.add({ title: t('promoters.hierarchy.changeRank.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved')
    isOpen.value = false
  }
  catch {
    // useApi ya notificó el error (p.ej. supervisor requerido, subordinado en conflicto)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('promoters.hierarchy.changeRank.title', { name: promoterName })">
    <template #body>
      <div v-if="loading" class="space-y-3">
        <USkeleton class="h-9 w-full rounded" />
        <USkeleton class="h-9 w-full rounded" />
        <USkeleton class="h-20 w-full rounded" />
      </div>
      <div v-else class="space-y-4">
        <p class="text-sm text-prohealth-600">
          {{ t('promoters.hierarchy.changeRank.currentRank', { rank: currentRankDisplay }) }}
        </p>

        <UFormField :label="t('promoters.hierarchy.changeRank.newRankLabel')" required>
          <CommonEntityReferenceSelect
            v-model="selectedRank"
            :items="rankOptions"
            entity="promoter_rank"
            :placeholder="t('promoters.hierarchy.changeRank.newRankPlaceholder')"
            @navigate="goToLinkedRecord"
          />
        </UFormField>

        <template v-if="selectedRank">
          <label class="flex items-center gap-2.5 cursor-pointer">
            <UCheckbox v-model="allSuperiors" />
            <span class="text-sm text-prohealth-700">{{ t('promoters.hierarchy.changeRank.allSuperiorsLabel') }}</span>
          </label>

          <UFormField :label="t('promoters.hierarchy.supervisorLabel')" :required="!supervisorLooksOptional">
            <CommonEntityReferenceSelect
              v-model="selectedSupervisor"
              :items="supervisorOptions"
              :loading="loadingSupervisors"
              entity="promoter"
              :placeholder="t('promoters.hierarchy.supervisorPlaceholder')"
              @navigate="goToLinkedRecord"
            />
            <p v-if="!loadingSupervisors && supervisorOptions.length === 0" class="text-xs text-amber-600 mt-1">
              {{ supervisorLooksOptional
                ? t('promoters.hierarchy.changeRank.topRankHint')
                : t('promoters.hierarchy.noEligibleSupervisors') }}
            </p>
          </UFormField>
        </template>

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
            :disabled="!selectedRank"
            @click="confirm"
          >
            {{ t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
