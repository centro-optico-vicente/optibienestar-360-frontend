import cronstrue from 'cronstrue'
import 'cronstrue/locales/es'

/**
 * Traduce una expresión cron de Spring (seg min hora día-mes mes día-semana)
 * a una descripción legible, para el tooltip/popover junto al campo de
 * "Expresión cron" en la ficha y en el modal de edición de trabajos
 * programados. cronstrue detecta automáticamente el campo de segundos
 * cuando la expresión trae 6 partes, igual que el formato de Spring.
 *
 * Devuelve `null` si la expresión está vacía o no se puede parsear (ej.
 * mientras el usuario todavía la está escribiendo en el modal) — el llamador
 * decide qué mostrar en ese caso.
 */
export function describeCron(expression: string, locale: 'es' | 'en' = 'es'): string | null {
  const trimmed = expression?.trim()
  if (!trimmed) return null
  try {
    return cronstrue.toString(trimmed, {
      locale,
      use24HourTimeFormat: true,
      throwExceptionOnParseError: true,
    })
  }
  catch {
    return null
  }
}
