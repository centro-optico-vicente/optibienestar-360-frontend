/**
 * Birthday notices of the portals (GET /v1/me/birthdays). The backend resolves
 * what applies from the JWT: `self` for an affiliate / beneficiary with access
 * (MEMBER_VIEW_OWN) and `portfolio` for an advisor (PROMOTER_VIEW_OWN).
 * Null fields are omitted from the JSON, hence the optional properties.
 */

export interface SelfBirthday {
  firstName: string
  birthdayToday: boolean
  age: number
  /** ISO `yyyy-MM-dd`. */
  nextBirthday: string
}

export type BirthdayPersonKind = 'MEMBER' | 'BENEFICIARY'

export interface PortfolioBirthday {
  memberUuid: string
  kind: BirthdayPersonKind
  fullName: string
  /** Only for beneficiaries. */
  holderName?: string
  /** Beneficiary relationship code (SPOUSE, CHILD…); only for beneficiaries. */
  relationship?: string
  phone?: string
  birthDate: string
  nextBirthday: string
  /** 0 = today. */
  daysUntil: number
  turningAge: number
}

export interface MyBirthdaysDto {
  today: string
  upcomingDays: number
  self?: SelfBirthday
  portfolio: PortfolioBirthday[]
}

export const useBirthdays = () => {
  const fetchMine = () => useApi<MyBirthdaysDto>('/v1/me/birthdays', { silent: true })
  return { fetchMine }
}
