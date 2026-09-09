<script setup lang="ts">
import type { CommissionApprovalGroupDto } from '~/types/promoters'
import { commissionStatusColor } from '~/types/promoters'

/**
 * Un nodo de promotor (nivel 1, colapsable) de la tabla de aprobación
 * comercial — mismo patrón visual que `RolePermissionsModal` (grupos
 * colapsables con checkbox "todo/nada" del grupo). El checkbox del nivel 1
 * selecciona/deselecciona todas las filas PENDING del promotor a la vez y
 * queda `indeterminate` si solo algunas están marcadas; las filas ya
 * APPROVED/PAID/REJECTED/VOIDED (`row.locked`) nunca son tocadas por él.
 */
const props = defineProps<{
  group: CommissionApprovalGroupDto
  /** uuids actualmente marcados entre las filas editables (PENDING) — el padre es dueño de este estado. */
  selected: Set<string>
}>()

const emit = defineEmits<{
  'toggle-row': [uuid: string, checked: boolean]
  'toggle-group': [checked: boolean]
}>()

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()

const expanded = ref(true)

const editableRows = computed(() => props.group.rows.filter(r => !r.locked))

const groupState = computed<boolean | 'indeterminate'>(() => {
  const ids = editableRows.value.map(r => r.uuid)
  if (ids.length === 0) return false
  const count = ids.filter(id => props.selected.has(id)).length
  if (count === 0) return false
  if (count === ids.length) return true
  return 'indeterminate'
})

function isChecked(uuid: string, row: { locked: boolean, checked: boolean }): boolean {
  return row.locked ? row.checked : props.selected.has(uuid)
}

function money(v?: number | null, currency?: string | null): string {
  if (v === null || v === undefined) return t('common.empty')
  return formatCurrency(Number(v), currency || 'USD')
}
</script>

<template>
  <div class="rounded-xl border border-prohealth-100 overflow-hidden">
    <div class="flex items-center gap-2 px-4 py-2.5 bg-prohealth-50/60">
      <UCheckbox
        :model-value="groupState"
        :disabled="editableRows.length === 0"
        @update:model-value="(v: boolean | 'indeterminate') => emit('toggle-group', v === true)"
        @click.stop
      />
      <button
        type="button"
        class="flex flex-1 items-center gap-2 text-left cursor-pointer"
        @click="expanded = !expanded"
      >
        <span class="font-semibold text-prohealth-800">{{ group.promoterDisplayName }}</span>
        <span class="text-xs font-mono text-prohealth-400">{{ group.promoterCode }}</span>
        <span class="text-xs text-prohealth-400">({{ group.rows.length }})</span>
        <span class="ml-auto font-semibold text-prohealth-900">{{ money(group.periodTotal, group.currencyCode) }}</span>
        <UIcon
          :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="w-4 h-4 text-prohealth-400"
        />
      </button>
    </div>

    <div v-if="expanded" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-4 py-2 w-8"></th>
            <th class="px-4 py-2 font-semibold">{{ t('commissions.approval.columns.appliesTo') }}</th>
            <th class="px-4 py-2 font-semibold text-right">{{ t('commissions.approval.columns.amount') }}</th>
            <th class="px-4 py-2 font-semibold">{{ t('commissions.approval.columns.earnedAt') }}</th>
            <th class="px-4 py-2 font-semibold">{{ t('commissions.approval.columns.status') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <tr v-for="row in group.rows" :key="row.uuid">
            <td class="px-4 py-2">
              <UCheckbox
                :model-value="isChecked(row.uuid, row)"
                :disabled="row.locked"
                @update:model-value="(v: boolean | 'indeterminate') => emit('toggle-row', row.uuid, v === true)"
              />
            </td>
            <td class="px-4 py-2 text-prohealth-700">{{ row.appliesTo_Display || row.appliesTo }}</td>
            <td class="px-4 py-2 text-right font-medium text-prohealth-900">{{ money(row.amount, row.currencyCode) }}</td>
            <td class="px-4 py-2 text-prohealth-500 text-xs">{{ formatDate(row.earnedAt, 'datetime') }}</td>
            <td class="px-4 py-2">
              <UBadge :color="commissionStatusColor(row.status)" variant="subtle" size="sm">
                {{ row.status_Display || row.status }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
