<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { BeneficiaryDto, MemberDto } from '~/types/members'
import type { UsagePersonSummaryDto } from '~/types/benefits'

// Member portal: Digital Credential + covered beneficiaries.
// GET /v1/me/member requires MEMBER_VIEW_OWN; it returns 404 if the user isn't enrolled.
// Beneficiaries come from GET /v1/me/family (same permission): the member detail doesn't inline them.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_VIEW_OWN',
})

const { t } = useI18n()
// The public directory link follows the UI language (/aliados or /en/allies).
const publicPath = usePublicPath()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('members.portal.seoTitle') })

const members = useMembers()
const auth = useAuthStore()
const { can } = usePermissions()
const canAddBeneficiary = computed(() => can('MEMBER_BENEFICIARY_CREATE_OWN'))
const beneficiaryFormOpen = ref(false)

function onBeneficiaryCreated() {
  members.myFamily().then((res) => { beneficiaries.value = res ?? [] }).catch(() => {})
}

// Usage count per family member, shown on each beneficiary card.
const benefitUsage = useBenefitUsage()
const usageByPerson = ref<UsagePersonSummaryDto[]>([])
const usageByBeneficiary = computed(() => new Map(
  usageByPerson.value.filter(u => u.beneficiaryUuid).map(u => [u.beneficiaryUuid!, u]),
))

// Digital Credential read model (GET /v1/me/digital-card): plan and status of the
// active membership plus the QR (it encodes the member UUID, which the ally
// validator accepts as-is). Plan/status/next due are null without an active membership.
// A beneficiary with portal access (V195) gets their own identity on the
// holder's coverage: `holderName` / `relationship` are set only on their card.
interface DigitalCard {
  fullName?: string | null
  documentType?: string | null
  documentNumber?: string | null
  planName?: string | null
  membershipStatus?: string | null
  membershipStatus_Display?: string | null
  nextDueDate?: string | null
  nextDueDate_Display?: string | null
  memberSince?: string | null
  qrCodeDataUri?: string | null
  holderName?: string | null
  relationship?: string | null
}

const member = ref<MemberDto | null>(null)
const beneficiaries = ref<BeneficiaryDto[]>([])
const card = ref<DigitalCard | null>(null)
const qrDataUri = computed(() => card.value?.qrCodeDataUri ?? null)
const { photoUrl, ensure: ensurePhoto } = useProfilePhoto()
const loading = ref(true)
const notAffiliated = ref(false)
const loadError = ref(false)
/** The logged-in user is a beneficiary, not the holder: no family, payments or referrals of their own. */
const isBeneficiary = computed(() => !member.value && !!card.value?.holderName)

function loadFamilyUsage() {
  benefitUsage.myByPerson()
    .then((res) => { usageByPerson.value = res ?? [] })
    .catch(() => { usageByPerson.value = [] })
}

onMounted(async () => {
  try {
    member.value = await members.me()
    // Not silent: a failure here is why the QR is missing, so the toast says why.
    useApi<DigitalCard>('/v1/me/digital-card')
      .then((res) => { card.value = res })
      .catch(() => { card.value = null })
    members.myFamily()
      .then((res) => { beneficiaries.value = res ?? [] })
      .catch(() => { beneficiaries.value = [] })
    loadFamilyUsage()
    ensurePhoto()
  }
  catch (err) {
    if ((err as ApiError).status !== 404) {
      loadError.value = true
      return
    }
    // No member record of their own: a beneficiary with portal access still has a card.
    card.value = await useApi<DigitalCard>('/v1/me/digital-card', { silent: true }).catch(() => null)
    if (card.value?.holderName) ensurePhoto()
    else notAffiliated.value = true
  }
  finally {
    loading.value = false
  }
})

const displayName = computed(() => {
  const m = member.value
  if (!m) return card.value?.fullName || auth.fullName
  return m.fullName || [m.firstName, m.middleName, m.lastName, m.secondLastName].filter(Boolean).join(' ')
})
const documentLabel = computed(() => {
  const src = member.value ?? card.value
  return src?.documentNumber ? `${src.documentType}-${src.documentNumber}` : ''
})

// ---- Beneficiary portal access (V195): grant / resend / revoke from the family cards ----
const canGrantAccess = computed(() => can('BENEFICIARY_ACCESS_GRANT_OWN'))
const canRevokeAccess = computed(() => can('BENEFICIARY_ACCESS_REVOKE_OWN'))
const accessTarget = ref<BeneficiaryDto | null>(null)
const accessEmail = ref('')
const accessSubmitting = ref(false)
const accessModalOpen = computed({
  get: () => !!accessTarget.value,
  set: (v: boolean) => { if (!v) accessTarget.value = null },
})
const toast = useToast()

function openGrantAccess(b: BeneficiaryDto) {
  accessTarget.value = b
  accessEmail.value = b.email ?? ''
}

async function submitGrantAccess() {
  const b = accessTarget.value
  if (!b) return
  accessSubmitting.value = true
  try {
    await members.grantBeneficiaryAccess(b.uuid, accessEmail.value.trim() || undefined)
    toast.add({ title: t('members.portal.beneficiaries.access.grantedToast', { email: accessEmail.value || b.email || '' }), color: 'success', icon: 'i-lucide-mail-check' })
    accessTarget.value = null
    onBeneficiaryCreated()
  }
  catch {
    // useApi already toasted the backend message.
  }
  finally {
    accessSubmitting.value = false
  }
}

async function revokeAccess(b: BeneficiaryDto) {
  try {
    await members.revokeBeneficiaryAccess(b.uuid)
    toast.add({ title: t('members.portal.beneficiaries.access.revokedToast'), color: 'neutral', icon: 'i-lucide-user-x' })
    onBeneficiaryCreated()
  }
  catch {
    // useApi already toasted the backend message.
  }
}

/** Coverage is active only when the membership (not the member record) is ACTIVE. */
const coverageActive = computed(() => card.value?.membershipStatus === 'ACTIVE')
const coverageLabel = computed(() => {
  if (coverageActive.value) return t('members.portal.card.statusActive')
  return card.value?.membershipStatus_Display || card.value?.membershipStatus || t('members.portal.card.noMembership')
})

/** Initials for the photo placeholder. */
const initials = computed(() => (displayName.value || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join(''))
</script>

<template>
  <div class="space-y-6 max-w-7xl">
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
      <UButton to="/afiliarse" color="primary" variant="soft" size="sm" class="mt-4">
        {{ t('members.portal.joinCta') }}
      </UButton>
    </div>

    <!-- Error -->
    <div v-else-if="loadError || (!member && !isBeneficiary)" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-circle-alert" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('members.portal.errorTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('members.portal.errorBody') }}</p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-6 items-start">
      <!-- Left: credential, usage notes and photo — pinned while the right column scrolls -->
      <div class="space-y-6 lg:sticky lg:top-6">
        <!-- Digital Credential: shown with the cédula at the ally counter -->
        <div class="relative rounded-3xl bg-hero-prohealth text-white p-6 overflow-hidden shadow-lg">
          <div class="absolute inset-0 opacity-25 pointer-events-none">
            <div class="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-cyan-400/50 blur-3xl" />
            <div class="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-lime-400/30 blur-3xl" />
          </div>

          <div class="relative">
            <!-- Brand + coverage status -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <!-- The isotype is dark blue: a white disc keeps it legible on the brand gradient -->
                <span class="grid place-items-center w-9 h-9 rounded-full bg-white">
                  <BrandLogo variant="isotipo" :width="28" />
                </span>
                <span class="font-extrabold">
                  OptiBienestar<span class="text-lime-300"> 360</span>
                </span>
              </div>
              <UBadge :color="coverageActive ? 'success' : 'warning'" variant="solid" size="sm">
                {{ coverageLabel }}
              </UBadge>
            </div>

            <!-- Holder with photo (visual anti-fraud check at the counter) -->
            <div class="mt-6 flex items-center gap-4">
              <img
                v-if="photoUrl"
                :src="photoUrl"
                :alt="t('members.portal.card.photoAlt')"
                class="w-16 h-16 rounded-2xl object-cover border-2 border-white/80 shrink-0"
              >
              <span v-else class="w-16 h-16 rounded-2xl bg-white/15 border-2 border-white/40 grid place-items-center text-lg font-bold shrink-0">
                {{ initials }}
              </span>
              <div class="min-w-0">
                <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">{{ isBeneficiary ? t('members.portal.beneficiaries.cardLabel') : t('members.portal.card.holder') }}</p>
                <p class="text-xl font-bold leading-tight mt-0.5 truncate">{{ displayName }}</p>
                <p class="text-sm text-prohealth-100/80 mt-0.5">
                  {{ documentLabel }}
                </p>
              </div>
            </div>

            <!-- Plan, dates and QR -->
            <div class="flex items-end justify-between gap-4 mt-6">
              <div class="space-y-3 min-w-0">
                <div>
                  <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">{{ t('members.portal.card.plan') }}</p>
                  <p class="text-sm font-semibold mt-0.5 truncate">{{ card?.planName || t('common.empty') }}</p>
                </div>
                <div v-if="isBeneficiary">
                  <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">{{ t('members.portal.card.holder') }}</p>
                  <p class="text-sm font-semibold mt-0.5 truncate">{{ card?.holderName }}</p>
                </div>
                <div>
                  <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">{{ t('members.portal.card.memberSince') }}</p>
                  <p class="text-sm font-semibold mt-0.5">{{ formatDate(member?.enrolledAt ?? card?.memberSince, 'short') }}</p>
                </div>
                <div v-if="card?.nextDueDate">
                  <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">{{ t('members.portal.card.nextDue') }}</p>
                  <p class="text-sm font-semibold mt-0.5">{{ card.nextDueDate_Display || formatDate(card.nextDueDate, 'short') }}</p>
                </div>
              </div>
              <img
                v-if="qrDataUri"
                :src="qrDataUri"
                :alt="t('members.portal.qr.alt')"
                class="w-28 h-28 rounded-xl bg-white p-1.5 shrink-0"
              >
            </div>
          </div>
        </div>

        <!-- How to use the credential -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-5 space-y-3">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-shield-check" class="w-5 h-5 text-prohealth-600 shrink-0 mt-0.5" />
            <p class="text-sm text-prohealth-700">{{ t('members.portal.qr.body') }}</p>
          </div>
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p class="text-sm text-prohealth-700">{{ t('members.portal.qr.personal') }}</p>
          </div>
          <UButton
            v-if="qrDataUri"
            :href="qrDataUri"
            download="credencial-digital-optibienestar360.png"
            color="primary"
            variant="soft"
            size="sm"
            icon="i-lucide-download"
          >
            {{ t('members.portal.qr.download') }}
          </UButton>
        </div>

        <!-- Profile photo -->
        <ProfilePhotoCard />
      </div>

      <!-- Right: family, payments, referrals, contact -->
      <div class="space-y-6 min-w-0">
        <!-- Beneficiary portal: covered by the holder's plan; family, payments and referrals are the holder's -->
        <div v-if="isBeneficiary" class="bg-white rounded-2xl border border-prohealth-100 p-6 flex items-start gap-4">
          <UIcon name="i-lucide-users" class="w-6 h-6 text-prohealth-600 shrink-0 mt-0.5" />
          <div class="space-y-2">
            <h2 class="font-bold text-prohealth-900">{{ t('members.portal.beneficiaryView.title') }}</h2>
            <p class="text-sm text-prohealth-700">
              {{ t('members.portal.beneficiaryView.body', { holder: card?.holderName, plan: card?.planName, relationship: t(`members.relationships.${card?.relationship}`, card?.relationship ?? '') }) }}
            </p>
            <UButton to="/members/usage" color="primary" variant="soft" size="sm" icon="i-lucide-clipboard-list">
              {{ t('members.portal.beneficiaryView.usage') }}
            </UButton>
          </div>
        </div>

        <template v-else>
          <!-- Covered beneficiaries -->
          <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
            <div class="px-6 py-4 border-b border-prohealth-100 flex items-center justify-between gap-3">
              <div>
                <h2 class="font-bold text-prohealth-900">{{ t('members.portal.beneficiaries.title') }}</h2>
                <p class="text-xs text-prohealth-500 mt-0.5">{{ t('members.portal.beneficiaries.subtitle') }}</p>
              </div>
              <UButton
                v-if="canAddBeneficiary"
                color="primary"
                variant="soft"
                size="sm"
                icon="i-lucide-user-plus"
                :label="t('members.portal.beneficiaries.add')"
                @click="beneficiaryFormOpen = true"
              />
            </div>

            <div v-if="!beneficiaries.length" class="px-6 py-10 text-center text-prohealth-500">
              <UIcon name="i-lucide-users" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
              <p class="text-sm">{{ t('members.portal.beneficiaries.empty') }}</p>
            </div>

            <div v-else class="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
              <BeneficiaryCard
                v-for="b in beneficiaries"
                :key="b.uuid"
                :beneficiary="b"
                :usage="usageByBeneficiary.get(b.uuid)"
                :can-grant="canGrantAccess"
                :can-revoke="canRevokeAccess"
                @grant="openGrantAccess"
                @revoke="revokeAccess"
              />
            </div>
          </div>

          <MyBeneficiaryFormModal v-model:open="beneficiaryFormOpen" @created="onBeneficiaryCreated" />

          <UModal
            v-model:open="accessModalOpen"
            :title="t('members.portal.beneficiaries.access.modalTitle', { name: accessTarget?.fullName ?? '' })"
            :description="t('members.portal.beneficiaries.access.modalDescription')"
          >
            <template #body>
              <UFormField :label="t('members.portal.beneficiaries.access.email')" required>
                <UInput v-model="accessEmail" type="email" class="w-full" autocomplete="off" />
              </UFormField>
            </template>
            <template #footer>
              <div class="flex w-full justify-end gap-3">
                <UButton color="neutral" variant="ghost" :disabled="accessSubmitting" @click="accessTarget = null">
                  {{ t('common.cancel') }}
                </UButton>
                <UButton color="primary" icon="i-lucide-send" :loading="accessSubmitting" :disabled="!accessEmail.trim()" @click="submitGrantAccess">
                  {{ t('members.portal.beneficiaries.access.send') }}
                </UButton>
              </div>
            </template>
          </UModal>

          <!-- My active promotion (self-gated by MEMBER_VIEW_OWN; hidden when none) -->
          <MyPromotionCard />

      <!-- My payments (self-gated by COLLECTION_VIEW_OWN) -->
      <MyPaymentsCard />

          <!-- My referrals (self-gated by REFERRAL_CODE_VIEW_OWN) -->
          <MyReferralsCard />

          <!-- Registered contact data -->
          <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
            <h2 class="font-bold text-prohealth-900 mb-4">{{ t('members.portal.myData.title') }}</h2>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.portal.myData.phone') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ member?.phone || t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.portal.myData.email') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ member?.email || t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.portal.myData.city') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ member?.city?.name || t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.portal.myData.address') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ member?.address || t('common.empty') }}</dd>
              </div>
            </dl>
            <p class="text-xs text-prohealth-500 mt-5">
              {{ t('members.portal.myData.outdated') }}
            </p>
          </div>
        </template>

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
          <UButton :to="publicPath('/aliados')" color="primary" variant="soft" size="sm" trailing-icon="i-lucide-arrow-right">
            {{ t('members.portal.directory.button') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
