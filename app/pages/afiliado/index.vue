<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { MemberDto } from '~/types/members'
import logoUrl from '~/assets/centro-optico-vicente-logo.png'

// Member portal: digital card + covered beneficiaries.
// GET /v1/me/member requires MEMBER_VIEW_OWN; it returns 404 if the user isn't enrolled.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_VIEW_OWN',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('members.portal.seoTitle') })

const members = useMembers()
const auth = useAuthStore()

const member = ref<MemberDto | null>(null)
const loading = ref(true)
const notAffiliated = ref(false)
const loadError = ref(false)

onMounted(async () => {
  try {
    member.value = await members.me()
  }
  catch (err) {
    if ((err as ApiError).status === 404) notAffiliated.value = true
    else loadError.value = true
  }
  finally {
    loading.value = false
  }
})

const displayName = computed(() => {
  const m = member.value
  if (!m) return auth.fullName
  return m.fullName || [m.firstName, m.middleName, m.lastName, m.secondLastName].filter(Boolean).join(' ')
})

/** Short card code (first 8 characters of the UUID). */
const cardCode = computed(() => member.value?.uuid?.slice(0, 8).toUpperCase() ?? '')

// Beneficiary relationship label; falls back to the raw value.
function relationshipLabel(r?: string | null): string {
  return r ? t(`members.relationships.${r}`, r) : t('common.empty')
}
</script>

<template>
  <div class="space-y-6 max-w-3xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('members.portal.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">
        {{ t('members.portal.subtitle') }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <USkeleton class="h-56 w-full max-w-md rounded-3xl" />
      <USkeleton class="h-4 w-64 rounded" />
    </div>

    <!-- Not affiliated -->
    <div v-else-if="notAffiliated" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-id-card" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('members.portal.notAffiliatedTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">
        {{ t('members.portal.notAffiliatedBody') }}
      </p>
      <UButton to="/#contact" color="primary" variant="soft" size="sm" class="mt-4">
        {{ t('members.portal.joinCta') }}
      </UButton>
    </div>

    <!-- Error -->
    <div v-else-if="loadError || !member" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-circle-alert" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('members.portal.errorTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('members.portal.errorBody') }}</p>
    </div>

    <template v-else>
      <!-- Digital card -->
      <div class="relative max-w-md rounded-3xl bg-hero-prohealth text-white p-6 overflow-hidden shadow-lg">
        <div class="absolute inset-0 opacity-25 pointer-events-none">
          <div class="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-cyan-400/50 blur-3xl" />
          <div class="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-lime-400/30 blur-3xl" />
        </div>

        <div class="relative">
          <!-- Brand + status -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img :src="logoUrl" alt="OptiBienestar 360" class="w-8 h-8 rounded-full object-contain bg-white/90">
              <span class="font-extrabold">
                OptiBienestar<span class="text-lime-300"> 360</span>
              </span>
            </div>
            <UBadge
              :color="member.status === 'ACTIVE' ? 'success' : 'warning'"
              variant="solid"
              size="sm"
            >
              {{ member.status === 'ACTIVE' ? t('members.portal.card.statusActive') : member.status }}
            </UBadge>
          </div>

          <!-- Holder -->
          <div class="mt-8">
            <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">{{ t('members.portal.card.holder') }}</p>
            <p class="text-xl font-bold leading-tight mt-0.5">{{ displayName }}</p>
            <p class="text-sm text-prohealth-100/80 mt-0.5">
              {{ member.documentType }}-{{ member.documentNumber }}
            </p>
          </div>

          <!-- Card footer -->
          <div class="flex items-end justify-between mt-7">
            <div>
              <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">{{ t('members.portal.card.memberSince') }}</p>
              <p class="text-sm font-semibold mt-0.5">{{ formatDate(member.enrolledAt, 'short') }}</p>
            </div>
            <div class="text-right">
              <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">{{ t('members.portal.card.cardNumber') }}</p>
              <p class="text-sm font-mono font-semibold tracking-wider mt-0.5">{{ cardCode }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Covered beneficiaries -->
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="px-6 py-4 border-b border-prohealth-100">
          <h2 class="font-bold text-prohealth-900">{{ t('members.portal.beneficiaries.title') }}</h2>
          <p class="text-xs text-prohealth-500 mt-0.5">{{ t('members.portal.beneficiaries.subtitle') }}</p>
        </div>

        <div v-if="!member.beneficiaries?.length" class="px-6 py-10 text-center text-prohealth-500">
          <UIcon name="i-lucide-users" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
          <p class="text-sm">{{ t('members.portal.beneficiaries.empty') }}</p>
        </div>

        <ul v-else class="divide-y divide-prohealth-100">
          <li
            v-for="b in member.beneficiaries"
            :key="b.uuid"
            class="px-6 py-3.5 flex items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="font-semibold text-prohealth-900 truncate">
                {{ b.fullName || [b.firstName, b.lastName].filter(Boolean).join(' ') }}
              </p>
              <p class="text-xs text-prohealth-500">
                <template v-if="b.documentNumber">{{ b.documentType }}-{{ b.documentNumber }} · </template>
                {{ t('members.portal.beneficiaries.born', { date: formatDate(b.birthDate, 'short') }) }}
              </p>
            </div>
            <UBadge color="primary" variant="subtle" size="sm">
              {{ relationshipLabel(b.relationship) }}
            </UBadge>
          </li>
        </ul>
      </div>

      <!-- My payments (self-gated by PAYMENT_VIEW_OWN) -->
      <MyPaymentsCard />

      <!-- Registered contact data -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('members.portal.myData.title') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.portal.myData.phone') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.phone || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.portal.myData.email') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.email || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.portal.myData.city') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.city?.name || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.portal.myData.address') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.address || t('common.empty') }}</dd>
          </div>
        </dl>
        <p class="text-xs text-prohealth-500 mt-5">
          {{ t('members.portal.myData.outdatedPre') }}<NuxtLink to="/#contact" class="text-cyan-700 hover:underline">{{ t('members.portal.myData.outdatedLink') }}</NuxtLink>{{ t('members.portal.myData.outdatedPost') }}
        </p>
      </div>

      <!-- Directory access -->
      <div class="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-handshake" class="w-6 h-6 text-cyan-600" />
          <p class="text-sm text-prohealth-800">
            <i18n-t keypath="members.portal.directory.text" tag="span" scope="global">
              <template #network>
                <span class="font-semibold">{{ t('members.portal.directory.network') }}</span>
              </template>
            </i18n-t>
          </p>
        </div>
        <UButton to="/aliados" color="primary" variant="soft" size="sm" trailing-icon="i-lucide-arrow-right">
          {{ t('members.portal.directory.button') }}
        </UButton>
      </div>
    </template>
  </div>
</template>
