// State + query mapping for <AllyMasterFilters>, shared by the allies list and the
// ally-requests inbox (both list `Ally` rows on the backend).
export interface AllyMasterFilterState {
  allyTypeUuid: string
  professionUuid: string
  stateUuid: string
}

export const emptyAllyMasterFilters = (): AllyMasterFilterState => ({
  allyTypeUuid: '',
  professionUuid: '',
  stateUuid: '',
})

/** Dedicated query params the backend lists accept (blank ones are omitted). */
export function allyFilterQuery(f: AllyMasterFilterState) {
  return {
    allyTypeUuid: f.allyTypeUuid || undefined,
    professionUuid: f.professionUuid || undefined,
    stateUuid: f.stateUuid || undefined,
  }
}
