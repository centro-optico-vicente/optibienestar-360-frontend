<script setup lang="ts">
/**
 * Searchable actor/user picker bound to `actorUuid` for the data-changes and
 * reports audit pages. Same server-side debounced search pattern as
 * `PromoterFormModal`'s user picker (`useUsers().options({ q })`), reused here
 * instead of building a second one.
 */
const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const { t } = useI18n()
const users = useUsers()
const { can } = usePermissions()
const canViewUser = computed(() => can('USER_VIEW_ALL'))

const searchTerm = ref('')
const options = ref<{ label: string, value: string }[]>([])
const searching = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchTerm, (q) => {
  clearTimeout(searchTimer)
  const term = q.trim()
  if (term.length < 2) return
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const res = await users.options({ q: term, limit: 10 })
      options.value = res.map(o => ({ label: o.label, value: o.uuid }))
    }
    catch {
      options.value = []
    }
    finally {
      searching.value = false
    }
  }, 400)
})

const value = computed({
  get: () => props.modelValue,
  set: (v: string | undefined) => emit('update:modelValue', v),
})
</script>

<template>
  <div class="flex items-center gap-2">
    <USelectMenu
      v-model="value"
      v-model:search-term="searchTerm"
      :items="options"
      label-key="label"
      value-key="value"
      ignore-filter
      clear
      icon="i-lucide-user-search"
      :loading="searching"
      :placeholder="t('security.dataChanges.filters.actorPlaceholder')"
      :search-input="{ placeholder: t('security.dataChanges.filters.actorPlaceholder'), icon: 'i-lucide-search' }"
      class="w-64"
    />
    <CommonEntityQuickLinkButton
      :to="value ? `/dashboard/users/${value}` : null"
      :can="canViewUser"
      @navigate="(to: string) => navigateTo(to)"
    />
  </div>
</template>
