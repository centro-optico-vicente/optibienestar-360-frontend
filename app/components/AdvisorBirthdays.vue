<script setup lang="ts">
// Birthdays of the advisor's portfolio (GET /v1/me/birthdays → `portfolio`):
// holders and their beneficiaries with a birthday today or in the next days,
// each with a one-click WhatsApp congratulation. Hidden when nobody is due.
import type { PortfolioBirthday } from '~/composables/useBirthdays'
import { whatsappUrl } from '~/utils/whatsapp'

const { t, te } = useI18n()
const { formatDate } = useFormatters()
const birthdays = useBirthdays()

const items = ref<PortfolioBirthday[]>([])
const upcomingDays = ref(7)

onMounted(async () => {
  const res = await birthdays.fetchMine().catch(() => null)
  items.value = res?.portfolio ?? []
  upcomingDays.value = res?.upcomingDays ?? 7
})

const todayItems = computed(() => items.value.filter(b => b.daysUntil === 0))
const upcomingItems = computed(() => items.value.filter(b => b.daysUntil > 0))

function whenLabel(b: PortfolioBirthday): string {
  if (b.daysUntil === 0) return t('birthdays.advisor.today')
  if (b.daysUntil === 1) return t('birthdays.advisor.tomorrow')
  return t('birthdays.advisor.inDays', { days: b.daysUntil, date: formatDate(b.nextBirthday, 'short') })
}

function relationshipLabel(b: PortfolioBirthday): string {
  if (b.kind === 'MEMBER') return t('birthdays.advisor.holder')
  const key = `members.relationships.${b.relationship}`
  const rel = b.relationship && te(key) ? t(key) : t('birthdays.advisor.beneficiary')
  return b.holderName ? t('birthdays.advisor.beneficiaryOf', { relationship: rel, holder: b.holderName }) : rel
}

function congratulateUrl(b: PortfolioBirthday): string {
  const name = b.fullName.split(' ')[0] ?? b.fullName
  return whatsappUrl(t('birthdays.advisor.whatsappMessage', { name }), b.phone)
}
</script>

<template>
  <section
    v-if="items.length"
    class="bg-white rounded-2xl border border-lime-200 p-5 space-y-4"
    aria-labelledby="advisor-birthdays-title"
  >
    <div class="flex items-center gap-3">
      <span class="w-10 h-10 rounded-xl grid place-items-center bg-lime-50 text-lime-700 shrink-0">
        <UIcon name="i-lucide-cake" class="w-5 h-5" />
      </span>
      <div class="min-w-0">
        <h2 id="advisor-birthdays-title" class="font-bold text-prohealth-900">{{ t('birthdays.advisor.title') }}</h2>
        <p class="text-xs text-prohealth-500">
          {{ todayItems.length
            ? t('birthdays.advisor.todayCount', { count: todayItems.length }, todayItems.length)
            : t('birthdays.advisor.noneToday') }}
          · {{ t('birthdays.advisor.window', { days: upcomingDays }) }}
        </p>
      </div>
    </div>

    <ul class="divide-y divide-prohealth-100">
      <li
        v-for="b in [...todayItems, ...upcomingItems]"
        :key="`${b.memberUuid}-${b.kind}-${b.fullName}`"
        class="py-3 flex flex-wrap items-center gap-3"
      >
        <span class="text-2xl shrink-0" aria-hidden="true">{{ b.daysUntil === 0 ? '🎂' : '🎁' }}</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-prohealth-900 truncate">{{ b.fullName }}</p>
          <p class="text-xs text-prohealth-500 truncate">
            {{ relationshipLabel(b) }} · {{ t('birthdays.advisor.turns', { age: b.turningAge }) }}
          </p>
        </div>
        <UBadge :color="b.daysUntil === 0 ? 'success' : 'neutral'" variant="subtle" size="sm">
          {{ whenLabel(b) }}
        </UBadge>
        <UButton
          :href="congratulateUrl(b)"
          target="_blank"
          rel="noopener"
          color="success"
          variant="soft"
          size="xs"
          icon="i-lucide-message-circle"
        >
          {{ t('birthdays.advisor.congratulate') }}
        </UButton>
      </li>
    </ul>
  </section>
</template>
