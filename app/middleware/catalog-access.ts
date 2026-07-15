import { CATALOGS, getCatalogDef } from '~/utils/catalog-registry'

// Blocks the catalog admin screens by the catalog's own write key (V33), which
// `definePageMeta` cannot express: the page is dynamic (`[resource].vue`), so the
// required permission depends on the route param and is resolved from the registry.
//
// On the mosaic (no `resource` param) it lets through anyone holding at least one
// catalog key — the mosaic itself lists only the catalogs the user can manage.
//
// UX layer only: the backend is the real wall (403).
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()

  const resource = to.params.resource
  if (!resource) {
    const hasAnyCatalog = CATALOGS.some(c => auth.permissions.includes(c.permission))
    return hasAnyCatalog ? undefined : navigateTo('/403')
  }

  const def = getCatalogDef(String(resource))
  // Unknown segment: let the page render its own "catalog not found" state.
  if (!def) return

  if (!auth.permissions.includes(def.permission)) {
    return navigateTo('/403')
  }
})
