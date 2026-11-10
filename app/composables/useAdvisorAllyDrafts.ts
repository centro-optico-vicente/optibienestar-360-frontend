import type { Page } from '~/types/admin'
import type { DraftRetentionDto } from '~/types/affiliationRequests'
import type { AllyRequestCreatedDto, AllyRequestListItemDto, AssistedAllyDraftStartRequest } from '~/types/allyRequests'

/**
 * Advisor portal: ally capture saved as a draft step by step (hub ADR 0037 §5, backend V236), under
 * `/v1/me/advisor/ally-requests/drafts`. The advisor only sees and edits their own drafts (another's is a 404).
 * `POST /drafts` starts it (ALLY_CREATE_ASSISTED), `GET /drafts` lists them (ALLY_DRAFT_VIEW_ASSISTED),
 * `POST /drafts/{uuid}/submit` creates the contact's login and sends it to review (ALLY_DRAFT_SUBMIT_ASSISTED)
 * and `DELETE /drafts/{uuid}` discards it (ALLY_DRAFT_DISCARD_ASSISTED). The steps themselves are the ally profile
 * endpoints (`/v1/me/allies/{uuid}/profile`, `/licenses`, `/opening-hours`), open to the capturing advisor while
 * the draft is not submitted (ALLY_DRAFT_VIEW_ASSISTED / ALLY_DRAFT_UPDATE_ASSISTED).
 */
export const useAdvisorAllyDrafts = () => {
  const BASE = '/v1/me/advisor/ally-requests/drafts'

  const list = (params: { page?: number, size?: number } = {}) =>
    useApi<Page<AllyRequestListItemDto>>(BASE, {
      query: { page: params.page ?? 0, size: params.size ?? 20 },
    })

  const start = (body: AssistedAllyDraftStartRequest) =>
    useApi<AllyRequestCreatedDto>(BASE, { method: 'POST', body })

  const submitUrl = (uuid: string) => `${BASE}/${uuid}/submit`

  const discard = (uuid: string) => useApi<void>(`${BASE}/${uuid}`, { method: 'DELETE' })

  /**
   * Registrations in progress the advisor may keep (ALLY_DRAFT_RETAIN_ADVISOR): the ones they captured and the
   * self-registered ones no advisor brought in.
   */
  const inProgress = (params: { page?: number, size?: number } = {}) =>
    useApi<Page<AllyRequestListItemDto>>('/v1/me/advisor/ally-requests/in-progress', {
      query: { page: params.page ?? 0, size: params.size ?? 50 },
    })

  /** Keeps a registration in the advisor's scope out of the abandoned-draft cleanup, or releases it (optional note, max 200). */
  const retain = (uuid: string, retainIt: boolean, note?: string) =>
    useApi<DraftRetentionDto>(`${BASE}/${uuid}/retain`, {
      method: 'PUT',
      body: { retain: retainIt, note: note?.trim() || undefined },
    })

  return { list, start, submitUrl, discard, inProgress, retain }
}
