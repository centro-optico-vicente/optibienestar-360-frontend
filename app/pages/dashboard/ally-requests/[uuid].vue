<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import { AGREEMENT_TYPE_OPTIONS, type AgreementType } from '~/types/allies'
import type { AllyRequestAgreementDto, AllyRequestApproveRequest, AllyRequestDetailDto } from '~/types/allyRequests'
import { allyRegistrationStatusColor } from '~/types/allyRequests'

// Review of one ally request (hub ADR 0036). PENDING: approve (registers the
// agreement when the ally has none ACTIVE, optional signed support, "publish"
// checkbox) or reject with a mandatory reason. REJECTED: reopen. Any state: invite
// the contact to the portal when the ally has no user yet (imported allies).
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_REGISTRATION_VIEW_ALL',
})

const { t } = useI18n()
const { can } = usePermissions()
const toast = useToast()
const route = useRoute()
const requestUuid = route.params.uuid as string

useSeoMeta({ title: () => t('common.seoTitle', { page: t('allyRequests.detail.seoPage') }) })

const api = useAllyRequests()

const request = ref<AllyRequestDetailDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function load() {
  loading.value = true
  try {
    request.value = await api.get(requestUuid)
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    request.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const isPending = computed(() => request.value?.registrationStatus === 'PENDING')
const isRejected = computed(() => request.value?.registrationStatus === 'REJECTED')
const hasAgreement = computed(() => (request.value?.activeAgreements?.length ?? 0) > 0)

function statusLabel(r: AllyRequestDetailDto): string {
  return r.registrationStatus_Display ?? t(`allyRequests.status.${r.registrationStatus}`, r.registrationStatus)
}

const dataRows = computed(() => {
  const r = request.value
  if (!r) return []
  return [
    { label: t('allyRequests.detail.fields.allyNumber'), value: r.allyNumber != null ? String(r.allyNumber) : null, mono: true },
    { label: t('allyRequests.detail.fields.segment'), value: r.segment_Display ?? t(`allies.segments.${r.segment}`, r.segment) },
    { label: t('allyRequests.detail.fields.allyTypes'), value: r.allyTypeNames?.join(', ') },
    { label: t('allyRequests.detail.fields.professions'), value: r.professionNames?.join(', ') },
    { label: t('allyRequests.detail.fields.taxDocument'), value: r.taxDocumentNumber ? `${r.taxDocumentType ?? ''}-${r.taxDocumentNumber}` : null, mono: true },
    { label: t('allyRequests.detail.fields.channel'), value: r.registrationChannel_Display ?? t(`allyRequests.channel.${r.registrationChannel}`, String(r.registrationChannel)) },
    { label: t('allyRequests.detail.fields.city'), value: r.city_Display },
    { label: t('allyRequests.detail.fields.address'), value: r.address },
    { label: t('allyRequests.detail.fields.promoter'), value: r.promoter_Display },
    { label: t('allyRequests.detail.fields.published'), value: r.published ? t('common.yes') : t('common.no') },
  ]
})

const holderRows = computed(() => {
  const h = request.value?.holder
  if (!h) return []
  return [
    { label: t('allyRequests.detail.fields.holderName'), value: `${h.firstName} ${h.lastName}`.trim() },
    { label: t('allyRequests.detail.fields.holderDocument'), value: h.documentNumber ? `${h.documentType ?? ''}-${h.documentNumber}` : null, mono: true },
    { label: t('allyRequests.detail.fields.email'), value: h.email },
    { label: t('allyRequests.detail.fields.phone'), value: h.phone },
  ]
})

// ---- Agreement support ----
const openingSupport = ref<string | null>(null)
async function viewSupport(a: AllyRequestAgreementDto) {
  if (!request.value) return
  openingSupport.value = a.uuid
  try {
    const res = await api.agreementSupportUrl(request.value.uuid, a.uuid)
    window.open(res.url, '_blank', 'noopener')
  }
  catch { /* toast handled by useApi */ }
  finally { openingSupport.value = null }
}

// ---- Approve ----
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const agreementTypeItems = computed(() => AGREEMENT_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const approveOpen = ref(false)
const approving = ref(false)
const approveForm = reactive({
  agreementType: 'COMMERCIAL' as AgreementType,
  startDate: localToday(),
  endDate: '',
  autoRenew: false,
  noticeDays: '',
  publish: true,
  comment: '',
})
const supportFile = ref<File | null>(null)
const supportInput = ref<HTMLInputElement | null>(null)

function openApprove() {
  const r = request.value
  Object.assign(approveForm, {
    agreementType: r?.segment === 'B2P' ? 'MEDICAL' : 'COMMERCIAL',
    startDate: localToday(),
    endDate: '',
    autoRenew: false,
    noticeDays: '',
    publish: true,
    comment: '',
  })
  supportFile.value = null
  if (supportInput.value) supportInput.value.value = ''
  approveOpen.value = true
}

function onSupportChange(e: Event) {
  supportFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

function approveInvalid(): string | null {
  if (hasAgreement.value) return null
  if (!approveForm.startDate) return t('allyRequests.detail.approve.startDateRequired')
  if (approveForm.endDate && approveForm.endDate < approveForm.startDate) return t('allyRequests.detail.approve.endBeforeStart')
  if (approveForm.noticeDays && !/^\d{1,3}$/.test(approveForm.noticeDays)) return t('allyRequests.detail.approve.badNoticeDays')
  return null
}

async function confirmApprove() {
  if (!request.value) return
  const error = approveInvalid()
  if (error) {
    toast.add({ title: error, color: 'error' })
    return
  }
  const body: AllyRequestApproveRequest = {
    publish: approveForm.publish,
    comment: approveForm.comment.trim() || undefined,
    agreement: hasAgreement.value
      ? undefined
      : {
          agreementType: approveForm.agreementType,
          startDate: approveForm.startDate,
          endDate: approveForm.endDate || undefined,
          autoRenew: approveForm.autoRenew || undefined,
          noticeDays: approveForm.noticeDays ? Number(approveForm.noticeDays) : undefined,
        },
  }
  approving.value = true
  try {
    request.value = await api.approve(request.value.uuid, body, supportFile.value)
    approveOpen.value = false
    toast.add({ title: t('allyRequests.detail.approve.doneToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch (err) {
    const e = err as ApiError
    if (e.status === 400) toast.add({ title: e.message, color: 'error' })
  }
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
    rejectOpen.value = false
    toast.add({ title: t('allyRequests.detail.reject.doneToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch { /* toast handled by useApi */ }
  finally { rejecting.value = false }
}

// ---- Reopen ----
const reopening = ref(false)
async function reopen() {
  if (!request.value) return
  reopening.value = true
  try {
    request.value = await api.reopen(request.value.uuid)
    toast.add({ title: t('allyRequests.detail.reopenToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch { /* toast handled by useApi */ }
  finally { reopening.value = false }
}

// ---- Invite to the portal ----
const inviteOpen = ref(false)
const inviting = ref(false)
const docTypes = [{ value: 'V', label: 'V' }, { value: 'E', label: 'E' }]
const inviteForm = reactive({ documentType: 'V', documentNumber: '', email: '' })
// Without a holder person the backend needs the contact's cédula to create the user.
const inviteNeedsDocument = computed(() => !request.value?.holder?.documentNumber)

function openInvite() {
  const r = request.value
  Object.assign(inviteForm, {
    documentType: r?.holder?.documentType || 'V',
    documentNumber: '',
    email: r?.holder?.email || r?.contactEmail || '',
  })
  inviteOpen.value = true
}

async function confirmInvite() {
  if (!request.value) return
  if (inviteNeedsDocument.value && !/^\d{1,9}$/.test(inviteForm.documentNumber.trim())) {
    toast.add({ title: t('allyRequests.detail.invite.documentRequired'), color: 'error' })
    return
  }
  const email = inviteForm.email.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast.add({ title: t('validation.emailInvalid'), color: 'error' })
    return
  }
  inviting.value = true
  try {
    await api.invite(request.value.uuid, {
      documentType: inviteNeedsDocument.value ? inviteForm.documentType : undefined,
      documentNumber: inviteNeedsDocument.value ? inviteForm.documentNumber.trim() : undefined,
      email: email || undefined,
    })
    inviteOpen.value = false
    toast.add({ title: t('allyRequests.detail.invite.doneToast'), color: 'success', icon: 'i-lucide-mail-check' })
    await load()
  }
  catch (err) {
    const e = err as ApiError
    if (e.status === 400) toast.add({ title: e.message, color: 'error' })
  }
  finally { inviting.value = false }
}
</script>

<template>
  <div class="space-y-5">
    <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" to="/dashboard/ally-requests" size="sm">
      {{ t('allyRequests.title') }}
    </UButton>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <div v-else-if="notFound || !request" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('allyRequests.detail.notFoundTitle') }}</p>
    </div>

    <template v-else>
      <!-- Header + actions -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ request.name }}</h1>
              <UBadge :color="allyRegistrationStatusColor(request.registrationStatus)" variant="subtle">{{ statusLabel(request) }}</UBadge>
              <UBadge :color="request.segment === 'B2P' ? 'info' : 'primary'" variant="subtle" icon="i-lucide-layers">
                {{ request.segment_Display ?? t(`allies.segments.${request.segment}`, request.segment) }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-600 mt-1">
              {{ t('allyRequests.detail.receivedAt', { date: request.createdAt_Display ?? request.createdAt }) }}
            </p>
            <p v-if="request.approvedAt_Display" class="text-xs text-prohealth-500 mt-1">
              {{ t('allyRequests.detail.approvedBy', { name: request.approvedBy_Display ?? t('common.empty'), date: request.approvedAt_Display }) }}
            </p>
            <p v-if="request.rejectedAt_Display" class="text-xs text-prohealth-500 mt-1">
              {{ t('allyRequests.detail.rejectedBy', { name: request.rejectedBy_Display ?? t('common.empty'), date: request.rejectedAt_Display }) }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="!request.hasUser && can('ALLY_REGISTRATION_INVITE')"
              color="primary"
              variant="outline"
              icon="i-lucide-mail-plus"
              @click="openInvite"
            >
              {{ t('allyRequests.detail.invite.button') }}
            </UButton>
            <UButton v-can="'ALLY_VIEW_ALL'" color="neutral" variant="outline" icon="i-lucide-building-2" :to="`/dashboard/allies/${request.uuid}`">
              {{ t('allyRequests.detail.viewAlly') }}
            </UButton>
            <template v-if="isPending">
              <UButton v-can="'ALLY_REGISTRATION_REJECT'" color="error" variant="outline" icon="i-lucide-x" @click="openReject">
                {{ t('allyRequests.detail.reject.button') }}
              </UButton>
              <UButton v-can="'ALLY_REGISTRATION_APPROVE'" color="success" icon="i-lucide-check" @click="openApprove">
                {{ t('allyRequests.detail.approve.button') }}
              </UButton>
            </template>
            <UButton v-else-if="isRejected" v-can="'ALLY_REGISTRATION_REJECT'" color="warning" variant="outline" icon="i-lucide-rotate-ccw" :loading="reopening" @click="reopen">
              {{ t('allyRequests.detail.reopen') }}
            </UButton>
          </div>
        </div>

        <UAlert
          v-if="isRejected && request.rejectionReason"
          class="mt-4"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-x"
          :title="t('allyRequests.detail.rejectionReason')"
          :description="request.rejectionReason"
        />
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <!-- Ally data -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
          <h2 class="text-lg font-bold text-prohealth-900">{{ t('allyRequests.detail.allyTitle') }}</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div v-for="row in dataRows" :key="row.label">
              <dt class="text-xs text-prohealth-500">{{ row.label }}</dt>
              <dd class="text-prohealth-800" :class="{ 'font-mono': row.mono }">{{ row.value || t('common.empty') }}</dd>
            </div>
          </dl>
          <div class="pt-3 border-t border-prohealth-100">
            <p class="text-xs text-prohealth-500">{{ t('allyRequests.detail.fields.benefitNote') }}</p>
            <p class="text-sm text-prohealth-800 whitespace-pre-line">{{ request.registrationNote || t('common.empty') }}</p>
          </div>
        </div>

        <!-- Holder / contact + users -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
          <h2 class="text-lg font-bold text-prohealth-900">{{ t('allyRequests.detail.contactTitle') }}</h2>
          <dl v-if="holderRows.length" class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div v-for="row in holderRows" :key="row.label">
              <dt class="text-xs text-prohealth-500">{{ row.label }}</dt>
              <dd class="text-prohealth-800" :class="{ 'font-mono': row.mono }">{{ row.value || t('common.empty') }}</dd>
            </div>
          </dl>
          <dl v-else class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('allyRequests.detail.fields.holderName') }}</dt>
              <dd class="text-prohealth-800">{{ request.contactName || t('common.empty') }}</dd>
            </div>
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('allyRequests.detail.fields.email') }}</dt>
              <dd class="text-prohealth-800">{{ request.contactEmail || t('common.empty') }}</dd>
            </div>
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('allyRequests.detail.fields.phone') }}</dt>
              <dd class="text-prohealth-800">{{ request.contactPhone || t('common.empty') }}</dd>
            </div>
          </dl>

          <div class="pt-3 border-t border-prohealth-100 space-y-2">
            <h3 class="text-sm font-semibold text-prohealth-900">{{ t('allyRequests.detail.usersTitle') }}</h3>
            <p v-if="!request.users?.length" class="text-sm text-prohealth-500">{{ t('allyRequests.detail.noUsers') }}</p>
            <ul v-else class="divide-y divide-prohealth-100">
              <li v-for="u in request.users" :key="u.uuid" class="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span class="text-prohealth-800">{{ u.email }}</span>
                <span class="flex flex-wrap gap-1">
                  <UBadge v-for="role in u.roleNames ?? []" :key="role" color="neutral" variant="outline" size="sm">{{ role }}</UBadge>
                  <UBadge v-if="u.status" color="neutral" variant="subtle" size="sm">{{ u.status }}</UBadge>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Active agreements -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
        <h2 class="text-lg font-bold text-prohealth-900">{{ t('allyRequests.detail.agreementsTitle') }}</h2>
        <p v-if="!hasAgreement" class="text-sm text-prohealth-500">{{ t('allyRequests.detail.noAgreements') }}</p>
        <ul v-else class="divide-y divide-prohealth-100">
          <li v-for="a in request.activeAgreements" :key="a.uuid" class="py-2 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p class="font-medium text-prohealth-900">{{ a.agreementType_Display ?? t(`allies.agreements.types.${a.agreementType}`, String(a.agreementType)) }}</p>
              <p class="text-xs text-prohealth-500">
                {{ a.startDate_Display ?? t('common.empty') }} → {{ a.endDate_Display ?? t('allyRequests.detail.noEndDate') }}
              </p>
            </div>
            <UButton
              v-if="a.hasSupport"
              size="xs"
              color="primary"
              variant="outline"
              icon="i-lucide-external-link"
              :loading="openingSupport === a.uuid"
              @click="viewSupport(a)"
            >
              {{ t('allyRequests.detail.viewSupport') }}
            </UButton>
          </li>
        </ul>
      </div>
    </template>

    <!-- Approve -->
    <UModal v-model:open="approveOpen" :title="t('allyRequests.detail.approve.title')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-prohealth-700">{{ t('allyRequests.detail.approve.notice') }}</p>
          <template v-if="!hasAgreement">
            <p class="text-sm font-semibold text-prohealth-900">{{ t('allyRequests.detail.approve.agreementTitle') }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField :label="t('allyRequests.detail.approve.agreementType')" required class="sm:col-span-2">
                <USelect v-model="approveForm.agreementType" :items="agreementTypeItems" class="w-full" />
              </UFormField>
              <UFormField :label="t('allyRequests.detail.approve.startDate')" required>
                <UInput v-model="approveForm.startDate" type="date" class="w-full" />
              </UFormField>
              <UFormField :label="t('allyRequests.detail.approve.endDate')">
                <UInput v-model="approveForm.endDate" type="date" :min="approveForm.startDate" class="w-full" />
              </UFormField>
              <UFormField :label="t('allyRequests.detail.approve.noticeDays')">
                <UInput v-model="approveForm.noticeDays" inputmode="numeric" maxlength="3" class="w-full" />
              </UFormField>
              <UFormField :label="t('allyRequests.detail.approve.autoRenew')">
                <USwitch v-model="approveForm.autoRenew" />
              </UFormField>
            </div>
          </template>
          <p v-else class="text-sm text-prohealth-600">{{ t('allyRequests.detail.approve.hasAgreement') }}</p>
          <UFormField :label="t('allyRequests.detail.approve.support')" :help="t('allyRequests.detail.approve.supportHelp')">
            <input
              ref="supportInput"
              type="file"
              accept="image/*,application/pdf"
              class="block w-full text-sm text-prohealth-600 file:mr-3 file:rounded-lg file:border-0 file:bg-prohealth-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-prohealth-700 hover:file:bg-prohealth-100"
              @change="onSupportChange"
            >
          </UFormField>
          <UCheckbox v-model="approveForm.publish" :label="t('allyRequests.detail.approve.publish')" />
          <UFormField :label="t('allyRequests.detail.comment')">
            <UTextarea v-model="approveForm.comment" :rows="2" :maxlength="2000" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="approving" @click="approveOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="success" icon="i-lucide-check" :loading="approving" @click="confirmApprove">{{ t('allyRequests.detail.approve.button') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Reject -->
    <UModal v-model:open="rejectOpen" :title="t('allyRequests.detail.reject.title')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-prohealth-700">{{ t('allyRequests.detail.reject.notice') }}</p>
          <UFormField :label="t('allyRequests.detail.rejectionReason')" required :error="rejectError">
            <UTextarea v-model="rejectReason" :rows="3" :maxlength="2000" class="w-full" @blur="rejectTouched = true" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="rejecting" @click="rejectOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="error" icon="i-lucide-x" :loading="rejecting" @click="confirmReject">{{ t('allyRequests.detail.reject.button') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Invite -->
    <UModal v-model:open="inviteOpen" :title="t('allyRequests.detail.invite.title')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-prohealth-700">{{ t('allyRequests.detail.invite.notice') }}</p>
          <UFormField v-if="inviteNeedsDocument" :label="t('allyRequests.detail.invite.document')" :help="t('allyRequests.detail.invite.documentHelp')" required>
            <div class="flex gap-2">
              <USelect v-model="inviteForm.documentType" :items="docTypes" class="w-20" />
              <UInput v-model="inviteForm.documentNumber" class="flex-1" maxlength="9" inputmode="numeric" placeholder="12345678" />
            </div>
          </UFormField>
          <UFormField :label="t('allyRequests.detail.fields.email')" :help="t('allyRequests.detail.invite.emailHelp')">
            <UInput v-model="inviteForm.email" type="email" maxlength="254" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="inviting" @click="inviteOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" icon="i-lucide-mail-plus" :loading="inviting" @click="confirmInvite">{{ t('allyRequests.detail.invite.button') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
