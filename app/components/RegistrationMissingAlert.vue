<script setup lang="ts">
import { missingItems, type RegistrationKind } from '~/utils/registrationMissing'

// What the person still has to fill before the registration can be sent (hub ADR 0037): the `missing` keys of the
// 422 on submit, each with a human label and a button that jumps to the wizard step that holds it.
const props = defineProps<{ kind: RegistrationKind, missing: string[] }>()
const emit = defineEmits<{ goto: [step: string] }>()

const { t } = useI18n()
const items = computed(() => missingItems(props.kind, props.missing))

// An unknown key (newer backend) shows as the raw key rather than breaking the list.
const labelOf = (key: string): string => t(`registration.missing.items.${key}`, key)
</script>

<template>
  <UAlert color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('registration.missing.title')">
    <template #description>
      <p class="text-sm">{{ t('registration.missing.hint') }}</p>
      <ul class="mt-2 space-y-1">
        <li v-for="item in items" :key="item.key" class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-medium">{{ labelOf(item.key) }}</span>
          <UButton v-if="item.step" type="button" size="xs" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right" @click="emit('goto', item.step)">
            {{ t('registration.missing.goTo', { step: t(`registration.steps.${item.step}`) }) }}
          </UButton>
        </li>
      </ul>
    </template>
  </UAlert>
</template>
