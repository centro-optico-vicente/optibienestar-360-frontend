import type { Page } from '~/types/admin'
import type {
  PromoterCreateRequest,
  PromoterDto,
  PromoterUpdateRequest,
} from '~/types/promoters'

interface ListParams {
  page?: number
  size?: number
  sort?: string
  filter?: string
  q?: string
}

/**
 * Acceso al vertical de Promotores (/v1/admin/promoters).
 * Permisos del backend por acción:
 * - list/get → PROMOTER_VIEW_ALL · create → PROMOTER_CREATE
 * - update → PROMOTER_UPDATE · remove → PROMOTER_DELETE
 *
 * La fila del sistema INSTITUCION aparece en el listado (`system: true`) pero no se
 * puede crear, editar ni eliminar (el backend responde 422).
 */
export const usePromoters = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<PromoterDto>>('/v1/admin/promoters', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        sort: params.sort ?? 'displayName,asc',
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<PromoterDto>(`/v1/admin/promoters/${uuid}`)

  const create = (body: PromoterCreateRequest) =>
    useApi<PromoterDto>('/v1/admin/promoters', { method: 'POST', body })

  const update = (uuid: string, body: PromoterUpdateRequest) =>
    useApi<PromoterDto>(`/v1/admin/promoters/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/promoters/${uuid}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
