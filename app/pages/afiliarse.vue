<script setup lang="ts">
// Public self-affiliation, step 1 of the stepwise registration (hub ADR 0037 §2) — the landing of every advisor QR
// (/afiliarse?ref=<referral code>). It asks the minimum: names, national ID, phone, email, an optional password and
// the acceptance of the portal terms. POST /v1/public/affiliation-requests creates the account and a DRAFT request
// and returns the session, so the person lands on /completar-registro (birth date, plan + contract, payment,
// family, send). What is typed here lives in localStorage until it is sent (no identity yet). Without a password the
// person later signs in with the emailed access link.
import type { ApiError } from '~/types/auth'
import { MEMBER_WIZARD_STEPS } from '~/types/registration'

// English pair of this public screen (hub URL convention); the fixed `key` keeps the half-filled form when the
// switcher jumps between the two URLs.
definePageMeta({ layout: 'default', alias: ['/en/join'], key: 'public-join', middleware: 'self-registration', selfRegistration: 'member' })

const { t } = useI18n()
const publicPath = usePublicPath()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const api = useMyAffiliationRequest()
const { isAccountExists, openSession } = useRegistrationStart()

useSeoMeta({ title: () => t('affiliationRequest.seoTitle') })

const referralCode = computed(() => String(route.query.ref ?? '').trim().toUpperCase().slice(0, 20))

const state = reactive({
  firstName: '', lastName: '', documentType: 'V', documentNumber: '', phone: '', email: '',
  password: '', acceptedPortalTerms: false,
  // Honeypot: hidden from people, bots fill it. Always sent as ''.
  homepage: '',
})
const draft = useRegistrationDraft('member', state, ['password', 'homepage', 'acceptedPortalTerms'])

const sending = ref(false)
const accountExists = ref<string | null>(null)
const checkEmail = ref<string | null>(null)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function invalid(): string | null {
  if (!state.firstName.trim() || !state.lastName.trim() || !state.documentNumber.trim() || !state.phone.trim() || !state.email.trim()) {
    return t('affiliationRequest.required')
  }
  if (!/^\d{1,9}$/.test(state.documentNumber.trim())) return t('affiliationRequest.badDocument')
  if (!EMAIL_RE.test(state.email.trim())) return t('registration.step1.badEmail')
  if (state.password && state.password.length < 8) return t('affiliationRequest.shortPassword')
  if (!state.acceptedPortalTerms) return t('registration.step1.termsRequired')
  return null
}

async function submit() {
  accountExists.value = null
  const error = invalid()
  if (error) {
    toast.add({ title: error, color: 'error' })
    return
  }
  sending.value = true
  try {
    const res = await api.start({
      firstName: state.firstName.trim(),
      lastName: state.lastName.trim(),
      documentType: state.documentType,
      documentNumber: state.documentNumber.trim(),
      phone: state.phone.trim(),
      email: state.email.trim(),
      password: state.password || undefined,
      referralCode: referralCode.value || undefined,
      acceptedPortalTerms: true,
      homepage: '',
    })
    draft.clear()
    const next = await openSession(res.session, { identifier: state.email.trim(), password: state.password || undefined })
    if (next) {
      const plan = typeof route.query.plan === 'string' && route.query.plan ? { plan: route.query.plan } : undefined
      await router.push({ path: next, query: plan })
    }
    else {
      checkEmail.value = state.email.trim()
    }
  }
  catch (err) {
    // Switched off while the form was open (hub ADR 0037): go to the login with the notice.
    if (await redirectIfSelfRegistrationClosed(err, 'member')) return
    if (isAccountExists(err)) accountExists.value = (err as ApiError).message
    else toast.add({ title: (err as ApiError)?.message || t('affiliationRequest.errorFallback'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-xl bg-white rounded-3xl border border-prohealth-100 shadow-sm p-8">
      <template v-if="checkEmail">
        <div class="text-center space-y-3">
          <UIcon name="i-lucide-mail-check" class="w-12 h-12 mx-auto text-green-500" />
          <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('registration.step1.checkEmailTitle') }}</h1>
          <p class="text-sm text-prohealth-600">{{ t('registration.step1.checkEmailBody', { email: checkEmail }) }}</p>
          <UButton :to="publicPath('/')" color="primary" variant="outline" icon="i-lucide-house" class="mt-2">{{ t('affiliationRequest.backHome') }}</UButton>
        </div>
      </template>

      <template v-else>
        <RegistrationProgressBar :current="1" :total="MEMBER_WIZARD_STEPS.length + 1" :label="t('registration.step1.label')" class="mb-5" />
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('affiliationRequest.title') }}</h1>
        <p class="text-sm text-prohealth-600 mt-1">{{ t('registration.step1.subtitle') }}</p>

        <div v-if="referralCode" class="mt-4 rounded-xl bg-cyan-50 border border-cyan-200 px-4 py-3 text-sm text-prohealth-800">
          {{ t('affiliationRequest.referredBy') }} <span class="font-mono font-bold">{{ referralCode }}</span>
        </div>

        <RegistrationAccountExists v-if="accountExists" class="mt-4" :message="accountExists" />

        <form class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4" novalidate @submit.prevent="submit">
          <!-- Honeypot: off-screen, out of the tab order, never autofilled. -->
          <div class="absolute -left-[10000px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
            <label for="member-request-homepage">Homepage</label>
            <input id="member-request-homepage" v-model="state.homepage" type="text" name="homepage" tabindex="-1" autocomplete="off">
          </div>
          <UFormField :label="t('affiliationRequest.firstName')" required>
            <UInput v-model="state.firstName" class="w-full" maxlength="50" autocomplete="given-name" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.lastName')" required>
            <UInput v-model="state.lastName" class="w-full" maxlength="50" autocomplete="family-name" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.document')" required>
            <div class="flex gap-2">
              <DocumentTypePrefixSelect v-model="state.documentType" class="w-20" />
              <UInput v-model="state.documentNumber" class="flex-1" maxlength="9" inputmode="numeric" placeholder="12345678" />
            </div>
          </UFormField>
          <UFormField :label="t('registration.step1.mobile')" required>
            <UInput v-model="state.phone" class="w-full" maxlength="30" autocomplete="tel" placeholder="0414-1234567" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.email')" required class="sm:col-span-2">
            <UInput v-model="state.email" type="email" class="w-full" maxlength="254" autocomplete="email" />
          </UFormField>
          <UFormField :label="t('registration.step1.password')" :help="t('registration.step1.passwordHelp')" class="sm:col-span-2">
            <UInput v-model="state.password" type="password" class="w-full" maxlength="128" autocomplete="new-password" />
          </UFormField>
          <UCheckbox v-model="state.acceptedPortalTerms" :label="t('registration.step1.termsAccept')" class="sm:col-span-2" />
          <p class="sm:col-span-2 text-xs text-prohealth-500">{{ t('registration.step1.nextNote') }}</p>
          <UButton type="submit" block color="primary" :loading="sending" :disabled="!state.acceptedPortalTerms" icon="i-lucide-arrow-right" trailing class="sm:col-span-2">
            {{ t('registration.step1.submit') }}
          </UButton>
        </form>
      </template>
    </div>
  </div>
</template>
