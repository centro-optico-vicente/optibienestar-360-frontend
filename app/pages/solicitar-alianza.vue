<script setup lang="ts">
// Public ally request — "¿Quieres ser aliado?" (hub ADR 0036).
// POST /v1/public/ally-requests creates the REAL ally in registration_status
// PENDING plus its portal user (role ALIADO_PENDIENTE) with the password typed
// here. Right after the 201 the applicant is logged in with the same email and
// password and sent to the ally portal (/allies), where they complete the
// profile while staff review the request; if that login fails, a success screen
// offers the sign-in button instead.
// One step: the segment selector (Comercial / Profesional) shows or hides the
// 3–4 fields that depend on it. ?ref=<advisor code> preselects the advisor who
// brought the ally (same as /afiliarse). `homepage` is a honeypot.
import type { ApiError } from '~/types/auth'
import type { AllySegment } from '~/types/allies'
import type { CatalogItem } from '~/types/catalogs'
import { TAX_DOCUMENT_TYPES, type AllyRequestCreateRequest, type AllyRequestCreatedDto } from '~/types/allyRequests'
import { professionTreeItems } from '~/utils/professionLabel'

// English pair of this public screen (hub URL convention); the fixed `key`
// keeps the half-filled form when the switcher jumps between the two URLs.
definePageMeta({ layout: 'default', alias: ['/en/become-an-ally'], key: 'public-become-ally' })

interface AllyTypeItem extends CatalogItem { segment?: AllySegment | null }

const { t } = useI18n()
const publicPath = usePublicPath()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { login } = useAuth()

useSeoMeta({
  title: () => t('allyRequestForm.seoTitle'),
  description: () => t('allyRequestForm.subtitle'),
})

const referralCode = computed(() => String(route.query.ref ?? '').trim().toUpperCase().slice(0, 20))

// ---- Catalogs (public, no login) ----
const allyTypes = ref<AllyTypeItem[]>([])
const professions = ref<CatalogItem[]>([])
const states = ref<CatalogItem[]>([])
const cities = ref<CatalogItem[]>([])
const loadingCities = ref(false)

async function safeList(resource: string, query?: Record<string, string | undefined>): Promise<CatalogItem[]> {
  try {
    return (await usePublicCatalog(resource).list(query)).filter(i => i.active !== false)
  }
  catch {
    return []
  }
}

onMounted(async () => {
  const [types, profs, sts] = await Promise.all([
    safeList('ally-types'),
    safeList('professions'),
    safeList('states'),
  ])
  allyTypes.value = types as AllyTypeItem[]
  professions.value = profs
  states.value = sts.sort((a, b) => a.name.localeCompare(b.name, 'es'))
})

const segment = ref<AllySegment>('B2B')
const segmentItems = computed(() => [
  { value: 'B2B', label: t('allyRequestForm.segmentB2B'), description: t('allyRequestForm.segmentB2BHint') },
  { value: 'B2P', label: t('allyRequestForm.segmentB2P'), description: t('allyRequestForm.segmentB2PHint') },
])

// A type without segment fits both (same rule as the admin ally form).
const allyTypeItems = computed(() => allyTypes.value
  .filter(i => !i.segment || i.segment === segment.value)
  .map(i => ({ value: i.uuid, label: i.name })))
const professionItems = computed(() => professionTreeItems(professions.value))
const stateItems = computed(() => states.value.map(s => ({ value: s.uuid, label: s.name })))
const cityItems = computed(() => cities.value.map(c => ({ value: c.uuid, label: c.name })))
const taxDocTypes = TAX_DOCUMENT_TYPES.map(v => ({ value: v, label: v }))
const docTypes = [{ value: 'V', label: 'V' }, { value: 'E', label: 'E' }]

const state = reactive({
  allyTypeUuid: '',
  name: '',
  taxDocumentType: 'J',
  taxDocumentNumber: '',
  professionUuid: '',
  firstName: '',
  lastName: '',
  documentType: 'V' as 'V' | 'E',
  documentNumber: '',
  mobile: '',
  email: '',
  stateUuid: '',
  cityUuid: '',
  password: '',
  passwordConfirm: '',
  benefitNote: '',
  acceptedPortalTerms: false,
  // Honeypot: hidden from people, bots fill it. Always sent as ''.
  homepage: '',
})

// The rubro must belong to the chosen segment: switching drops a foreign pick.
watch(segment, () => {
  if (state.allyTypeUuid && !allyTypeItems.value.some(i => i.value === state.allyTypeUuid)) state.allyTypeUuid = ''
})

watch(() => state.stateUuid, async (stateUuid) => {
  state.cityUuid = ''
  cities.value = []
  if (!stateUuid) return
  loadingCities.value = true
  cities.value = (await safeList('cities', { stateUuid })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  loadingCities.value = false
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function invalid(): string | null {
  const isB2B = segment.value === 'B2B'
  const missing = !state.allyTypeUuid || !state.firstName.trim() || !state.lastName.trim()
    || !state.documentNumber.trim() || !state.mobile.trim() || !state.email.trim() || !state.cityUuid
    || (isB2B && (!state.name.trim() || !state.taxDocumentNumber.trim()))
    || (!isB2B && !state.professionUuid)
  if (missing) return t('allyRequestForm.required')
  if (!/^\d{1,9}$/.test(state.documentNumber.trim())) return t('allyRequestForm.badDocument')
  if (isB2B && !/^[\d-]{5,15}$/.test(state.taxDocumentNumber.trim())) return t('allyRequestForm.badTaxDocument')
  if (!EMAIL_RE.test(state.email.trim())) return t('allyRequestForm.badEmail')
  if (state.password.length < 8) return t('allyRequestForm.shortPassword')
  if (state.password !== state.passwordConfirm) return t('allyRequestForm.passwordMismatch')
  if (!state.acceptedPortalTerms) return t('allyRequestForm.termsRequired')
  return null
}

function buildRequest(): AllyRequestCreateRequest {
  const isB2B = segment.value === 'B2B'
  return {
    segment: segment.value,
    allyTypeUuid: state.allyTypeUuid,
    // B2P: the name is optional (the backend derives "firstName lastName").
    name: state.name.trim() || undefined,
    taxDocumentType: isB2B ? state.taxDocumentType : undefined,
    taxDocumentNumber: isB2B ? state.taxDocumentNumber.trim() : undefined,
    professionUuid: isB2B ? undefined : state.professionUuid,
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    documentType: state.documentType,
    documentNumber: state.documentNumber.trim(),
    mobile: state.mobile.trim(),
    email: state.email.trim(),
    cityUuid: state.cityUuid,
    password: state.password,
    referralCode: referralCode.value || undefined,
    benefitNote: state.benefitNote.trim() || undefined,
    acceptedPortalTerms: true,
    homepage: '',
  }
}

const sending = ref(false)
const loggingIn = ref(false)
/** Backend codes that mean "you already have an account": offer the sign-in next to the message. */
const SIGN_IN_CODES = ['ally_request.email.taken', 'ally_request.document.has_account']
/** Existing account (409, or 422 with one of SIGN_IN_CODES): offer the sign-in next to the message. */
const conflictMessage = ref<string | null>(null)
const done = ref<AllyRequestCreatedDto | null>(null)

async function submit() {
  conflictMessage.value = null
  const error = invalid()
  if (error) {
    toast.add({ title: error, color: 'error' })
    return
  }
  sending.value = true
  let created: AllyRequestCreatedDto
  try {
    created = await useApi<AllyRequestCreatedDto>('/v1/public/ally-requests', {
      method: 'POST',
      skipAuth: true,
      body: buildRequest(),
    })
  }
  catch (err) {
    const e = err as ApiError
    // useApi already toasts 409/422; 400 (field validation) is left to the page.
    if (e.status === 400) toast.add({ title: e.message, color: 'error', icon: 'i-lucide-circle-alert' })
    // Existing email / cédula: 422 with problem.code — offer the sign-in.
    if (e.status === 409 || SIGN_IN_CODES.includes(String(e.problem?.code ?? ''))) conflictMessage.value = e.message
    sending.value = false
    return
  }

  // Straight into the ally portal with the credentials just chosen.
  loggingIn.value = true
  try {
    await login({ email: state.email.trim(), password: state.password })
    toast.add({ title: t('allyRequestForm.sentTitle'), description: t('allyRequestForm.welcomeToast'), color: 'success', icon: 'i-lucide-check-circle' })
    await router.push('/allies')
  }
  catch {
    done.value = created
  }
  finally {
    loggingIn.value = false
    sending.value = false
  }
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-2xl bg-white rounded-3xl border border-prohealth-100 shadow-sm p-8">
      <template v-if="done">
        <div class="text-center space-y-3">
          <UIcon name="i-lucide-mail-check" class="w-12 h-12 mx-auto text-green-500" />
          <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('allyRequestForm.sentTitle') }}</h1>
          <p class="text-sm text-prohealth-600">{{ t('allyRequestForm.sentBody', { email: done.email }) }}</p>
          <p v-if="done.promoterName" class="text-xs text-prohealth-500">{{ t('allyRequestForm.sentPromoter', { name: done.promoterName }) }}</p>
          <div class="flex flex-wrap justify-center gap-2 pt-2">
            <UButton :to="publicPath('/')" color="primary" icon="i-lucide-log-in">{{ t('allyRequestForm.signIn') }}</UButton>
            <UButton :to="publicPath('/aliados')" color="primary" variant="outline" icon="i-lucide-handshake">{{ t('allyRequestForm.backToAllies') }}</UButton>
          </div>
        </div>
      </template>

      <template v-else>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('allyRequestForm.title') }}</h1>
        <p class="text-sm text-prohealth-600 mt-1">{{ t('allyRequestForm.subtitle') }}</p>

        <div v-if="referralCode" class="mt-4 rounded-xl bg-cyan-50 border border-cyan-200 px-4 py-3 text-sm text-prohealth-800">
          {{ t('allyRequestForm.referredBy') }} <span class="font-mono font-bold">{{ referralCode }}</span>
        </div>

        <UAlert
          v-if="conflictMessage"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-user-check"
          :title="conflictMessage"
          :description="t('allyRequestForm.conflictHint')"
          :actions="[{ label: t('allyRequestForm.signIn'), color: 'primary', to: publicPath('/') }]"
        />

        <form class="mt-6 space-y-6" novalidate @submit.prevent="submit">
          <!-- Honeypot: off-screen, out of the tab order, never autofilled. -->
          <div class="absolute -left-[10000px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
            <label for="ally-request-homepage">Homepage</label>
            <input id="ally-request-homepage" v-model="state.homepage" type="text" name="homepage" tabindex="-1" autocomplete="off">
          </div>

          <UFormField :label="t('allyRequestForm.segmentLabel')" required>
            <URadioGroup v-model="segment" :items="segmentItems" orientation="horizontal" />
          </UFormField>

          <!-- Ally -->
          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <legend class="text-sm font-semibold text-prohealth-900 mb-2">{{ t('allyRequestForm.sections.ally') }}</legend>
            <UFormField :label="t('allyRequestForm.fields.allyType')" required class="sm:col-span-2">
              <USelectMenu
                v-model="state.allyTypeUuid"
                :items="allyTypeItems"
                label-key="label"
                value-key="value"
                :placeholder="t('allyRequestForm.fields.allyTypePlaceholder')"
                class="w-full"
              />
            </UFormField>
            <UFormField
              :label="segment === 'B2B' ? t('allyRequestForm.fields.name') : t('allyRequestForm.fields.nameB2P')"
              :help="segment === 'B2P' ? t('allyRequestForm.fields.nameB2PHelp') : undefined"
              :required="segment === 'B2B'"
              class="sm:col-span-2"
            >
              <UInput v-model="state.name" class="w-full" maxlength="150" autocomplete="organization" />
            </UFormField>
            <UFormField v-if="segment === 'B2B'" :label="t('allyRequestForm.fields.taxDocument')" required class="sm:col-span-2">
              <div class="flex gap-2">
                <USelect v-model="state.taxDocumentType" :items="taxDocTypes" class="w-20" />
                <UInput v-model="state.taxDocumentNumber" class="flex-1" maxlength="15" placeholder="12345678-9" />
              </div>
            </UFormField>
            <UFormField v-else :label="t('allyRequestForm.fields.profession')" required class="sm:col-span-2">
              <USelectMenu
                v-model="state.professionUuid"
                :items="professionItems"
                label-key="label"
                value-key="value"
                icon="i-lucide-search"
                :placeholder="t('allyRequestForm.fields.professionPlaceholder')"
                :search-input="{ placeholder: t('allyRequestForm.fields.professionSearch') }"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allyRequestForm.fields.state')" required>
              <USelectMenu
                v-model="state.stateUuid"
                :items="stateItems"
                label-key="label"
                value-key="value"
                :placeholder="t('allyRequestForm.fields.statePlaceholder')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allyRequestForm.fields.city')" required>
              <USelectMenu
                v-model="state.cityUuid"
                :items="cityItems"
                label-key="label"
                value-key="value"
                :loading="loadingCities"
                :disabled="!state.stateUuid"
                :placeholder="state.stateUuid ? t('allyRequestForm.fields.cityPlaceholder') : t('allyRequestForm.fields.selectStateFirst')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allyRequestForm.fields.benefitNote')" :help="t('allyRequestForm.fields.benefitNoteHelp')" class="sm:col-span-2">
              <UTextarea v-model="state.benefitNote" :rows="3" :maxlength="1000" class="w-full" />
            </UFormField>
          </fieldset>

          <!-- Contact / holder -->
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
            <UFormField :label="t('allyRequestForm.fields.password')" required>
              <UInput v-model="state.password" type="password" class="w-full" maxlength="128" autocomplete="new-password" />
            </UFormField>
            <UFormField :label="t('allyRequestForm.fields.passwordConfirm')" required>
              <UInput v-model="state.passwordConfirm" type="password" class="w-full" maxlength="128" autocomplete="new-password" />
            </UFormField>
          </fieldset>

          <UCheckbox v-model="state.acceptedPortalTerms" :label="t('allyRequestForm.termsAccept')" />
          <p class="text-xs text-prohealth-500">{{ t('allyRequestForm.reviewNote') }}</p>

          <UButton type="submit" block color="primary" :loading="sending" :disabled="!state.acceptedPortalTerms" icon="i-lucide-handshake">
            {{ loggingIn ? t('allyRequestForm.loggingIn') : t('allyRequestForm.submit') }}
          </UButton>
        </form>
      </template>
    </div>
  </div>
</template>
