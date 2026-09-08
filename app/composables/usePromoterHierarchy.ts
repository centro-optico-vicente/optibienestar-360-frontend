import type { Option } from '~/types/options'
import type {
  AssignSupervisorRequest,
  ChangeRankRequest,
  PromoterDto,
  PromoterHierarchyNodeDto,
  PromoterSupervisorAssignmentDto,
} from '~/types/promoters'

/**
 * Acceso a la jerarquía de promotores (/v1/admin/promoters/*, V101/V104,
 * hub plan hierarchical-commissions). Separado de `usePromoters` igual que
 * el backend separa `AdminPromoterHierarchyController` de
 * `AdminPromoterController` — permiso distinto por acción:
 * - hierarchyTree/supervisorHistory → PROMOTER_VIEW_ALL / PROMOTER_ASSIGN_SUPERVISOR
 * - assignSupervisor → PROMOTER_ASSIGN_SUPERVISOR
 * - eligibleSupervisors/changeRank → PROMOTER_CHANGE_RANK
 */
export const usePromoterHierarchy = () => {
  /** Árbol completo del organigrama — raíces = promotores sin supervisor. */
  const hierarchyTree = () =>
    useApi<PromoterHierarchyNodeDto[]>('/v1/admin/promoters/hierarchy-tree')

  /** (Re)asigna el supervisor de un promotor. `supervisorUuid: null` = desasignar (tope de su propia cadena). */
  const assignSupervisor = (promoterUuid: string, body: AssignSupervisorRequest) =>
    useApi<PromoterSupervisorAssignmentDto>(`/v1/admin/promoters/${promoterUuid}/assign-supervisor`, { method: 'POST', body })

  /** Historial de reasignaciones de supervisor de un promotor, más reciente primero. */
  const supervisorHistory = (promoterUuid: string) =>
    useApi<PromoterSupervisorAssignmentDto[]>(`/v1/admin/promoters/${promoterUuid}/supervisor-history`)

  /**
   * Candidatos a supervisor para un promotor que apunta a `rankUuid`. Por
   * defecto (`allSuperiors` ausente/false) solo el rango inmediato superior;
   * `allSuperiors: true` amplía a todos los rangos superiores. Vacío cuando
   * `rankUuid` es el rango más alto, o cuando nadie califica todavía.
   */
  const eligibleSupervisors = (rankUuid: string, params: { allSuperiors?: boolean, q?: string, limit?: number } = {}) =>
    useApi<Option[]>('/v1/admin/promoters/eligible-supervisors', {
      query: {
        rankUuid,
        ...(params.allSuperiors ? { allSuperiors: 'true' } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
      },
    })

  /** Asciende o degrada a `promoterUuid`, reasignando su supervisor en la misma acción. */
  const changeRank = (promoterUuid: string, body: ChangeRankRequest) =>
    useApi<PromoterDto>(`/v1/admin/promoters/${promoterUuid}/change-rank`, { method: 'POST', body })

  /**
   * Opciones del catálogo de rangos (`/v1/admin/promoter-ranks/options`) para
   * el paso "elegir el rango nuevo" del flujo de cambio de rango.
   * `excludeUuid` filtra el rango actual del promotor (cambiar al mismo rango
   * no es un cambio) — no soportado por `useCatalogOptions` genérico, que
   * además apunta a `/v1/admin/catalogs/*`, una ruta distinta a esta.
   */
  const rankOptions = (params: { q?: string, limit?: number, excludeUuid?: string } = {}) =>
    useApi<Option[]>('/v1/admin/promoter-ranks/options', {
      query: {
        ...(params.q ? { q: params.q } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
        ...(params.excludeUuid ? { excludeUuid: params.excludeUuid } : {}),
      },
    })

  return { hierarchyTree, assignSupervisor, supervisorHistory, eligibleSupervisors, changeRank, rankOptions }
}
