<script setup lang="ts">
import type { PromotionDto } from '~/types/promotions'

/** "Promociones" tab of the campaign detail (hub ADR 0018): the % discounts this campaign offers members. */
const props = defineProps<{ campaignUuid: string }>()

const { t } = useI18n()
const { can } = usePermissions()
const promotionsApi = usePromotions()
const toast = useToast()

const canCreate = computed(() => can('PROMOTION_CREATE'))
const canUpdate = computed(() => can('PROMOTION_UPDATE'))
const canDelete = computed(() => can('PROMOTION_DELETE'))

const items = ref<PromotionDto[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    items.value = await promotionsApi.listForCampaign(props.campaignUuid)
  }
  catch {
    items.value = []
  }
  finally {
    loading.value = false
  }
}
onMounted(load)

const formOpen = ref(false)
const editing = ref<PromotionDto | null>(null)
function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(p: PromotionDto) {
  editing.value = p
  formOpen.value = true
}

const deleteTarget = ref<PromotionDto | null>(null)
const deleteOpen = ref(false)
const deleting = ref(false)
function openDelete(p: PromotionDto) {
  deleteTarget.value = p
  deleteOpen.value = true
}
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await promotionsApi.remove(deleteTarget.value.uuid)
    toast.add({ title: t('promotions.deletedToast'), color: 'success', icon: 'i-lucide-trash-2' })
    deleteOpen.value = false
    await load()
  }
  catch {
    // useApi already notified
  }
  finally {
    deleting.value = false
  }
}

function discountLabel(p: PromotionDto): string {
  const pct = p.discountPct_Display ?? `${Number(p.discountPct)}%`
  const what = p.appliesTo_Display ?? t(`promotions.appliesTo.${p.appliesTo}`)
  const cycles = p.appliesTo !== 'INSCRIPTION' && p.cycles ? ` · ${t('promotions.cyclesCount', { n: p.cycles })}` : ''
  return `${pct} · ${what}${cycles}`
}

function codeLabel(p: PromotionDto): string {
  if (!p.requiresCode && !p.acceptsPromoterCode && !p.acceptsMemberCode && !p.acceptsAllyCode) return t('promotions.noCode')
  const owners = [
    p.acceptsPromoterCode ? t('promotions.codeOwner.PROMOTER') : null,
    p.acceptsMemberCode ? t('promotions.codeOwner.MEMBER') : null,
    p.acceptsAllyCode ? t('promotions.codeOwner.ALLY') : null,
  ].filter(Boolean).join(', ')
  return p.requiresCode ? t('promotions.codeRequired', { owners }) : t('promotions.codeOptional', { owners })
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('promotions.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('promotions.hint') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton v-if="canCreate" color="primary" variant="outline" size="sm" icon="i-lucide-plus" @click="openCreate">
          {{ t('promotions.add') }}
        </UButton>
        <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-prohealth-50/60">
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-6 py-3 font-semibold">{{ t('promotions.fields.name') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('promotions.fields.kind') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('promotions.columns.discount') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('promotions.columns.code') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('promotions.columns.redemptions') }}</th>
            <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <TableSkeleton v-if="loading" :rows="3" :cols="6" />
          <tr v-else-if="items.length === 0">
            <td colspan="6" class="px-6 py-10 text-center text-prohealth-500">{{ t('promotions.empty') }}</td>
          </tr>
          <tr v-for="p in items" v-else :key="p.uuid" class="hover:bg-prohealth-50/50">
            <td class="px-6 py-3">
              <p class="font-medium text-prohealth-900">{{ p.name }}</p>
              <p v-if="p.plans.length" class="text-xs text-prohealth-500">{{ p.plans.map(pl => pl.name).join(', ') }}</p>
            </td>
            <td class="px-6 py-3">
              <UBadge :color="p.kind === 'RECOVERY' ? 'warning' : 'primary'" variant="subtle" size="sm">
                {{ p.kind_Display ?? t(`promotions.kind.${p.kind}`) }}
              </UBadge>
            </td>
            <td class="px-6 py-3 text-prohealth-800">{{ discountLabel(p) }}</td>
            <td class="px-6 py-3 text-prohealth-600">{{ codeLabel(p) }}</td>
            <td class="px-6 py-3 text-prohealth-600">
              {{ p.maxRedemptions ? `${p.redemptionsCount} / ${p.maxRedemptions}` : p.redemptionsCount }}
            </td>
            <td class="px-6 py-3">
              <div class="flex items-center justify-end gap-1">
                <UButton v-if="canUpdate" color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEdit(p)" />
                <UButton v-if="canDelete" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" @click="openDelete(p)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PromotionFormModal v-model:open="formOpen" :campaign-uuid="campaignUuid" :promotion="editing" @saved="load" />

    <UModal v-model:open="deleteOpen" :title="t('promotions.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('promotions.deleteConfirm', { name: deleteTarget?.name ?? '' }) }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
