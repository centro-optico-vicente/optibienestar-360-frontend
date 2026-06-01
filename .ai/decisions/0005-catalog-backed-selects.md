# ADR 0005 (local frontend) — Selects alimentados por catálogo (no hardcodear)

**Estado:** Aceptado
**Fecha:** 2026-06-01

## Decisión

Todo campo de formulario cuyo dominio de valores viva en un **catálogo del backend**
(`/v1/admin/catalogs/*`) debe poblarse **dinámicamente** desde ese catálogo. Queda
**prohibido hardcodear** esas listas en el frontend.

Caso de referencia: **Tipo de documento** → siempre vía el composable `useDocumentTypes()`
(lee `GET /v1/admin/catalogs/document-types`). El valor guardado es el `code` (`V`, `E`, `J`, …),
que es lo que espera el backend.

## Razón

- El backend es la **fuente de verdad** de los catálogos (tipos de documento, géneros,
  estados civiles, especialidades, etc.). Una lista fija en el frontend se **desincroniza**
  en cuanto se agrega/edita/desactiva un valor desde el módulo de Catálogos.
- Evita inconsistencias entre módulos (alta de usuario, afiliado, aliado…) que comparten
  el mismo dominio.
- Coherente con la regla de oro: la lógica/datos de negocio no se replican en frontend.

## Implementación

### Tipo de documento (composable cacheado)

`app/composables/useDocumentTypes.ts`: carga el catálogo, cachea con `useState`
(una sola petición por sesión aunque varios formularios lo usen) y **falla en silencio**
(lista vacía, sin toast) si el usuario no tiene permiso.

```typescript
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()
onMounted(loadDocumentTypes)
```

```vue
<USelectMenu
  v-model="state.documentType"
  :items="documentTypeOptions"
  label-key="label"
  value-key="value"
  placeholder="Selecciona"
  class="w-full"
/>
```

### Otros catálogos

- Select puntual: `useCatalog('/v1/admin/catalogs/<recurso>')` (admin) o
  `usePublicCatalog('<recurso>')` (formularios públicos sin login), mapeando a `{ label, value }`.
- Select recurrente en varias pantallas: encapsular en un composable cacheado con `useState`,
  mismo patrón que `useDocumentTypes`.

## Prohibido

```typescript
// ❌ NUNCA
const DOCUMENT_OPTIONS = ['V', 'E', 'J']
```

## Referencias

- Playbook: [`playbooks/new-form.md`](../playbooks/new-form.md) (sección "Selects alimentados por catálogo")
- Agente: `.claude/agents/nuxt-expert.md` (tabla de reglas)
- Composables: `app/composables/useDocumentTypes.ts`, `useCatalog.ts`, `usePublicCatalog.ts`
