import type { MediaAddUrlRequest, MediaItemDto, MediaUpdateRequest } from '~/types/media'

/**
 * Generic image gallery client (hub ADR 0027). The same six actions exist for
 * every owner; only the `base` route changes:
 * - ally (admin)      `/v1/admin/allies/{allyUuid}/media`
 * - product (admin)   `/v1/admin/products/{productUuid}/media`
 * - offer (admin)     `/v1/admin/allies/{allyUuid}/products/{offerUuid}/media`
 * - ally (portal)     `/v1/me/allies/{allyUuid}/media`
 * - offer (portal)    `/v1/me/allies/products/{offerUuid}/media`
 * Permissions per owner are enforced by the backend (`*_IMAGE_UPLOAD` for
 * upload + add URL, `*_IMAGE_UPDATE` for caption/primary/order, `*_IMAGE_DELETE`).
 */
export const useMedia = () => {
  const list = (base: string) =>
    useApi<MediaItemDto[]>(base)

  const upload = (base: string, file: File, caption?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (caption) form.append('caption', caption)
    return useApi<MediaItemDto>(base, { method: 'POST', body: form, silent: true })
  }

  const addUrl = (base: string, body: MediaAddUrlRequest) =>
    useApi<MediaItemDto>(`${base}/url`, { method: 'POST', body, silent: true })

  const update = (base: string, mediaUuid: string, body: MediaUpdateRequest) =>
    useApi<MediaItemDto>(`${base}/${mediaUuid}`, { method: 'PATCH', body, silent: true })

  /** `uuids` is the FULL list in the new order. */
  const reorder = (base: string, uuids: string[]) =>
    useApi<MediaItemDto[]>(`${base}/order`, { method: 'PUT', body: { uuids }, silent: true })

  const remove = (base: string, mediaUuid: string) =>
    useApi<null>(`${base}/${mediaUuid}`, { method: 'DELETE', silent: true })

  return { list, upload, addUrl, update, reorder, remove }
}
