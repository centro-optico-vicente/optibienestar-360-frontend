<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import type { ApiError } from '~/types/auth'
import type { PublicPlan, PublicTerms } from '~/types/registration'
import { PLAN_TYPES } from '~/types/plans'
import { TERM_TYPES } from '~/types/terms'

// "Afiliar persona" (hub ADR 0037 §5): assisted affiliation on the advisor's own device. It reuses the steps of the
// self-registration wizard in one screen: personal data (birth date as 3 selects), plan and the contract rendered
// with the typed data, which the person reads and accepts on screen. POST /v1/advisors/me/affiliation-requests,
// AFFILIATION_REQUEST_CREATE_ASSISTED. The payment is reported later from the person's portal or the advisor's
// collections screen.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'AFFILIATION_REQUEST_CREATE_ASSISTED',
})

const { t } = useI18n()
const toast = useToast()
const { formatCurrency } = useFormatters()
const api = useAffiliationRequests()
const { isAccountExists } = useRegistrationStart()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('assistedAffiliation.title') }) })

const docTypes = [{ value: 'V', label: 'V' }, { value: 'E', label: 'E' }]
const state = reactive({
  firstName: '', lastName: '', documentType: 'V', documentNumber: '', birthDate: '',
  email: '', phone: '', planUuid: '',
})
const accepted = ref(false)
const sending = ref(false)
const accountExists = ref<string | null>(null)
const done = ref<{ email: string } | null>(null)

// ---- Plans ----
const plans = ref<PublicPlan[]>([])
onMounted(async () => {
  try {
    const res = await useApi<PublicPlan[] | { content: PublicPlan[] }>('/v1/public/plans', { skipAuth: true, silent: true })
    plans.value = (Array.isArray(res) ? res : res.content ?? [])
      .filter(p => p.type !== PLAN_TYPES.CORPORATE && (p.minMembers == null || p.minMembers <= 1))
  }
  catch {
    plans.value = []
  }
  await loadTerms()
})
const planItems = computed(() => plans.value.map(p => ({
  value: p.uuid,
  label: [p.name, p.monthlyFee != null ? `${formatCurrency(Number(p.monthlyFee), p.currency_Code || 'USD')} / ${t('affiliationRequest.month')}` : ''].filter(Boolean).join(' · '),
})))

// ---- Contract: re-rendered with the typed data, accepted on screen ----
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
const terms = ref<PublicTerms | null>(null)
const previewMarkdown = ref<string | null>(null)
const termsHtml = computed(() => DOMPurify.sanitize(md.render(previewMarkdown.value ?? terms.value?.contentMarkdown ?? '')))

async function loadTerms() {
  try {
    terms.value = await useApi<PublicTerms>(`/v1/public/terms/${TERM_TYPES.MEMBER}`, { skipAuth: true, silent: true })
  }
  catch {
    terms.value = null
  }
}

let previewSeq = 0
async function refreshPreview() {
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
      },
    })
    if (seq !== previewSeq) return
    if (terms.value && res.uuid !== terms.value.uuid) {
      terms.value = res
      accepted.value = false
    }
    previewMarkdown.value = res.contentMarkdown
  }
  catch {
    if (seq === previewSeq) previewMarkdown.value = null
  }
}
const debouncedPreview = useSearchDebounce(refreshPreview)
watch(() => [state.firstName, state.lastName, state.documentType, state.documentNumber, state.birthDate, state.planUuid], () => {
  // A change in the data makes the previous acceptance void: the person reads it again.
  accepted.value = false
  debouncedPreview()
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function invalid(): string | null {
  if (!state.firstName.trim() || !state.lastName.trim() || !state.documentNumber.trim() || !state.birthDate || !state.email.trim() || !state.planUuid) {
    return t('affiliationRequest.required')
  }
  if (!/^\d{1,9}$/.test(state.documentNumber.trim())) return t('affiliationRequest.badDocument')
  if (!EMAIL_RE.test(state.email.trim())) return t('registration.step1.badEmail')
  if (!terms.value) return t('affiliationRequest.termsUnavailable')
  if (!accepted.value) return t('assistedAffiliation.acceptRequired')
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
    const res = await api.createAssisted({
      firstName: state.firstName.trim(),
      lastName: state.lastName.trim(),
      documentType: state.documentType,
      documentNumber: state.documentNumber.trim(),
      birthDate: state.birthDate,
      email: state.email.trim(),
      phone: state.phone.trim() || undefined,
      planUuid: state.planUuid,
      termsVersionUuid: terms.value!.uuid,
      contractAccepted: true,
    })
    done.value = { email: res.email ?? state.email.trim() }
  }
  catch (err) {
    if (isAccountExists(err)) accountExists.value = (err as ApiError).message
    // Otherwise useApi already showed the backend's reason; a newer contract published meanwhile is rejected.
    else await loadTerms()
  }
  finally {
    sending.value = false
  }
}

function another() {
  Object.assign(state, { firstName: '', lastName: '', documentType: 'V', documentNumber: '', birthDate: '', email: '', phone: '', planUuid: '' })
  accepted.value = false
  done.value = null
  previewMarkdown.value = null
}
</script>

<template>
  <div class="space-y-5 max-w-2xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('assistedAffiliation.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('assistedAffiliation.subtitle') }}</p>
    </div>

    <div v-if="done" class="bg-white rounded-2xl border border-prohealth-100 p-6 text-center space-y-3">
      <UIcon name="i-lucide-circle-check" class="w-12 h-12 mx-auto text-green-500" />
      <h2 class="text-xl font-extrabold text-prohealth-900">{{ t('assistedAffiliation.doneTitle') }}</h2>
      <p class="text-sm text-prohealth-600">{{ t('assistedAffiliation.doneBody', { email: done.email }) }}</p>
      <div class="flex flex-wrap justify-center gap-2">
        <UButton color="primary" icon="i-lucide-user-plus" @click="another">{{ t('assistedAffiliation.another') }}</UButton>
        <UButton to="/advisors/affiliation-requests" color="neutral" variant="outline" icon="i-lucide-list">{{ t('assistedAffiliation.seeRequests') }}</UButton>
      </div>
    </div>

    <form v-else class="bg-white rounded-2xl border border-prohealth-100 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4" novalidate @submit.prevent="submit">
      <RegistrationAccountExists v-if="accountExists" class="sm:col-span-2" :message="accountExists" />
      <UFormField :label="t('affiliationRequest.firstName')" required>
        <UInput v-model="state.firstName" class="w-full" maxlength="50" />
      </UFormField>
      <UFormField :label="t('affiliationRequest.lastName')" required>
        <UInput v-model="state.lastName" class="w-full" maxlength="50" />
      </UFormField>
      <UFormField :label="t('affiliationRequest.document')" required>
        <div class="flex gap-2">
          <USelect v-model="state.documentType" :items="docTypes" class="w-20" />
          <UInput v-model="state.documentNumber" class="flex-1" maxlength="9" inputmode="numeric" placeholder="12345678" />
        </div>
      </UFormField>
      <UFormField :label="t('affiliationRequest.birthDate')" required>
        <BirthDateSelects v-model="state.birthDate" />
      </UFormField>
      <UFormField :label="t('affiliationRequest.email')" :help="t('assistedAffiliation.emailHelp')" required>
        <UInput v-model="state.email" type="email" class="w-full" maxlength="254" />
      </UFormField>
      <UFormField :label="t('affiliationRequest.phone')">
        <UInput v-model="state.phone" class="w-full" maxlength="30" />
      </UFormField>
      <UFormField :label="t('affiliationRequest.plan')" required class="sm:col-span-2">
        <USelect v-model="state.planUuid" :items="planItems" :placeholder="t('affiliationRequest.planPlaceholder')" class="w-full" />
      </UFormField>

      <div class="sm:col-span-2 rounded-xl border border-prohealth-100 p-4 space-y-3">
        <p class="text-sm font-semibold text-prohealth-900">{{ t('affiliationRequest.termsTitle') }}</p>
        <p v-if="!terms" class="text-sm text-red-600">{{ t('affiliationRequest.termsUnavailable') }}</p>
        <template v-else>
          <p class="text-xs text-prohealth-500">{{ t('assistedAffiliation.contractHint') }}</p>
          <div class="terms-content max-h-72 overflow-y-auto rounded-lg border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm text-prohealth-800" v-html="termsHtml" />
          <UCheckbox v-model="accepted" :label="t('assistedAffiliation.accept', { title: terms.title })" />
        </template>
      </div>

      <UButton type="submit" block color="primary" :loading="sending" :disabled="!terms || !accepted" icon="i-lucide-user-plus" class="sm:col-span-2">
        {{ t('assistedAffiliation.submit') }}
      </UButton>
    </form>
  </div>
</template>

<style scoped>
.terms-content :deep(h1) { font-size: 1.2rem; font-weight: 800; margin: 0.6em 0 0.4em; }
.terms-content :deep(h2) { font-size: 1.05rem; font-weight: 700; margin: 0.6em 0 0.4em; }
.terms-content :deep(p) { margin: 0.5em 0; line-height: 1.6; }
.terms-content :deep(ul), .terms-content :deep(ol) { margin: 0.4em 0 0.4em 1.3em; }
.terms-content :deep(li) { margin: 0.2em 0; }
</style>
