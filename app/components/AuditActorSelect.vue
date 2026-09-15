<script setup lang="ts">
/**
 * Searchable actor/user picker bound to `actorUuid` for the data-changes and
 * reports audit pages. Thin wrapper over CommonEntityReferenceSelect using
 * `useUsers().options({ q })` as the server-side search source.
 */
const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const { t } = useI18n()
const users = useUsers()

async function searchUsers(q: string) {
  const res = await users.options({ q, limit: 10 })
  return res.map(o => ({ label: o.label, value: o.uuid }))
}

const value = computed({
  get: () => props.modelValue,
  set: (v: string | undefined) => emit('update:modelValue', v),
})
</script>

<template>
  <CommonEntityReferenceSelect
    v-model="value"
    :search="searchUsers"
    entity="user"
    icon="i-lucide-user-search"
    :placeholder="t('security.dataChanges.filters.actorPlaceholder')"
    class="w-64"
    @navigate="(to: string) => navigateTo(to)"
  />
</template>
