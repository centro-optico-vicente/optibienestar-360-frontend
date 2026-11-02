<script setup lang="ts">
import type { BeneficiaryDto } from '~/types/members'
import type { UsagePersonSummaryDto } from '~/types/benefits'

// One family member of the member portal, styled as a smaller sibling of the
// holder's Digital Credential: each beneficiary is a covered person and, with
// V195 access, a user of their own. Shows how many services they have used
// (the counter opens "Mis consumos" filtered to them) and lets the holder
// give, resend or remove their portal access.
const props = defineProps<{
  beneficiary: BeneficiaryDto
  usage?: UsagePersonSummaryDto | null
  canGrant?: boolean
  canRevoke?: boolean
}>()
const emit = defineEmits<{ grant: [BeneficiaryDto], revoke: [BeneficiaryDto] }>()

const { t } = useI18n()
const { formatDate } = useFormatters()

const name = computed(() => {
  const b = props.beneficiary
  return b.fullName || [b.firstName, b.middleName, b.lastName, b.secondLastName].filter(Boolean).join(' ')
})
const initials = computed(() => name.value.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join(''))
const usageCount = computed(() => props.usage?.usageCount ?? 0)
const relationship = computed(() => t(`members.relationships.${props.beneficiary.relationship}`, props.beneficiary.relationship))

const accessItems = computed(() => {
  const items = []
  if (props.canGrant) {
    items.push({
      label: t('members.portal.beneficiaries.access.resend'),
      icon: 'i-lucide-mail',
      onSelect: () => emit('grant', props.beneficiary),
    })
  }
  if (props.canRevoke) {
    items.push({
      label: t('members.portal.beneficiaries.access.revoke'),
      icon: 'i-lucide-user-x',
      color: 'error' as const,
      onSelect: () => emit('revoke', props.beneficiary),
    })
  }
  return items
})
</script>

<template>
  <div class="relative rounded-3xl bg-gradient-to-br from-prohealth-700 via-prohealth-600 to-cyan-600 text-white p-5 overflow-hidden shadow-md">
    <div class="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-cyan-300/30 blur-3xl pointer-events-none" />

    <div class="relative">
      <!-- Relationship + portal access -->
      <div class="flex items-center justify-between gap-2">
        <span class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
          {{ relationship }}
        </span>

        <UDropdownMenu v-if="beneficiary.hasAccess && accessItems.length" :items="accessItems">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full bg-lime-400 px-2.5 py-0.5 text-xs font-semibold text-prohealth-900 hover:bg-lime-300 transition"
          >
            <UIcon name="i-lucide-user-check" class="w-3.5 h-3.5" />
            {{ t('members.portal.beneficiaries.withAccess') }}
            <UIcon name="i-lucide-chevron-down" class="w-3.5 h-3.5" />
          </button>
        </UDropdownMenu>
        <span
          v-else-if="beneficiary.hasAccess"
          class="inline-flex items-center gap-1 rounded-full bg-lime-400 px-2.5 py-0.5 text-xs font-semibold text-prohealth-900"
        >
          <UIcon name="i-lucide-user-check" class="w-3.5 h-3.5" />
          {{ t('members.portal.beneficiaries.withAccess') }}
        </span>
        <button
          v-else-if="canGrant"
          type="button"
          class="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-prohealth-700 hover:bg-prohealth-50 transition"
          @click="emit('grant', beneficiary)"
        >
          <UIcon name="i-lucide-user-plus" class="w-3.5 h-3.5" />
          {{ t('members.portal.beneficiaries.access.grant') }}
        </button>
        <span
          v-else
          class="inline-flex items-center gap-1 rounded-full border border-white/40 px-2.5 py-0.5 text-xs font-semibold text-white/80"
        >
          <UIcon name="i-lucide-user-x" class="w-3.5 h-3.5" />
          {{ t('members.portal.beneficiaries.withoutAccess') }}
        </span>
      </div>

      <!-- Person -->
      <div class="mt-4 flex items-center gap-3">
        <span class="w-12 h-12 rounded-2xl bg-white/15 border-2 border-white/40 grid place-items-center font-bold shrink-0">
          {{ initials }}
        </span>
        <div class="min-w-0">
          <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">{{ t('members.portal.beneficiaries.cardLabel') }}</p>
          <p class="text-lg font-bold leading-tight truncate">{{ name }}</p>
          <p class="text-xs text-prohealth-100/80 mt-0.5">
            <template v-if="beneficiary.documentNumber">{{ beneficiary.documentType }}-{{ beneficiary.documentNumber }}</template>
            <template v-if="beneficiary.birthDate"> · {{ t('members.portal.beneficiaries.born', { date: formatDate(beneficiary.birthDate, 'short') }) }}</template>
          </p>
        </div>
      </div>

      <!-- Usage indicator -->
      <NuxtLink
        :to="{ path: '/members/usage', query: { who: beneficiary.uuid } }"
        class="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/10 hover:bg-white/15 transition px-4 py-3"
      >
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold leading-none">{{ usageCount }}</span>
          <span class="text-sm text-prohealth-100/90">{{ t('members.portal.beneficiaries.servicesUsed', usageCount) }}</span>
        </div>
        <div class="text-right text-xs text-prohealth-100/80">
          <template v-if="usage?.lastUsageDate">
            {{ t('members.portal.beneficiaries.lastUsage', { date: usage.lastUsageDate_Display || formatDate(usage.lastUsageDate, 'short') }) }}
          </template>
          <template v-else>{{ t('members.portal.beneficiaries.noUsage') }}</template>
          <UIcon name="i-lucide-chevron-right" class="w-4 h-4 inline-block align-middle ml-1" />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
