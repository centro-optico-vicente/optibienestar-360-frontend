/**
 * Human label of a role. Seeded roles are translated via `roles.names.<name>`
 * (keyed by the backend value, e.g. `roles.names.ASESOR`); custom roles created
 * by an admin have no key and fall back to the given text (their description,
 * or the raw name).
 */
export const useRoleLabel = () => {
  const { t, te } = useI18n()

  return (name: string | null | undefined, fallback?: string | null): string => {
    if (!name) return fallback ?? ''
    const key = `roles.names.${name}`
    return te(key) ? t(key) : (fallback || name)
  }
}
