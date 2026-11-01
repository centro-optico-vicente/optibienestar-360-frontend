// Human description of a term rule (hub ADR 0034), shared by the plan detail and the membership views.
// The rule is the same shape on a plan and on a membership snapshot.

export interface TermRuleLike {
  termMode?: string | null
  termFixedMonth?: number | null
  termFixedDay?: number | null
  termPeriodMonths?: number | null
}

type Translate = (key: string, params?: Record<string, unknown>) => string

/** "Annual expiry: 1 December" / "12 months after enrollment"; null when there is no rule. */
export function describeTermRule(rule: TermRuleLike, t: Translate, locale: string): string | null {
  if (rule.termMode === 'FIXED_DATE' && rule.termFixedMonth && rule.termFixedDay) {
    const month = new Date(2000, rule.termFixedMonth - 1, 1).toLocaleString(locale, { month: 'long' })
    return t('plans.term.fixedDateLabel', { day: rule.termFixedDay, month })
  }
  if (rule.termMode === 'PERIOD' && rule.termPeriodMonths) {
    return t('plans.term.periodLabel', { n: rule.termPeriodMonths })
  }
  return null
}
