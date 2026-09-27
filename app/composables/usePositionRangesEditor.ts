import type { CompetitiveRewardType, CompetitiveRulePositionRequest } from '~/types/competitiveCommissions'

/** One editable position-range row — mirrors {@link CompetitiveRulePositionRequest} as strings, form-friendly. */
export interface EditablePositionRange {
  from: string
  to: string
  label: string
  rewardType: CompetitiveRewardType
  flatAmount: string
  rewardPct: string
  currencyUuid: string
  min: string
  max: string
  minThreshold: string
}

/** Quick-start templates for the position ranges (structure only — reward amounts/currency are always left for the user to fill in). */
export interface PositionRangePreset {
  key: string
  labelKey: string
  ranges: { from: number, to: number }[]
}

export const POSITION_RANGE_PRESETS: PositionRangePreset[] = [
  { key: 'single-winner', labelKey: 'commissionRules.competitiveRules.form.presets.singleWinner', ranges: [{ from: 1, to: 1 }] },
  { key: 'top-3', labelKey: 'commissionRules.competitiveRules.form.presets.top3', ranges: [{ from: 1, to: 1 }, { from: 2, to: 2 }, { from: 3, to: 3 }] },
  { key: 'winner-plus-runners-up', labelKey: 'commissionRules.competitiveRules.form.presets.winnerPlusRunnersUp', ranges: [{ from: 1, to: 1 }, { from: 2, to: 5 }] },
  { key: 'top-10-tiered', labelKey: 'commissionRules.competitiveRules.form.presets.top10Tiered', ranges: [{ from: 1, to: 1 }, { from: 2, to: 3 }, { from: 4, to: 10 }] },
]

function emptyRange(): EditablePositionRange {
  return {
    from: '',
    to: '',
    label: '',
    rewardType: 'FLAT',
    flatAmount: '',
    rewardPct: '',
    currencyUuid: '',
    min: '',
    max: '',
    minThreshold: '',
  }
}

/**
 * Shared state for the competitive rule's position-ranges editor (D2/D3, hub
 * plan competitive-commission-rules) — mirrors {@link usePaymentLinesEditor}'s
 * add/remove-row shape. Each row is one prize range (e.g. "1st: $100 flat" or
 * "2nd-5th: 5%, min $10 max $50"); "top N", "escalonado" and "siguientes N" are
 * just different range configurations, not separate rule types (D2).
 */
export function usePositionRangesEditor() {
  const ranges = ref<EditablePositionRange[]>([])

  function addRange() {
    ranges.value.push(emptyRange())
  }

  function removeRange(index: number) {
    ranges.value.splice(index, 1)
  }

  function reset(initial: EditablePositionRange[] = []) {
    ranges.value = initial
  }

  /** Replaces all rows with a preset's position structure — rewards/currency are left empty for the user to fill in. */
  function applyPreset(preset: PositionRangePreset) {
    ranges.value = preset.ranges.map(r => ({ ...emptyRange(), from: String(r.from), to: String(r.to) }))
  }

  /** Highest `to` across all rows — the live "maxWinners" indicator (D3). */
  const maxWinners = computed(() => ranges.value.reduce((max, r) => Math.max(max, Number(r.to) || 0), 0))

  /** Rows sorted by `from`, paired with whether they overlap the row before them. */
  const overlaps = computed(() => {
    const sorted = [...ranges.value]
      .map((r, index) => ({ ...r, index }))
      .filter(r => r.from.trim() && r.to.trim())
      .sort((a, b) => Number(a.from) - Number(b.from))
    const overlapping = new Set<number>()
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!
      const cur = sorted[i]!
      if (Number(cur.from) <= Number(prev.to)) {
        overlapping.add(prev.index)
        overlapping.add(cur.index)
      }
    }
    return overlapping
  })

  const hasOverlaps = computed(() => overlaps.value.size > 0)

  /** @param countMetric whether the rule's own metric is count-based (D12: min threshold currency/type follows the metric). */
  function toRequests(countMetric: boolean): CompetitiveRulePositionRequest[] {
    return ranges.value
      .filter(r => r.from.trim() && r.to.trim() && r.currencyUuid)
      .map(r => ({
        positionFrom: Number(r.from),
        positionTo: Number(r.to),
        label: r.label.trim() || undefined,
        rewardType: r.rewardType,
        flatAmount: r.rewardType === 'FLAT' ? r.flatAmount.trim() : undefined,
        rewardPct: r.rewardType === 'PERCENTAGE' ? r.rewardPct.trim() : undefined,
        rewardCurrencyUuid: r.currencyUuid,
        rewardMinAmount: r.rewardType === 'PERCENTAGE' && r.min.trim() ? r.min.trim() : undefined,
        rewardMaxAmount: r.rewardType === 'PERCENTAGE' && r.max.trim() ? r.max.trim() : undefined,
        minThresholdCount: countMetric && r.minThreshold.trim() ? Number(r.minThreshold) : undefined,
        minThresholdAmount: !countMetric && r.minThreshold.trim() ? r.minThreshold.trim() : undefined,
      }))
  }

  return { ranges, addRange, removeRange, reset, applyPreset, maxWinners, overlaps, hasOverlaps, toRequests }
}
