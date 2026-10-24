<script setup lang="ts">
import type { TermType } from '~/types/terms'

// Shown by the dashboard layout instead of a page whose contract (ASESOR /
// ALIADO) the user postponed — the backend answers 403 `terms.pending` there
// anyway. "Aceptar ahora" reopens TermsAcceptanceModal on that contract.
const props = defineProps<{ termType: TermType }>()

const { t } = useI18n()
const { pending, openNow } = usePendingTerms()

const contractTitle = computed(() => pending.value.find(term => term.termType === props.termType)?.title ?? null)
</script>

<template>
  <div class="max-w-xl mx-auto mt-10 rounded-xl border border-prohealth-100 bg-white p-8 text-center space-y-4">
    <span class="mx-auto w-12 h-12 rounded-full bg-prohealth-50 grid place-items-center">
      <UIcon name="i-lucide-lock" class="w-6 h-6 text-prohealth-600" />
    </span>
    <h2 class="text-lg font-extrabold text-prohealth-900">{{ t('termsAcceptance.blocked.title') }}</h2>
    <p class="text-sm text-prohealth-700">
      {{ contractTitle
        ? t('termsAcceptance.blocked.body', { contract: contractTitle })
        : t('termsAcceptance.blocked.bodyGeneric') }}
    </p>
    <UButton color="primary" icon="i-lucide-file-check-2" @click="openNow(termType)">
      {{ t('termsAcceptance.blocked.acceptNow') }}
    </UButton>
  </div>
</template>
