// Generic image galleries (hub ADR 0027): an ordered list of images per owner
// (ally, product, ally offer) with ONE primary image. Each image is either an
// uploaded file (R2) or an external https URL. Uploads are published at once.

export type MediaSource = 'UPLOAD' | 'URL'

/** Max active images per owner; the backend answers 422 `media.limit_reached` beyond it. */
export const MEDIA_MAX_ITEMS = 10

/** Client-side size hint for uploads (the backend enforces the real file policy). */
export const MEDIA_MAX_FILE_MB = 5

/** Accepted upload types (jpg / jpeg / png / webp). */
export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp'

/** One image of an owner's gallery (`GET {base}`, ordered by `sortOrder`). */
export interface MediaItemDto {
  uuid: string
  url: string
  source: MediaSource
  caption?: string | null
  sortOrder: number
  primary: boolean
  fileName?: string | null
  createdAt?: string | null
}

export interface MediaAddUrlRequest {
  url: string
  caption?: string
}

/** PATCH body: only the fields sent change. `primary: true` makes it the primary. */
export interface MediaUpdateRequest {
  caption?: string
  primary?: boolean
}

/** Image of a public detail DTO (`images`), already ordered, primary first-class. */
export interface PublicImageDto {
  url: string
  caption?: string | null
  primary?: boolean
}
