import { CATALOGS, getCatalogDef } from '~/utils/catalog-registry'

// Blocks the catalog admin screens by the catalog's own view key (V78), which
// `definePageMeta` cannot express: the page is dynamic (`[resource].vue`), so the
// required permission depends on the route param and is resolved from the registry.
// Gating on `viewPermission` (not create/update/delete) lets a read-only role in —
// the page itself hides the create/edit/delete buttons per action permission.
//
// On the mosaic (no `resource` param) it lets through anyone holding at least one
// catalog's view key — the mosaic itself lists only the catalogs the user can see.
//
// UX layer only: the backend is the real wall (403).
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()

  const resource = to.params.resource
  if (!resource) {
    const hasAnyCatalog = CATALOGS.some(c => auth.permissions.includes(c.viewPermission))
    return hasAnyCatalog ? undefined : navigateTo('/403')
  }

  const def = getCatalogDef(String(resource))
  // Unknown segment: let the page render its own "catalog not found" state.
  if (!def) return

  if (!auth.permissions.includes(def.viewPermission)) {
    return navigateTo('/403')
  }
})
