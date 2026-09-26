import type { ComputedRef, Ref } from 'vue'

/**
 * D15 (hub plan competitive-commission-rules, Fase A) — mirrors the backend's
 * `core/util/SettlementAxes`: the retroactive settlement axis only makes
 * sense, and is only enabled, when the partial settlement axis is strictly
 * finer than the accrual axis. This composable gives the 4 rule form modals
 * (`CommissionTierFormModal`, `HierarchyOverrideTierFormModal`,
 * `BonusRuleFormModal`, `CollectionCommissionTierFormModal`) instant client-side
 * feedback — disabling the retroactive select and auto-collapsing it to the
 * partial value — instead of a round-trip 422 when they're saved.
 */
const RANK_ORDER = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'] as const

/** -1 for a non-periodic legacy value (bonus's CAMPAIGN/LIFETIME) or an unset value. */
function rankOf(strategy?: string | null): number {
  if (!strategy) return -1
  return RANK_ORDER.indexOf(strategy as (typeof RANK_ORDER)[number])
}

export interface PeriodOption { label: string, value: string }

/**
 * @param accrual   the rule's accrual strategy ref
 * @param partial   the rule's partial settlement strategy ref
 * @param retroactive the rule's retroactive settlement strategy ref — collapsed
 *                  to `partial`'s value whenever the axis is disabled, so the
 *                  form state always matches what the server will actually persist
 * @param periodOptions the full list of periodic options (`PERIOD_STRATEGY_OPTIONS`/
 *                  `SETTLEMENT_PERIOD_STRATEGY_OPTIONS`), filtered down for the
 *                  retroactive select
 */
export function useSettlementAxes(
  accrual: Ref<string | undefined>,
  partial: Ref<string | undefined>,
  retroactive: Ref<string | undefined>,
  periodOptions: Ref<PeriodOption[]> | ComputedRef<PeriodOption[]>,
) {
  const accrualRank = computed(() => rankOf(accrual.value))
  const partialRank = computed(() => rankOf(partial.value))
  // A non-periodic accrual (bonus's legacy CAMPAIGN/LIFETIME) always counts as
  // "coarser than any periodic partial" — matches SettlementAxes.resolve.
  const accrualIsPeriodic = computed(() => accrualRank.value >= 0)

  const retroactiveEnabled = computed(() => {
    if (partialRank.value < 0) return false
    if (!accrualIsPeriodic.value) return true
    return partialRank.value < accrualRank.value
  })

  /** The periodic options actually legal for retroactive: `[partial..accrual]` (or `[partial..]` when accrual isn't periodic). */
  const retroactiveOptions = computed(() => periodOptions.value.filter((o) => {
    const rank = rankOf(o.value)
    if (rank < 0 || rank < partialRank.value) return false
    return !accrualIsPeriodic.value || rank <= accrualRank.value
  }))

  // Keep the form state in sync with what the server will persist (D15:
  // disabled ⇒ retroactive := partial) so nothing looks selected that will
  // silently change on save.
  watch([retroactiveEnabled, partial], ([enabled, partialValue]) => {
    if (!enabled && partialValue !== undefined) {
      retroactive.value = partialValue
    }
  }, { immediate: true })

  return { retroactiveEnabled, retroactiveOptions }
}
