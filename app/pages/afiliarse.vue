<script setup lang="ts">
// Public self-affiliation — the landing of every advisor QR
// (/afiliarse?ref=<referral code>). POST /v1/public/affiliation-requests stores
// a request that staff review (backend V188): the login, the member and the
// membership (suspended until the first payment) are created only when it is
// approved, and the applicant is told by email. The password chosen here is
// the one they will log in with.
// The request must carry the uuid of the current public AFILIADO terms
// (GET /v1/public/terms/AFILIADO). While the form is filled, the contract is
// re-rendered with the typed data (POST /v1/public/terms/AFILIADO/preview,
// debounced); if the preview fails the plain public text is shown instead.
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { PLAN_TYPES } from '~/types/plans'
import { TERM_TYPES } from '~/types/terms'

// English pair of this public screen (hub URL convention): same page, rendered
// in English by middleware/public-locale.global.ts. The printed QRs keep
// /afiliarse?ref=CODE; /en/join?ref=CODE reads the same query. The fixed `key`
// keeps the half-filled form when the switcher jumps between the two URLs.
definePageMeta({ layout: 'default', alias: ['/en/join'], key: 'public-join' })

interface PublicPlan {
  uuid: string
  name: string
  type?: string | null
  monthlyFee?: number | string | null
  inscriptionFee?: number | string | null
  currency_Code?: string | null
  minMembers?: number | null
}

interface PublicTerms {
  uuid: string
  title: string
  contentMarkdown: string
}

const { t } = useI18n()
const publicPath = usePublicPath()
const route = useRoute()
const toast = useToast()
const { formatCurrency } = useFormatters()

useSeoMeta({ title: () => t('affiliationRequest.seoTitle') })

const referralCode = computed(() => String(route.query.ref ?? '').trim().toUpperCase().slice(0, 20))

// Group plans (corporate, or any plan with a minimum headcount) are sold through
// a corporate contract, never to a single person on this page.
function isSelfServicePlan(p: PublicPlan): boolean {
  return p.type !== PLAN_TYPES.CORPORATE && (p.minMembers == null || p.minMembers <= 1)
}

const plans = ref<PublicPlan[]>([])
onMounted(async () => {
  loadTerms()
  try {
    const res = await useApi<PublicPlan[] | { content: PublicPlan[] }>('/v1/public/plans', { skipAuth: true })
    const all = Array.isArray(res) ? res : res.content ?? []
    plans.value = all.filter(isSelfServicePlan)
    if (plans.value.length === 1) state.planUuid = plans.value[0]!.uuid
  }
  catch {
    plans.value = []
  }
})

function money(value: number | string | null | undefined, currency?: string | null): string {
  return formatCurrency(Number(value), currency || 'USD')
}

const selectedPlan = computed(() => plans.value.find(p => p.uuid === state.planUuid) ?? null)

const planItems = computed(() => plans.value.map((p) => {
  const parts = [p.name]
  if (p.inscriptionFee != null) parts.push(`${t('affiliationRequest.inscription')} ${money(p.inscriptionFee, p.currency_Code)}`)
  if (p.monthlyFee != null) parts.push(`${money(p.monthlyFee, p.currency_Code)} / ${t('affiliationRequest.month')}`)
  return { value: p.uuid, label: parts.join(' · ') }
}))

// Current public AFILIADO terms — shown, accepted and sent as termsVersionUuid.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
const terms = ref<PublicTerms | null>(null)
const termsUnavailable = ref(false)
const termsOpen = ref(false)
const termsAccepted = ref(false)
// The same contract rendered with the form data; null = not available yet
// (or the preview failed) → the plain public text is shown.
const previewMarkdown = ref<string | null>(null)
const termsHtml = computed(() =>
  DOMPurify.sanitize(md.render(previewMarkdown.value ?? terms.value?.contentMarkdown ?? '')))

async function loadTerms(): Promise<void> {
  try {
    const previous = terms.value?.uuid
    terms.value = await useApi<PublicTerms>(`/v1/public/terms/${TERM_TYPES.MEMBER}`, { skipAuth: true })
    termsUnavailable.value = false
    previewMarkdown.value = null
    if (previous && previous !== terms.value.uuid) {
      termsAccepted.value = false
      termsOpen.value = true
      toast.add({ title: t('affiliationRequest.termsUpdated'), color: 'warning' })
    }
    refreshPreview()
  }
  catch {
    terms.value = null
    termsUnavailable.value = true
  }
}
const docTypes = [{ value: 'V', label: 'V' }, { value: 'E', label: 'E' }]

const state = reactive({
  firstName: '', lastName: '', documentType: 'V', documentNumber: '', birthDate: '',
  email: '', phone: '', password: '', passwordConfirm: '', planUuid: '',
})
const sending = ref(false)
const done = ref<{ email: string, advisorName?: string | null } | null>(null)

// ---- Live contract preview ----
let previewSeq = 0
async function refreshPreview(): Promise<void> {
  if (!terms.value) return
  const seq = ++previewSeq
  try {
    const res = await useApi<PublicTerms>(`/v1/public/terms/${TERM_TYPES.MEMBER}/preview`, {
      method: 'POST',
      skipAuth: true,
      silent: true,
      body: {
        firstName: state.firstName.trim() || undefined,
        lastName: state.lastName.trim() || undefined,
        documentType: state.documentType || undefined,
        documentNumber: state.documentNumber.trim() || undefined,
        birthDate: state.birthDate || undefined,
        planUuid: state.planUuid || undefined,
        // The advisor of the QR/link shows in the contract preview (same code as the request).
        referralCode: referralCode.value || undefined,
      },
    })
    if (seq !== previewSeq) return
    if (terms.value && res.uuid !== terms.value.uuid) {
      // A new version went live while the form was open: reload it so the
      // applicant reads and accepts the current one.
      await loadTerms()
      return
    }
    previewMarkdown.value = res.contentMarkdown
  }
  catch {
    if (seq === previewSeq) previewMarkdown.value = null
  }
}
const debouncedPreview = useSearchDebounce(refreshPreview)
watch(
  () => [state.firstName, state.lastName, state.documentType, state.documentNumber, state.birthDate, state.planUuid, referralCode.value],
  () => { debouncedPreview() },
)

function invalid(): string | null {
  if (!state.firstName.trim() || !state.lastName.trim() || !state.documentNumber.trim() || !state.birthDate || !state.email.trim() || !state.planUuid) {
    return t('affiliationRequest.required')
  }
  if (!/^\d{1,9}$/.test(state.documentNumber.trim())) return t('affiliationRequest.badDocument')
  if (state.password.length < 8) return t('affiliationRequest.shortPassword')
  if (state.password !== state.passwordConfirm) return t('affiliationRequest.passwordMismatch')
  if (!terms.value) return t('affiliationRequest.termsUnavailable')
  if (!termsAccepted.value) return t('affiliationRequest.termsRequired')
  return null
}

async function submit() {
  const error = invalid()
  if (error) {
    toast.add({ title: error, color: 'error' })
    return
  }
  sending.value = true
  try {
    const res = await useApi<{ uuid: string, status: string, email: string, advisorName?: string | null }>('/v1/public/affiliation-requests', {
      method: 'POST',
      skipAuth: true,
      body: {
        firstName: state.firstName.trim(),
        lastName: state.lastName.trim(),
        documentType: state.documentType,
        documentNumber: state.documentNumber.trim(),
        birthDate: state.birthDate,
        email: state.email.trim(),
        phone: state.phone.trim() || undefined,
        password: state.password,
        planUuid: state.planUuid,
        referralCode: referralCode.value || undefined,
        termsVersionUuid: terms.value!.uuid,
      },
    })
    done.value = res
  }
  catch {
    // useApi already shows the backend's localized error toast. A newer terms
    // version published meanwhile is rejected: reload so the user re-accepts it.
    await loadTerms()
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-xl bg-white rounded-3xl border border-prohealth-100 shadow-sm p-8">
      <template v-if="done">
        <div class="text-center space-y-3">
          <UIcon name="i-lucide-mail-check" class="w-12 h-12 mx-auto text-green-500" />
          <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('affiliationRequest.sentTitle') }}</h1>
          <p class="text-sm text-prohealth-600">{{ t('affiliationRequest.sentBody', { email: done.email }) }}</p>
          <p v-if="done.advisorName" class="text-xs text-prohealth-500">{{ t('affiliationRequest.sentPromoter', { name: done.advisorName }) }}</p>
          <UButton :to="publicPath('/')" color="primary" variant="outline" icon="i-lucide-house" class="mt-2">{{ t('affiliationRequest.backHome') }}</UButton>
        </div>
      </template>

      <template v-else>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('affiliationRequest.title') }}</h1>
        <p class="text-sm text-prohealth-600 mt-1">{{ t('affiliationRequest.subtitle') }}</p>

        <div v-if="referralCode" class="mt-4 rounded-xl bg-cyan-50 border border-cyan-200 px-4 py-3 text-sm text-prohealth-800">
          {{ t('affiliationRequest.referredBy') }} <span class="font-mono font-bold">{{ referralCode }}</span>
        </div>

        <form class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="submit">
          <UFormField :label="t('affiliationRequest.firstName')" required>
            <UInput v-model="state.firstName" class="w-full" maxlength="50" autocomplete="given-name" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.lastName')" required>
            <UInput v-model="state.lastName" class="w-full" maxlength="50" autocomplete="family-name" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.document')" required>
            <div class="flex gap-2">
              <USelect v-model="state.documentType" :items="docTypes" class="w-20" />
              <UInput v-model="state.documentNumber" class="flex-1" maxlength="9" inputmode="numeric" placeholder="12345678" />
            </div>
          </UFormField>
          <UFormField :label="t('affiliationRequest.birthDate')" required>
            <UInput v-model="state.birthDate" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.email')" required>
            <UInput v-model="state.email" type="email" class="w-full" maxlength="254" autocomplete="email" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.phone')">
            <UInput v-model="state.phone" class="w-full" maxlength="30" autocomplete="tel" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.password')" required>
            <UInput v-model="state.password" type="password" class="w-full" maxlength="128" autocomplete="new-password" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.passwordConfirm')" required>
            <UInput v-model="state.passwordConfirm" type="password" class="w-full" maxlength="128" autocomplete="new-password" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.plan')" required class="sm:col-span-2">
            <USelect v-model="state.planUuid" :items="planItems" :placeholder="t('affiliationRequest.planPlaceholder')" class="w-full" />
          </UFormField>
          <!-- The select's option labels can't host the converter button, so the chosen plan's fees are repeated here. -->
          <div v-if="selectedPlan && (selectedPlan.inscriptionFee != null || selectedPlan.monthlyFee != null)" class="sm:col-span-2 -mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-prohealth-700">
            <CurrencyConverterDisplay v-if="selectedPlan.inscriptionFee != null" :amount="selectedPlan.inscriptionFee" :currency="selectedPlan.currency_Code || 'USD'" v-slot="{ result }">
              <span class="inline-flex items-center gap-1">
                {{ t('affiliationRequest.inscription') }}: <strong>{{ money(selectedPlan.inscriptionFee, selectedPlan.currency_Code) }}</strong>
                <CurrencyConverterTrigger :result="result" />
              </span>
            </CurrencyConverterDisplay>
            <CurrencyConverterDisplay v-if="selectedPlan.monthlyFee != null" :amount="selectedPlan.monthlyFee" :currency="selectedPlan.currency_Code || 'USD'" v-slot="{ result }">
              <span class="inline-flex items-center gap-1">
                <strong>{{ money(selectedPlan.monthlyFee, selectedPlan.currency_Code) }}</strong> / {{ t('affiliationRequest.month') }}
                <CurrencyConverterTrigger :result="result" />
              </span>
            </CurrencyConverterDisplay>
          </div>
          <div class="sm:col-span-2 rounded-xl border border-prohealth-100 p-4 space-y-3">
            <p class="text-sm font-semibold text-prohealth-900">{{ t('affiliationRequest.termsTitle') }}</p>
            <p v-if="termsUnavailable" class="text-sm text-red-600">{{ t('affiliationRequest.termsUnavailable') }}</p>
            <template v-else-if="terms">
              <UButton
                variant="link"
                color="primary"
                size="xs"
                :icon="termsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="px-0"
                @click="termsOpen = !termsOpen"
              >
                {{ termsOpen ? t('affiliationRequest.termsHide') : t('affiliationRequest.termsShow') }}
              </UButton>
              <p v-if="termsOpen" class="text-xs text-prohealth-500">{{ t('affiliationRequest.termsLiveNote') }}</p>
              <div
                v-if="termsOpen"
                class="terms-content max-h-72 overflow-y-auto rounded-lg border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm text-prohealth-800"
                v-html="termsHtml"
              />
              <UCheckbox v-model="termsAccepted" :label="t('affiliationRequest.termsAccept', { title: terms.title })" />
            </template>
          </div>
          <p class="sm:col-span-2 text-xs text-prohealth-500">{{ t('affiliationRequest.activationNote') }}</p>
          <UButton type="submit" block color="primary" :loading="sending" :disabled="!terms || !termsAccepted" icon="i-lucide-user-plus" class="sm:col-span-2">
            {{ t('affiliationRequest.submit') }}
          </UButton>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.terms-content :deep(h1) { font-size: 1.2rem; font-weight: 800; margin: 0.6em 0 0.4em; }
.terms-content :deep(h2) { font-size: 1.05rem; font-weight: 700; margin: 0.6em 0 0.4em; }
.terms-content :deep(p) { margin: 0.5em 0; line-height: 1.6; }
.terms-content :deep(ul), .terms-content :deep(ol) { margin: 0.4em 0 0.4em 1.3em; }
.terms-content :deep(li) { margin: 0.2em 0; }
.terms-content :deep(strong) { font-weight: 700; }
</style>
