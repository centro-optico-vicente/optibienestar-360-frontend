<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import type { ApiError } from '~/types/auth'
import type { AffiliationRequestDetailDto, AffiliationRequestLogDto } from '~/types/affiliationRequests'
import { affiliationRequestStatusColor } from '~/types/affiliationRequests'
import { PLAN_TYPES } from '~/types/plans'

// Review of one public affiliation request (backend V188). While PENDING the
// reviewer may correct the data (PUT, logged field by field), approve it
// (creates the login, the member and the suspended membership) or reject it
// with a mandatory reason (modal, emailed to the applicant). Shows the
// contract exactly as the applicant accepted it; when a correction changes
// that text, approving leaves it pending for the member's first login.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'AFFILIATION_REQUEST_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()
const { can } = usePermissions()
const toast = useToast()
const route = useRoute()
const requestUuid = route.params.uuid as string

useSeoMeta({ title: () => t('common.seoTitle', { page: t('affiliationRequests.detail.seoPage') }) })

const api = useAffiliationRequests()

const request = ref<AffiliationRequestDetailDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function load() {
  loading.value = true
  try {
    request.value = await api.get(requestUuid)
    resetForm()
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    request.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  loadPlans()
})

const isPending = computed(() => request.value?.status === 'PENDING')
const canUpdate = computed(() => can('AFFILIATION_REQUEST_UPDATE'))
const editable = computed(() => isPending.value && canUpdate.value)

// ---- Contract ----
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
const contractHtml = computed(() => DOMPurify.sanitize(md.render(request.value?.termsRenderedContent ?? '')))

// ---- Editable data (PENDING only) ----
interface PublicPlan { uuid: string, name: string, type?: string | null, minMembers?: number | null }
const plans = ref<PublicPlan[]>([])
async function loadPlans() {
  try {
    const res = await useApi<PublicPlan[] | { content: PublicPlan[] }>('/v1/public/plans', { skipAuth: true, silent: true })
    const all = Array.isArray(res) ? res : res.content ?? []
    plans.value = all.filter(p => p.type !== PLAN_TYPES.CORPORATE && (p.minMembers == null || p.minMembers <= 1))
  }
  catch {
    plans.value = []
  }
}
const planItems = computed(() => {
  const items = plans.value.map(p => ({ value: p.uuid, label: p.name }))
  const current = request.value
  if (current?.plan_Uuid && !items.some(i => i.value === current.plan_Uuid)) {
    items.unshift({ value: current.plan_Uuid, label: current.plan_Display ?? current.plan_Uuid })
  }
  return items
})
const docTypes = [{ value: 'V', label: 'V' }, { value: 'E', label: 'E' }]

const form = reactive({
  firstName: '', lastName: '', documentType: 'V', documentNumber: '', birthDate: '',
  email: '', phone: '', planUuid: '', comment: '',
  // Term overrides (hub ADR 0034): empty / 'inherit' = the plan decides
  expiresAt: '', reinscription: 'inherit' as 'inherit' | 'yes' | 'no',
})

const reinscriptionItems = computed(() => [
  { value: 'inherit', label: t('memberships.term.inherit') },
  { value: 'yes', label: t('common.yes') },
  { value: 'no', label: t('common.no') },
])
function reinscriptionOf(v: boolean | null | undefined): 'inherit' | 'yes' | 'no' {
  return v == null ? 'inherit' : v ? 'yes' : 'no'
}

function resetForm() {
  const r = request.value
  if (!r) return
  Object.assign(form, {
    firstName: r.firstName,
    lastName: r.lastName,
    documentType: r.documentType,
    documentNumber: r.documentNumber,
    birthDate: r.birthDate,
    email: r.email,
    phone: r.phone ?? '',
    planUuid: r.plan_Uuid ?? '',
    comment: '',
    expiresAt: r.expiresAtOverride ?? '',
    reinscription: reinscriptionOf(r.reinscriptionRequiredOverride),
  })
}

const dirty = computed(() => {
  const r = request.value
  if (!r) return false
  return form.firstName.trim() !== r.firstName
    || form.lastName.trim() !== r.lastName
    || form.documentType !== r.documentType
    || form.documentNumber.trim() !== r.documentNumber
    || form.birthDate !== r.birthDate
    || form.email.trim().toLowerCase() !== r.email
    || (form.phone.trim() || null) !== (r.phone ?? null)
    || form.planUuid !== (r.plan_Uuid ?? '')
    || form.expiresAt !== (r.expiresAtOverride ?? '')
    || form.reinscription !== reinscriptionOf(r.reinscriptionRequiredOverride)
})

const saving = ref(false)
async function save() {
  if (!request.value) return
  if (!form.firstName.trim() || !form.lastName.trim() || !form.documentNumber.trim() || !form.birthDate || !form.email.trim() || !form.planUuid) {
    toast.add({ title: t('affiliationRequests.detail.required'), color: 'error' })
    return
  }
  saving.value = true
  try {
    request.value = await api.update(request.value.uuid, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim(),
      birthDate: form.birthDate,
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      planUuid: form.planUuid,
      comment: form.comment.trim() || undefined,
      // Full replace on the backend: always send the current override values.
      expiresAt: form.expiresAt || null,
      reinscriptionRequired: form.reinscription === 'inherit' ? null : form.reinscription === 'yes',
    })
    resetForm()
    toast.add({ title: t('affiliationRequests.detail.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch { /* toast handled by useApi */ }
  finally { saving.value = false }
}

// ---- Approve ----
const approveOpen = ref(false)
const approveComment = ref('')
const approving = ref(false)
function openApprove() {
  approveComment.value = ''
  approveOpen.value = true
}
async function confirmApprove() {
  if (!request.value) return
  approving.value = true
  try {
    request.value = await api.approve(request.value.uuid, approveComment.value.trim() || undefined)
    resetForm()
    approveOpen.value = false
    toast.add({ title: t('affiliationRequests.detail.approvedToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch { /* toast handled by useApi */ }
  finally { approving.value = false }
}

// ---- Reject ----
const rejectOpen = ref(false)
const rejectReason = ref('')
const rejectTouched = ref(false)
const rejecting = ref(false)
const rejectError = computed(() =>
  rejectTouched.value && !rejectReason.value.trim() ? t('validation.required') : undefined)
function openReject() {
  rejectReason.value = ''
  rejectTouched.value = false
  rejectOpen.value = true
}
async function confirmReject() {
  rejectTouched.value = true
  const reason = rejectReason.value.trim()
  if (!request.value || !reason) return
  rejecting.value = true
  try {
    request.value = await api.reject(request.value.uuid, reason)
    resetForm()
    rejectOpen.value = false
    toast.add({ title: t('affiliationRequests.detail.rejectedToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch { /* toast handled by useApi */ }
  finally { rejecting.value = false }
}

// ---- Log ----
function logTitle(entry: AffiliationRequestLogDto): string {
  return entry.action_Display ?? t(`affiliationRequests.log.actions.${entry.action}`, entry.action)
}
function fieldLabel(field: string): string {
  return t(`affiliationRequests.fields.${field}`, field)
}
function statusLabel(r: AffiliationRequestDetailDto): string {
  return r.status_Display ?? t(`affiliationRequests.status.${r.status}`, r.status)
}
</script>

<template>
  <div class="space-y-5">
    <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" to="/dashboard/affiliation-requests" size="sm">
      {{ t('affiliationRequests.title') }}
    </UButton>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <div v-else-if="notFound || !request" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('affiliationRequests.detail.notFoundTitle') }}</p>
    </div>

    <template v-else>
      <!-- Header + actions -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ request.fullName }}</h1>
              <UBadge :color="affiliationRequestStatusColor(request.status)" variant="subtle">{{ statusLabel(request) }}</UBadge>
            </div>
            <p class="text-sm text-prohealth-600 mt-1">
              {{ t('affiliationRequests.detail.receivedAt', { date: request.createdAt_Display ?? formatDate(request.createdAt, 'datetime') }) }}
              <template v-if="request.advisor_Display"> · {{ t('affiliationRequests.detail.viaAdvisor', { name: request.advisor_Display }) }}</template>
            </p>
            <p v-if="request.reviewedAt" class="text-xs text-prohealth-500 mt-1">
              {{ t('affiliationRequests.detail.reviewedBy', { name: request.reviewedBy_Display ?? t('common.empty'), date: request.reviewedAt_Display ?? formatDate(request.reviewedAt, 'datetime') }) }}
            </p>
          </div>
          <div v-if="isPending" class="flex items-center gap-2">
            <UButton v-can="'AFFILIATION_REQUEST_REJECT'" color="error" variant="outline" icon="i-lucide-x" @click="openReject">
              {{ t('affiliationRequests.detail.reject') }}
            </UButton>
            <UButton v-can="'AFFILIATION_REQUEST_APPROVE'" color="success" icon="i-lucide-check" :disabled="dirty" @click="openApprove">
              {{ t('affiliationRequests.detail.approve') }}
            </UButton>
          </div>
          <div v-else-if="request.status === 'APPROVED' && request.member_Uuid">
            <UButton v-can="'MEMBER_VIEW_ALL'" color="neutral" variant="outline" icon="i-lucide-user" :to="`/dashboard/members/${request.member_Uuid}`">
              {{ t('affiliationRequests.detail.viewMember') }}
            </UButton>
          </div>
        </div>

        <UAlert
          v-if="isPending && request.termsChanged"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-file-warning"
          :title="t('affiliationRequests.detail.termsChangedTitle')"
          :description="t('affiliationRequests.detail.termsChangedBody')"
        />
        <UAlert
          v-if="request.status === 'REJECTED' && request.rejectionReason"
          class="mt-4"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-x"
          :title="t('affiliationRequests.detail.rejectionReason')"
          :description="request.rejectionReason"
        />
        <p v-if="isPending && dirty" class="text-xs text-prohealth-500 mt-3">{{ t('affiliationRequests.detail.saveBeforeApprove') }}</p>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <!-- Applicant data -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
          <h2 class="text-lg font-bold text-prohealth-900">{{ t('affiliationRequests.detail.dataTitle') }}</h2>
          <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="save">
            <UFormField :label="t('affiliationRequests.fields.firstName')" required>
              <UInput v-model="form.firstName" class="w-full" maxlength="50" :disabled="!editable" />
            </UFormField>
            <UFormField :label="t('affiliationRequests.fields.lastName')" required>
              <UInput v-model="form.lastName" class="w-full" maxlength="50" :disabled="!editable" />
            </UFormField>
            <UFormField :label="t('affiliationRequests.fields.documentNumber')" required>
              <div class="flex gap-2">
                <USelect v-model="form.documentType" :items="docTypes" class="w-20" :disabled="!editable" />
                <UInput v-model="form.documentNumber" class="flex-1" maxlength="9" inputmode="numeric" :disabled="!editable" />
              </div>
            </UFormField>
            <UFormField :label="t('affiliationRequests.fields.birthDate')" required>
              <UInput v-model="form.birthDate" type="date" class="w-full" :disabled="!editable" />
            </UFormField>
            <UFormField :label="t('affiliationRequests.fields.email')" required>
              <UInput v-model="form.email" type="email" class="w-full" maxlength="254" :disabled="!editable" />
            </UFormField>
            <UFormField :label="t('affiliationRequests.fields.phone')">
              <UInput v-model="form.phone" class="w-full" maxlength="30" :disabled="!editable" />
            </UFormField>
            <UFormField :label="t('affiliationRequests.fields.plan')" required class="sm:col-span-2">
              <USelect v-model="form.planUuid" :items="planItems" class="w-full" :disabled="!editable" />
            </UFormField>
            <UFormField :label="t('affiliationRequests.fields.expiresAt')" :help="t('affiliationRequests.detail.expiresAtHelp')">
              <UInput v-model="form.expiresAt" type="date" class="w-full" :disabled="!editable" />
            </UFormField>
            <UFormField :label="t('affiliationRequests.fields.reinscriptionRequired')" :help="t('affiliationRequests.detail.reinscriptionHelp')">
              <USelect v-model="form.reinscription" :items="reinscriptionItems" class="w-full" :disabled="!editable" />
            </UFormField>
            <template v-if="editable">
              <UFormField :label="t('affiliationRequests.detail.comment')" class="sm:col-span-2">
                <UTextarea v-model="form.comment" :rows="2" :maxlength="2000" class="w-full" />
              </UFormField>
              <div class="sm:col-span-2 flex items-center justify-end gap-2">
                <UButton color="neutral" variant="ghost" :disabled="!dirty || saving" @click="resetForm">{{ t('common.cancel') }}</UButton>
                <UButton type="submit" color="primary" icon="i-lucide-save" :loading="saving" :disabled="!dirty">{{ t('common.saveChanges') }}</UButton>
              </div>
            </template>
          </form>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm pt-2 border-t border-prohealth-100">
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('affiliationRequests.fields.referralCode') }}</dt>
              <dd class="font-mono text-prohealth-800">{{ request.referralCode || t('common.empty') }}</dd>
            </div>
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('affiliationRequests.fields.advisor') }}</dt>
              <dd class="text-prohealth-800">{{ request.advisor_Display ?? t('common.empty') }}</dd>
            </div>
          </dl>
        </div>

        <!-- Accepted contract -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
          <h2 class="text-lg font-bold text-prohealth-900">{{ t('affiliationRequests.detail.contractTitle') }}</h2>
          <p class="text-xs text-prohealth-500">
            {{ t('affiliationRequests.detail.contractAccepted', {
              title: request.termsVersion_Display ?? t('common.empty'),
              date: request.termsAcceptedAt_Display ?? formatDate(request.termsAcceptedAt, 'datetime'),
            }) }}
          </p>
          <div
            class="terms-content max-h-[28rem] overflow-y-auto rounded-lg border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm text-prohealth-800"
            v-html="contractHtml"
          />
          <dl class="grid grid-cols-1 gap-y-1 text-xs text-prohealth-500">
            <div><dt class="inline font-semibold">{{ t('affiliationRequests.detail.ipAddress') }}:</dt> <dd class="inline font-mono">{{ request.ipAddress || t('common.empty') }}</dd></div>
            <div><dt class="inline font-semibold">{{ t('affiliationRequests.detail.userAgent') }}:</dt> <dd class="inline break-all">{{ request.userAgent || t('common.empty') }}</dd></div>
            <div><dt class="inline font-semibold">SHA-256:</dt> <dd class="inline font-mono break-all">{{ request.termsContentSha256 }}</dd></div>
          </dl>
        </div>
      </div>

      <!-- Review log -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
        <h2 class="text-lg font-bold text-prohealth-900">{{ t('affiliationRequests.log.title') }}</h2>
        <p v-if="!request.log.length" class="text-sm text-prohealth-500">{{ t('affiliationRequests.log.empty') }}</p>
        <ol v-else class="space-y-3">
          <li v-for="(entry, i) in request.log" :key="i" class="border-l-2 border-prohealth-200 pl-4">
            <p class="text-sm font-semibold text-prohealth-900">{{ logTitle(entry) }}</p>
            <p class="text-xs text-prohealth-500">
              {{ entry.actionAt_Display ?? formatDate(entry.actionAt, 'datetime') }}
              · {{ entry.actor_Display ?? t('affiliationRequests.log.applicant') }}
            </p>
            <ul v-if="entry.changes?.length" class="mt-1 text-sm text-prohealth-700 space-y-0.5">
              <li v-for="change in entry.changes" :key="change.field">
                <span class="font-medium">{{ fieldLabel(change.field) }}:</span>
                <span class="line-through text-prohealth-400">{{ change.from || t('common.empty') }}</span>
                → {{ change.to || t('common.empty') }}
              </li>
            </ul>
            <p v-if="entry.comment" class="mt-1 text-sm text-prohealth-700 whitespace-pre-line">{{ entry.comment }}</p>
          </li>
        </ol>
      </div>
    </template>

    <UModal v-model:open="approveOpen" :title="t('affiliationRequests.detail.approveTitle')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-prohealth-700">{{ t('affiliationRequests.detail.approveNotice') }}</p>
          <p v-if="request?.termsChanged" class="text-sm text-amber-700">{{ t('affiliationRequests.detail.termsChangedBody') }}</p>
          <UFormField :label="t('affiliationRequests.detail.comment')">
            <UTextarea v-model="approveComment" :rows="2" :maxlength="2000" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="approving" @click="approveOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="success" icon="i-lucide-check" :loading="approving" @click="confirmApprove">{{ t('affiliationRequests.detail.approve') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="rejectOpen" :title="t('affiliationRequests.detail.rejectTitle')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-prohealth-700">{{ t('affiliationRequests.detail.rejectNotice') }}</p>
          <UFormField :label="t('affiliationRequests.detail.rejectionReason')" required :error="rejectError">
            <UTextarea v-model="rejectReason" :rows="3" :maxlength="2000" class="w-full" @blur="rejectTouched = true" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="rejecting" @click="rejectOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="error" icon="i-lucide-x" :loading="rejecting" @click="confirmReject">{{ t('affiliationRequests.detail.reject') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
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
