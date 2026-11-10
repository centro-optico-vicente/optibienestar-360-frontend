import type { Page } from '~/types/admin'
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

  return { list, start, submitUrl, discard }
}
