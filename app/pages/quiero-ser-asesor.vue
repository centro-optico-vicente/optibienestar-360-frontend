<script setup lang="ts">
// Public "Quiero ser asesor" form: a salesperson registers itself as an advisor.
// POST /v1/public/advisor-requests creates the login (role ASESOR_PENDIENTE) and the advisor in PENDING, and returns
// the session; the person lands on /advisors/pending. Unlike members and allies there is no step wizard: an operator
// verifies the advisor, and only then does it get its referral code, QR and commissions.
// `homepage` is a honeypot. The draft lives in localStorage until it is sent (passwords are never stored).
import type { ApiError, LoginResponse } from '~/types/auth'
import { ROLES } from '~/types/auth'
import type { CatalogItem } from '~/types/catalogs'
import { EDUCATION_LEVEL_OPTIONS, type EducationLevel } from '~/types/promoters'
import { ADVISOR_ACCOUNT_EXISTS_CODES, type AdvisorRequestAvailabilityDto, type AdvisorRequestCreateRequest, type AdvisorRequestCreatedDto } from '~/types/advisorRequests'
import { ADVISOR_PENDING_PATH, roleHome } from '~/utils/roleHome'

// English pair of this public screen (hub URL convention); the fixed `key` keeps the half-filled form when the
// switcher jumps between the two URLs.
definePageMeta({ layout: 'default', alias: ['/en/become-an-advisor'], key: 'public-become-advisor' })

const { t } = useI18n()
const publicPath = usePublicPath()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const { login, requestMagicLink } = useAuth()

useSeoMeta({
  title: () => t('advisorRequestForm.seoTitle'),
  description: () => t('advisorRequestForm.subtitle'),
})

// A pending advisor coming back here goes straight to its status page.
if (auth.isAuthenticated && auth.activeRole === ROLES.ADVISOR_PENDING) {
  await navigateTo(ADVISOR_PENDING_PATH, { replace: true })
}
/** Someone already signed in: this form creates a new account, so it is not offered. */
const signedIn = computed(() => auth.isAuthenticated)
const signedInHome = computed(() => roleHome(auth.activeRole))

const state = reactive({
  firstName: '',
  lastName: '',
  documentType: 'V' as 'V' | 'E',
  documentNumber: '',
  mobile: '',
  email: '',
  password: '',
  stateUuid: '',
  cityUuid: '',
  assignedZone: '',
  educationLevel: undefined as EducationLevel | undefined,
  profession: '',
  yearsOfExperience: '',
  lastCompany: '',
  lastPosition: '',
  vehicle: '',
  note: '',
  acceptedPortalTerms: false,
  // Honeypot: hidden from people, bots fill it. Always sent as ''.
  homepage: '',
})
const draft = useRegistrationDraft('advisor', state, ['password', 'homepage', 'acceptedPortalTerms'])

// ---- State / city (public catalogs) ----
const states = ref<CatalogItem[]>([])
const cities = ref<CatalogItem[]>([])
const loadingCities = ref(false)
const stateItems = computed(() => states.value.map(s => ({ value: s.uuid, label: s.name })))
const cityItems = computed(() => cities.value.map(c => ({ value: c.uuid, label: c.name })))

async function safeList(resource: string, query?: Record<string, string | undefined>): Promise<CatalogItem[]> {
  try {
    return (await usePublicCatalog(resource).list(query)).filter(i => i.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }
  catch {
    return []
  }
}

async function loadCities(stateUuid: string) {
  cities.value = []
  if (!stateUuid) return
  loadingCities.value = true
  cities.value = await safeList('cities', { stateUuid })
  loadingCities.value = false
}

let restoring = true
onMounted(async () => {
  states.value = await safeList('states')
  await loadCities(state.stateUuid)
  restoring = false
})
watch(() => state.stateUuid, async (uuid) => {
  if (restoring) return
  state.cityUuid = ''
  await loadCities(uuid)
})

const educationLevelItems = computed(() => EDUCATION_LEVEL_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))

// ---- Validation ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type MaskedField = 'documentNumber' | 'mobile' | 'firstName' | 'lastName'

/**
 * Format mask applied BEFORE the text gets in (`beforeinput`): a key or a pasted fragment with forbidden
 * characters is replaced by its allowed part, so a digit can never be typed into a name nor a letter into
 * the ID / mobile. The watchers below are the safety net for autofill and anything that skips the event.
 */
function maskInput(field: MaskedField, clean: (text: string) => string, max: number) {
  return (event: InputEvent) => {
    if (!event.inputType.startsWith('insert')) return
    const data = event.data ?? event.dataTransfer?.getData('text/plain') ?? null
    if (data === null) return
    const allowed = clean(data)
    if (allowed === data) return
    event.preventDefault()
    if (!allowed) return
    const input = event.target as HTMLInputElement
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    state[field] = (input.value.slice(0, start) + allowed + input.value.slice(end)).slice(0, max)
    const caret = Math.min(start + allowed.length, state[field].length)
    void nextTick(() => input.setSelectionRange(caret, caret))
  }
}
const stripNonDigits = (text: string) => text.replace(/\D/g, '')
const stripNonNameChars = (text: string) => text.replace(/[^\p{L}' -]/gu, '')

// Cédula and mobile: digits only. Names: letters (accents, ñ), space, apostrophe and hyphen only.
const onlyDigits = maskInput('documentNumber', stripNonDigits, 9)
const onlyMobileDigits = maskInput('mobile', stripNonDigits, 15)
const onlyFirstNameChars = maskInput('firstName', stripNonNameChars, 50)
const onlyLastNameChars = maskInput('lastName', stripNonNameChars, 50)

watch(() => state.documentNumber, (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  if (digits !== value) state.documentNumber = digits
}, { immediate: true })

// Names take letters only (any accent or ñ), words joined by one space, apostrophe or hyphen: digits and
// symbols never get in, a pasted value is cleaned. Mirrors the backend PERSON_NAME pattern.
const NAME_RE = /^\p{L}+([ '-]\p{L}+)*$/u
function cleanName(value: string): string {
  return value.replace(/[^\p{L}' -]/gu, '').replace(/^[ '-]+/, '').replace(/([ '-])[ '-]+/g, '$1').slice(0, 50)
}
for (const key of ['firstName', 'lastName'] as const) {
  watch(() => state[key], (value) => {
    const clean = cleanName(value)
    if (clean !== value) state[key] = clean
  })
}

// The mobile takes digits only (10 to 15, e.g. 04141234567): anything else is dropped as it is typed or pasted.
watch(() => state.mobile, (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 15)
  if (digits !== value) state.mobile = digits
}, { immediate: true })

type FieldKey = 'firstName' | 'lastName' | 'documentNumber' | 'mobile' | 'email' | 'password' | 'yearsOfExperience'
/** Field order on screen: the first one with an error gets the focus. */
const FIELD_ORDER: readonly FieldKey[] = ['firstName', 'lastName', 'documentNumber', 'mobile', 'email', 'password', 'yearsOfExperience']

const errors = reactive<Partial<Record<FieldKey, string>>>({})
for (const key of FIELD_ORDER) watch(() => state[key], () => { delete errors[key] })

function validate(): Partial<Record<FieldKey, string>> {
  const found: Partial<Record<FieldKey, string>> = {}
  const required = t('advisorRequestForm.requiredField')
  if (!state.firstName.trim()) found.firstName = required
  else if (!NAME_RE.test(state.firstName.trim())) found.firstName = t('advisorRequestForm.badName')
  if (!state.lastName.trim()) found.lastName = required
  else if (!NAME_RE.test(state.lastName.trim())) found.lastName = t('advisorRequestForm.badName')
  if (!state.documentNumber.trim()) found.documentNumber = required
  else if (!/^\d{1,9}$/.test(state.documentNumber.trim())) found.documentNumber = t('advisorRequestForm.badDocument')
  if (!state.mobile.trim()) found.mobile = required
  else if (!/^\d{10,15}$/.test(state.mobile.trim())) found.mobile = t('advisorRequestForm.badMobile')
  if (!state.email.trim()) found.email = required
  else if (!EMAIL_RE.test(state.email.trim())) found.email = t('advisorRequestForm.badEmail')
  if (state.password && state.password.length < 8) found.password = t('advisorRequestForm.shortPassword')
  const years = String(state.yearsOfExperience).trim()
  if (years && (!/^\d{1,2}$/.test(years) || Number(years) > 80)) found.yearsOfExperience = t('advisorRequestForm.badYears')
  return found
}

// ---- Live email / cédula check ----
// On blur the form asks whether an account already uses that email or cédula (same rule the backend enforces on
// submit), so the person learns it right away and is offered to sign in instead.
type TakenField = 'email' | 'documentNumber'
const taken = reactive<Record<TakenField, boolean>>({ email: false, documentNumber: false })
const TAKEN_KEY: Record<TakenField, string> = {
  email: 'advisorRequestForm.emailTaken',
  documentNumber: 'advisorRequestForm.documentTaken',
}
watch(() => state.email, () => { taken.email = false })
watch(() => [state.documentType, state.documentNumber], () => { taken.documentNumber = false })

async function checkAvailability(field: TakenField) {
  const email = state.email.trim()
  const documentNumber = state.documentNumber.trim()
  const body = field === 'email'
    ? (EMAIL_RE.test(email) ? { email } : null)
    : (/^\d{6,9}$/.test(documentNumber) ? { documentType: state.documentType, documentNumber } : null)
  if (!body) return
  try {
    const res = await useApi<AdvisorRequestAvailabilityDto>('/v1/public/advisor-requests/availability', {
      method: 'POST',
      skipAuth: true,
      silent: true,
      body,
    })
    // The value may have changed while the request was in flight.
    const still = field === 'email' ? state.email.trim() === email : state.documentNumber.trim() === documentNumber
    if (!still) return
    taken[field] = field === 'email' ? res.emailTaken : res.documentTaken
    if (taken[field]) errors[field] = t(TAKEN_KEY[field])
  }
  catch {
    // Throttled or offline: the backend repeats the check on submit.
  }
}
watch(() => state.documentType, () => { void checkAvailability('documentNumber') })

function checkForm(): boolean {
  for (const key of FIELD_ORDER) delete errors[key]
  Object.assign(errors, validate())
  for (const field of ['email', 'documentNumber'] as const) {
    if (taken[field] && !errors[field]) errors[field] = t(TAKEN_KEY[field])
  }
  const first = FIELD_ORDER.find(key => errors[key])
  if (first) {
    toast.add({ title: t('advisorRequestForm.fixFields'), color: 'error' })
    void nextTick(() => document.querySelector<HTMLInputElement>(`[name="advisor-request-${first}"]`)?.focus())
    return false
  }
  if (!state.acceptedPortalTerms) {
    toast.add({ title: t('advisorRequestForm.termsRequired'), color: 'error' })
    return false
  }
  return true
}

function optional(value: string): string | undefined {
  return value.trim() || undefined
}

function buildRequest(): AdvisorRequestCreateRequest {
  const years = String(state.yearsOfExperience).trim()
  return {
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    documentType: state.documentType,
    documentNumber: state.documentNumber.trim(),
    mobile: state.mobile.trim(),
    email: state.email.trim(),
    password: state.password || undefined,
    cityUuid: state.cityUuid || undefined,
    assignedZone: optional(state.assignedZone),
    educationLevel: state.educationLevel || undefined,
    profession: optional(state.profession),
    yearsOfExperience: years ? Number(years) : undefined,
    lastCompany: optional(state.lastCompany),
    lastPosition: optional(state.lastPosition),
    vehicle: optional(state.vehicle),
    note: optional(state.note),
    acceptedPortalTerms: true,
    homepage: '',
  }
}

/** 422 "already has an account" (email or national ID already registered): offer to sign in instead. */
function isAccountExists(err: unknown): boolean {
  const e = err as ApiError | null
  const code = e?.problem?.code
  return e?.status === 422 && typeof code === 'string' && ADVISOR_ACCOUNT_EXISTS_CODES.includes(code)
}

const sending = ref(false)
const accountExists = ref<string | null>(null)
const checkEmail = ref<string | null>(null)

async function submit() {
  accountExists.value = null
  if (!checkForm()) return
  sending.value = true
  try {
    const res = await useApi<AdvisorRequestCreatedDto>('/v1/public/advisor-requests', {
      method: 'POST',
      skipAuth: true,
      silent: true,
      body: buildRequest(),
    })
    draft.clear()
    const email = state.email.trim()
    // Same tail as the ally form: the answer carries the login session; fall back to a password login, and finally
    // to the emailed access link.
    const session = res.session
    if (session?.accessToken && session.refreshToken && session.user) {
      auth.setSession(session as LoginResponse)
    }
    else if (state.password) {
      await login({ identifier: email, password: state.password })
    }
    else {
      await requestMagicLink(email)
      checkEmail.value = email
      return
    }
    await router.push(ADVISOR_PENDING_PATH)
  }
  catch (err) {
    if (isAccountExists(err) || (err as ApiError)?.status === 409) accountExists.value = (err as ApiError).message
    else toast.add({ title: (err as ApiError)?.message || t('advisorRequestForm.errorFallback'), color: 'error', icon: 'i-lucide-circle-alert' })
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
          <p class="text-sm text-prohealth-600">{{ t('advisorRequestForm.verificationNotice') }}</p>
        </div>
      </template>

      <template v-else-if="signedIn">
        <div class="text-center space-y-3">
          <UIcon name="i-lucide-user-check" class="w-12 h-12 mx-auto text-prohealth-400" />
          <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('advisorRequestForm.title') }}</h1>
          <p class="text-sm text-prohealth-600">{{ t('advisorRequestForm.signedInNotice', { name: auth.user?.fullName || auth.user?.email }) }}</p>
          <UButton :to="signedInHome" color="primary" variant="outline" icon="i-lucide-arrow-right" trailing class="mt-2">{{ t('advisorRequestForm.goToPortal') }}</UButton>
        </div>
      </template>

      <template v-else>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('advisorRequestForm.title') }}</h1>
        <p class="text-sm text-prohealth-600 mt-1">{{ t('advisorRequestForm.subtitle') }}</p>

        <UAlert
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-shield-check"
          :title="t('advisorRequestForm.verificationTitle')"
          :description="t('advisorRequestForm.verificationNotice')"
        />

        <RegistrationAccountExists v-if="accountExists || taken.email || taken.documentNumber" class="mt-4" :message="accountExists" />

        <form class="mt-6 space-y-6" novalidate @submit.prevent="submit">
          <!-- Honeypot: off-screen, out of the tab order, never autofilled. -->
          <div class="absolute -left-[10000px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
            <label for="advisor-request-homepage">Homepage</label>
            <input id="advisor-request-homepage" v-model="state.homepage" type="text" name="homepage" tabindex="-1" autocomplete="off">
          </div>

          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <legend class="text-sm font-semibold text-prohealth-900 mb-2">{{ t('advisorRequestForm.sections.personal') }}</legend>
            <UFormField :label="t('advisorRequestForm.fields.firstName')" required :error="errors.firstName">
              <UInput v-model="state.firstName" name="advisor-request-firstName" class="w-full" maxlength="50" autocomplete="given-name" @beforeinput="onlyFirstNameChars" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.lastName')" required :error="errors.lastName">
              <UInput v-model="state.lastName" name="advisor-request-lastName" class="w-full" maxlength="50" autocomplete="family-name" @beforeinput="onlyLastNameChars" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.document')" required :error="errors.documentNumber">
              <div class="flex gap-2">
                <!-- Nested field: the V/E select gets its own id, so the label points to the number only. -->
                <UFormField class="w-20 shrink-0">
                  <DocumentTypePrefixSelect v-model="state.documentType" :aria-label="t('advisorRequestForm.fields.documentType')" class="w-full" />
                </UFormField>
                <UInput v-model="state.documentNumber" name="advisor-request-documentNumber" class="flex-1" maxlength="9" inputmode="numeric" autocomplete="off" placeholder="12345678" @beforeinput="onlyDigits" @blur="checkAvailability('documentNumber')" />
              </div>
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.mobile')" required :error="errors.mobile">
              <UInput v-model="state.mobile" name="advisor-request-mobile" type="tel" class="w-full" maxlength="15" inputmode="numeric" autocomplete="tel" placeholder="04141234567" @beforeinput="onlyMobileDigits" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.email')" :help="t('advisorRequestForm.fields.emailHelp')" required :error="errors.email" class="sm:col-span-2">
              <UInput v-model="state.email" name="advisor-request-email" type="email" class="w-full" maxlength="254" autocomplete="email" @blur="checkAvailability('email')" />
            </UFormField>
            <UFormField :label="t('registration.step1.password')" :help="t('registration.step1.passwordHelp')" :error="errors.password" class="sm:col-span-2">
              <UInput v-model="state.password" name="advisor-request-password" type="password" class="w-full" maxlength="128" autocomplete="new-password" />
            </UFormField>
          </fieldset>

          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <legend class="text-sm font-semibold text-prohealth-900 mb-1">{{ t('advisorRequestForm.sections.profile') }}</legend>
            <p class="sm:col-span-2 text-xs text-prohealth-500 -mt-1">{{ t('advisorRequestForm.sections.profileHelp') }}</p>
            <UFormField :label="t('advisorRequestForm.fields.state')">
              <USelectMenu v-model="state.stateUuid" clear :items="stateItems" label-key="label" value-key="value" :placeholder="t('advisorRequestForm.fields.statePlaceholder')" class="w-full" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.city')">
              <USelectMenu
                v-model="state.cityUuid"
                clear
                :items="cityItems"
                label-key="label"
                value-key="value"
                :loading="loadingCities"
                :disabled="!state.stateUuid"
                :placeholder="state.stateUuid ? t('advisorRequestForm.fields.cityPlaceholder') : t('advisorRequestForm.fields.selectStateFirst')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.assignedZone')" :help="t('advisorRequestForm.fields.assignedZoneHelp')" class="sm:col-span-2">
              <UInput v-model="state.assignedZone" name="advisor-request-assignedZone" class="w-full" maxlength="120" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.educationLevel')">
              <USelectMenu v-model="state.educationLevel" clear value-key="value" :items="educationLevelItems" class="w-full" :placeholder="t('common.select')" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.profession')">
              <UInput v-model="state.profession" name="advisor-request-profession" class="w-full" maxlength="120" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.yearsOfExperience')" :error="errors.yearsOfExperience">
              <UInput v-model="state.yearsOfExperience" name="advisor-request-yearsOfExperience" class="w-full" inputmode="numeric" maxlength="2" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.vehicle')" :help="t('advisorRequestForm.fields.vehicleHelp')">
              <UInput v-model="state.vehicle" name="advisor-request-vehicle" class="w-full" maxlength="120" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.lastCompany')">
              <UInput v-model="state.lastCompany" name="advisor-request-lastCompany" class="w-full" maxlength="150" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.lastPosition')">
              <UInput v-model="state.lastPosition" name="advisor-request-lastPosition" class="w-full" maxlength="100" />
            </UFormField>
            <UFormField :label="t('advisorRequestForm.fields.note')" :help="t('advisorRequestForm.fields.noteHelp')" class="sm:col-span-2">
              <UTextarea v-model="state.note" name="advisor-request-note" :rows="3" :maxlength="1000" class="w-full" />
            </UFormField>
          </fieldset>

          <UCheckbox v-model="state.acceptedPortalTerms" :label="t('advisorRequestForm.termsAccept')" />

          <!-- Disabled until the terms are accepted: greyed out so it does not look clickable. -->
          <UButton type="submit" block color="primary" :loading="sending" :disabled="!state.acceptedPortalTerms" icon="i-lucide-arrow-right" trailing class="disabled:opacity-50 disabled:grayscale aria-disabled:opacity-50 aria-disabled:grayscale">
            {{ t('advisorRequestForm.submit') }}
          </UButton>
          <p class="text-center text-sm text-prohealth-600">
            {{ t('advisorRequestForm.haveAccount') }}
            <NuxtLink :to="publicPath('/')" class="text-cyan-700 font-medium hover:underline">{{ t('advisorRequestForm.signIn') }}</NuxtLink>
          </p>
        </form>
      </template>
    </div>
  </div>
</template>
