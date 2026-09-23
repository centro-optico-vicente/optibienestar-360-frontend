// Contrato del backend para selects/dropdowns liviano (ADR 0013 en optibienestar-360-backend):
// GET /v1/admin/{recurso}/options?q=&limit=&currentValues= → List<OptionDto>, sin paginar.

/** Proyección liviana para selects — `code` es `null` cuando la entidad no tiene código propio. */
export interface Option {
  uuid: string
  code: string | null
  label: string
  active: boolean
}

export interface SelectItem {
  label: string
  value: string
}

/**
 * Raw shape of a backend `DisplayRef` (`core.display.DisplayRef`) when it appears
 * INSIDE a list field (e.g. `List<DisplayRef> promoterTypes`) — unlike a top-level
 * `@Display`-annotated FK field (flattened into `<name>_Uuid`/`_Display`, ADR 0014),
 * a list of refs is serialized as-is by Jackson: `{ uuid, code, name }` per element.
 */
export interface DisplayRefItem {
  uuid: string
  code: string | null
  name: string | null
}

/**
 * Adapta `Option[]` al par `{label,value}` que esperan los `USelectMenu` existentes.
 * Los inactivos se marcan en la etiqueta (en vez de ocultarse) para que un `currentValue`
 * ya asignado pero desactivado siga siendo visible en el select.
 */
export function toSelectItems(options: Option[]): SelectItem[] {
  return options.map(o => ({
    label: o.active ? o.label : `${o.label} (inactivo)`,
    value: o.uuid,
  }))
}
