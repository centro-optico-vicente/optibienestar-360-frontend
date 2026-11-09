<script setup lang="ts">
// Public ally request, step 1 of the stepwise registration (hub ADR 0036 / 0037 §2).
// POST /v1/public/ally-requests creates the REAL ally in PENDING plus its portal user (role ALIADO_PENDIENTE) and
// returns the session; the person lands on /completar-registro (location, fiscal or professional data, profile,
// send). Only the minimum is asked here: segment, business name, contact, phone, email, optional password and the
// terms. The draft lives in localStorage until it is sent. ?ref=<advisor code> preselects the advisor.
// `homepage` is a honeypot.
import type { ApiError } from '~/types/auth'
import type { AllySegment } from '~/types/allies'
import type { AllyRequestCreateRequest } from '~/types/allyRequests'
import type { RegistrationStartResponse } from '~/types/affiliationRequests'
import { ALLY_WIZARD_STEPS } from '~/types/registration'

// English pair of this public screen (hub URL convention); the fixed `key`
// keeps the half-filled form when the switcher jumps between the two URLs.
definePageMeta({ layout: 'default', alias: ['/en/become-an-ally'], key: 'public-become-ally', middleware: 'self-registration', selfRegistration: 'ally' })

const { t } = useI18n()
const publicPath = usePublicPath()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { isAccountExists, openSession } = useRegistrationStart()

useSeoMeta({
  title: () => t('allyRequestForm.seoTitle'),
  description: () => t('allyRequestForm.subtitle'),
})

const referralCode = computed(() => String(route.query.ref ?? '').trim().toUpperCase().slice(0, 20))

const segment = ref<AllySegment>('B2B')
const segmentItems = computed(() => [
  { value: 'B2B', label: t('allyRequestForm.segmentB2B'), description: t('allyRequestForm.segmentB2BHint') },
  { value: 'B2P', label: t('allyRequestForm.segmentB2P'), description: t('allyRequestForm.segmentB2PHint') },
])
const docTypes = [{ value: 'V', label: 'V' }, { value: 'E', label: 'E' }]

const state = reactive({
  segment: 'B2B' as AllySegment,
  name: '',
  firstName: '',
  lastName: '',
  documentType: 'V' as 'V' | 'E',
  documentNumber: '',
  mobile: '',
  email: '',
  password: '',
  acceptedPortalTerms: false,
  // Honeypot: hidden from people, bots fill it. Always sent as ''.
  homepage: '',
})
// The segment radio and the draft share the same value.
watch(segment, (v) => { state.segment = v })
watch(() => state.segment, (v) => { segment.value = v })
const draft = useRegistrationDraft('ally', state, ['password', 'homepage', 'acceptedPortalTerms'])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function invalid(): string | null {
  const isB2B = segment.value === 'B2B'
  const missing = !state.firstName.trim() || !state.lastName.trim() || !state.documentNumber.trim()
    || !state.mobile.trim() || !state.email.trim() || (isB2B && !state.name.trim())
  if (missing) return t('allyRequestForm.required')
  if (!/^\d{1,9}$/.test(state.documentNumber.trim())) return t('allyRequestForm.badDocument')
  if (!EMAIL_RE.test(state.email.trim())) return t('allyRequestForm.badEmail')
  if (state.password && state.password.length < 8) return t('allyRequestForm.shortPassword')
  if (!state.acceptedPortalTerms) return t('allyRequestForm.termsRequired')
  return null
}

function buildRequest(): AllyRequestCreateRequest {
  return {
    segment: segment.value,
    // B2P: the name is optional (the backend derives "firstName lastName").
    name: state.name.trim() || undefined,
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    documentType: state.documentType,
    documentNumber: state.documentNumber.trim(),
    mobile: state.mobile.trim(),
    email: state.email.trim(),
    password: state.password || undefined,
    referralCode: referralCode.value || undefined,
    acceptedPortalTerms: true,
    homepage: '',
  }
}

const sending = ref(false)
const accountExists = ref<string | null>(null)
const checkEmail = ref<string | null>(null)

async function submit() {
  accountExists.value = null
  const error = invalid()
  if (error) {
    toast.add({ title: error, color: 'error' })
    return
  }
  sending.value = true
  try {
    const res = await useApi<RegistrationStartResponse>('/v1/public/ally-requests', {
      method: 'POST',
      skipAuth: true,
      silent: true,
      body: buildRequest(),
    })
    draft.clear()
    const next = await openSession(res.session, { identifier: state.email.trim(), password: state.password || undefined })
    if (next) await router.push(next)
    else checkEmail.value = state.email.trim()
  }
  catch (err) {
    // Switched off while the form was open (hub ADR 0037): go to the login with the notice.
    if (await redirectIfSelfRegistrationClosed(err, 'ally')) return
    if (isAccountExists(err) || (err as ApiError)?.status === 409) accountExists.value = (err as ApiError).message
    else toast.add({ title: (err as ApiError)?.message || t('allyRequestForm.errorFallback'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-2xl bg-white rounded-3xl border border-prohealth-100 shadow-sm p-8">
      <template v-if="checkEmail">
        <div class="text-center space-y-3">
          <UIcon name="i-lucide-mail-check" class="w-12 h-12 mx-auto text-green-500" />
          <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('registration.step1.checkEmailTitle') }}</h1>
          <p class="text-sm text-prohealth-600">{{ t('registration.step1.checkEmailBody', { email: checkEmail }) }}</p>
          <UButton :to="publicPath('/aliados')" color="primary" variant="outline" icon="i-lucide-handshake" class="mt-2">{{ t('allyRequestForm.backToAllies') }}</UButton>
        </div>
      </template>

      <template v-else>
        <RegistrationProgressBar :current="1" :total="ALLY_WIZARD_STEPS.length + 1" :label="t('registration.step1.label')" class="mb-5" />
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('allyRequestForm.title') }}</h1>
        <p class="text-sm text-prohealth-600 mt-1">{{ t('registration.step1.allySubtitle') }}</p>

        <div v-if="referralCode" class="mt-4 rounded-xl bg-cyan-50 border border-cyan-200 px-4 py-3 text-sm text-prohealth-800">
          {{ t('allyRequestForm.referredBy') }} <span class="font-mono font-bold">{{ referralCode }}</span>
        </div>

        <RegistrationAccountExists v-if="accountExists" class="mt-4" :message="accountExists" />

        <form class="mt-6 space-y-6" novalidate @submit.prevent="submit">
          <!-- Honeypot: off-screen, out of the tab order, never autofilled. -->
          <div class="absolute -left-[10000px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
            <label for="ally-request-homepage">Homepage</label>
            <input id="ally-request-homepage" v-model="state.homepage" type="text" name="homepage" tabindex="-1" autocomplete="off">
          </div>

          <UFormField :label="t('allyRequestForm.segmentLabel')" required>
            <URadioGroup v-model="segment" :items="segmentItems" orientation="horizontal" />
          </UFormField>

          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <legend class="text-sm font-semibold text-prohealth-900 mb-2">{{ t('allyRequestForm.sections.ally') }}</legend>
            <UFormField
              :label="segment === 'B2B' ? t('allyRequestForm.fields.name') : t('allyRequestForm.fields.nameB2P')"
              :help="segment === 'B2P' ? t('allyRequestForm.fields.nameB2PHelp') : undefined"
              :required="segment === 'B2B'"
              class="sm:col-span-2"
            >
              <UInput v-model="state.name" class="w-full" maxlength="150" autocomplete="organization" />
            </UFormField>
          </fieldset>

          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <legend class="text-sm font-semibold text-prohealth-900 mb-2">
              {{ segment === 'B2B' ? t('allyRequestForm.sections.contactB2B') : t('allyRequestForm.sections.contactB2P') }}
            </legend>
            <UFormField :label="t('allyRequestForm.fields.firstName')" required>
              <UInput v-model="state.firstName" class="w-full" maxlength="50" autocomplete="given-name" />
            </UFormField>
            <UFormField :label="t('allyRequestForm.fields.lastName')" required>
              <UInput v-model="state.lastName" class="w-full" maxlength="50" autocomplete="family-name" />
            </UFormField>
            <UFormField :label="t('allyRequestForm.fields.document')" required>
              <div class="flex gap-2">
                <USelect v-model="state.documentType" :items="docTypes" class="w-20" />
                <UInput v-model="state.documentNumber" class="flex-1" maxlength="9" inputmode="numeric" placeholder="12345678" />
              </div>
            </UFormField>
            <UFormField :label="t('allyRequestForm.fields.mobile')" required>
              <UInput v-model="state.mobile" class="w-full" maxlength="30" autocomplete="tel" placeholder="0414-1234567" />
            </UFormField>
            <UFormField :label="t('allyRequestForm.fields.email')" :help="t('allyRequestForm.fields.emailHelp')" required class="sm:col-span-2">
              <UInput v-model="state.email" type="email" class="w-full" maxlength="254" autocomplete="email" />
            </UFormField>
            <UFormField :label="t('registration.step1.password')" :help="t('registration.step1.passwordHelp')" class="sm:col-span-2">
              <UInput v-model="state.password" type="password" class="w-full" maxlength="128" autocomplete="new-password" />
            </UFormField>
          </fieldset>

          <UCheckbox v-model="state.acceptedPortalTerms" :label="t('allyRequestForm.termsAccept')" />
          <p class="text-xs text-prohealth-500">{{ t('allyRequestForm.reviewNote') }}</p>

          <UButton type="submit" block color="primary" :loading="sending" :disabled="!state.acceptedPortalTerms" icon="i-lucide-arrow-right" trailing>
            {{ t('registration.step1.submit') }}
          </UButton>
        </form>
      </template>
    </div>
  </div>
</template>
