<script setup lang="ts">
import type { SelectItem } from '~/types/options'
import type { EntityReferenceKey } from '~/utils/entity-references'
import { resolveEntityReference } from '~/utils/entity-references'
import { DEFAULT_DEBOUNCE_MS } from '~/utils/debounce-config'

// Standard widget for any FK-to-entity select: filterable (client-side `items` or
// server-side debounced `search`), always clearable, and paired with the quick-link
// button so the operator can jump to the referenced entity's screen. Replaces the
// USelectMenu + CommonEntityQuickLinkButton pair that used to be hand-rolled at each
// call site (PromoterFormModal, MemberFormModal, AllyFormModal, etc.).
//
// Two data modes, mutually exclusive:
// - `items`: static/pre-loaded list (small finite catalogs) — filtering is client-side,
//   the default USelectMenu behavior.
// - `search`: async function `(q) => SelectItem[]` for server-side lookups (users,
//   members...) — debounced via the shared `DEFAULT_DEBOUNCE_MS` config
//   (see `.ai/specs/08-debounce-search-inputs.md`). `q` may be empty — an
//   empty query still fires (debounced) so opening the dropdown with no
//   typing lists the first results instead of requiring a minimum length.
//
// The quick-link route + permission are resolved from `entity` via the central
// registry (`~/utils/entity-references.ts`) so a route change is a one-file edit
// instead of touching every select that references that entity. `to`/`can` remain
// as an escape hatch for a reference not (yet) in that registry.
const props = withDefaults(defineProps<{
  modelValue?: string
  items?: SelectItem[]
  search?: (q: string) => Promise<SelectItem[]>
  /** Minimum characters before `search` fires. Defaults to 0 — no minimum,
   *  so opening the dropdown with an empty query lists the first results. */
  minSearchLength?: number
  debounceMs?: number
  /** Registry key resolving the quick-link's route + permission from the current value. */
  entity?: EntityReferenceKey
  /** Manual override/fallback target route, used when `entity` isn't given. */
  to?: string | null
  /** Manual override/fallback permission check, used when `entity` isn't given. */
  can?: boolean
  icon?: string
  placeholder?: string
  searchPlaceholder?: string
  /** External loading flag, merged with the internal one used during `search`. */
  loading?: boolean
  disabled?: boolean
  class?: string
}>(), {
  modelValue: undefined,
  items: undefined,
  search: undefined,
  minSearchLength: 0,
  debounceMs: DEFAULT_DEBOUNCE_MS,
  entity: undefined,
  to: null,
  can: true,
  icon: undefined,
  placeholder: undefined,
  searchPlaceholder: undefined,
  loading: false,
  disabled: false,
  class: 'w-full',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
  'navigate': [to: string]
}>()

const { can: hasPermission } = usePermissions()

const value = computed({
  get: () => props.modelValue,
  set: (v: string | undefined) => emit('update:modelValue', v),
})

const resolvedLink = computed(() => (props.entity ? resolveEntityReference(props.entity, value.value) : null))
const linkTo = computed(() => (props.entity ? (resolvedLink.value?.to ?? null) : props.to))
const linkCan = computed(() => (props.entity ? (resolvedLink.value ? hasPermission(resolvedLink.value.permission) : true) : props.can))

const isServerSearch = computed(() => typeof props.search === 'function')

const searchTerm = ref('')
const searchResults = ref<SelectItem[]>([])
const searching = ref(false)

const runSearch = useSearchDebounce(async (term: string) => {
  searching.value = true
  try {
    searchResults.value = await props.search!(term)
  }
  catch {
    searchResults.value = []
  }
  finally {
    searching.value = false
  }
}, props.debounceMs)

watch(searchTerm, (q) => {
  if (!isServerSearch.value) return
  const term = q.trim()
  if (term.length < props.minSearchLength) return
  runSearch(term)
}, { immediate: true })

const displayItems = computed(() => (isServerSearch.value ? searchResults.value : (props.items ?? [])))
const isLoading = computed(() => props.loading || searching.value)
</script>

<template>
  <div class="flex items-center gap-2">
    <USelectMenu
      v-model="value"
      v-model:search-term="searchTerm"
      :items="displayItems"
      label-key="label"
      value-key="value"
      :ignore-filter="isServerSearch"
      clear
      :icon="icon"
      :loading="isLoading"
      :disabled="disabled"
      :placeholder="placeholder"
      :search-input="{ placeholder: searchPlaceholder || placeholder, icon: 'i-lucide-search' }"
      :class="props.class"
    />
    <CommonEntityQuickLinkButton :to="linkTo" :can="linkCan" @navigate="(t: string) => emit('navigate', t)" />
  </div>
</template>
