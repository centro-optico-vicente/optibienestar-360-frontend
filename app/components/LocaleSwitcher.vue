<script setup lang="ts">
import type { LocaleCode } from '~/composables/useAppLocale'
import { SUPPORTED_LOCALES, useAppLocale } from '~/composables/useAppLocale'

/**
 * Language selector for the header. Shows the active locale as a compact code
 * (ES / EN) and lists the available languages by their own name (autonyms — not
 * translated). When authenticated the choice is persisted to the backend via
 * `useAppLocale.changeLocale`; otherwise it only switches locally and stores the
 * pre-login hint.
 */
const { t } = useI18n()
const { current, changeLocale } = useAppLocale()
const pending = ref(false)

// Autonyms: each language shown in its own name regardless of the active UI locale.
const LOCALE_NAMES: Record<LocaleCode, string> = { es: 'Español', en: 'English' }

async function select(code: LocaleCode): Promise<void> {
  if (pending.value) return
  pending.value = true
  try {
    await changeLocale(code)
  }
  finally {
    pending.value = false
  }
}

const items = computed(() => [
  SUPPORTED_LOCALES.map(code => ({
    label: LOCALE_NAMES[code],
    icon: code === current.value ? 'i-lucide-check' : undefined,
    onSelect: () => select(code),
  })),
])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-languages"
      :label="current.toUpperCase()"
      trailing-icon="i-lucide-chevron-down"
      :loading="pending"
      :aria-label="t('locale.change')"
      :title="t('locale.change')"
    />
  </UDropdownMenu>
</template>
