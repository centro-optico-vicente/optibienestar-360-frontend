<script setup lang="ts">
import type { MyAllyDto } from '~/types/allies'
import type { BenefitUsageDto } from '~/types/benefits'
import type { ValidationResultDto } from '~/types/validator'
import { canOperateAtCounter } from '~/types/allies'
import { isValidationActionable, validationStatusColor, validationStatusIcon } from '~/types/validator'

// Realtime validator — the counter screen. Type the affiliate's document, get the
// solvency answer, and (only when ACTIVE) register the consumed benefit.
//
// Gated on ALLY_VALIDATE_MEMBER rather than the ALIADO role: the permission is the
// thing the backend actually checks, and a role gate would lock out any future role
// granted the permission. The backend is the real wall (403) — this is UX.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_VALIDATE_MEMBER',
})

const { t } = useI18n()
const { formatDate } = useFormatters()
const { can } = usePermissions()
const myAllies = useMyAllies()
const validator = useValidator()
const patientAccess = usePatientAccess()

useSeoMeta({ title: () => t('validator.seoTitle') })

// ---- Which ally am I operating for? ----
// Resolved from GET /v1/me/allies, never typed by the operator. One ally is the
// common case and needs no picker; several (a doctor working at two clinics) get one.
const allies = ref<MyAllyDto[]>([])
const selectedAllyUuid = ref<string | undefined>(undefined)
const alliesLoading = ref(true)

const selectedAlly = computed(() => allies.value.find(a => a.uuid === selectedAllyUuid.value) ?? null)
const allyOptions = computed(() => allies.value.map(a => ({ label: a.name, value: a.uuid })))
const hasNoAlly = computed(() => !alliesLoading.value && allies.value.length === 0)

onMounted(async () => {
  try {
    allies.value = await myAllies.list()
    // The backend returns primary first, so the head is the sensible default.
    selectedAllyUuid.value = allies.value[0]?.uuid
  }
  catch {
    // useApi already notified; hasNoAlly renders the empty state.
  }
  finally {
    alliesLoading.value = false
    await nextTick()
    focusDocument()
  }
})

// ---- Validation ----
// UInput exposes only `inputRef` (the native element), not a focus() method — the
// chain must go through it. Optional all the way so a miss is a no-op, never a
// TypeError at the counter; the `autofocus` prop covers the initial focus anyway.
const documentInput = ref<{ inputRef?: HTMLInputElement | null } | null>(null)

function focusDocument() {
  documentInput.value?.inputRef?.focus()
}
const document = ref('')
const result = ref<ValidationResultDto | null>(null)
const validating = ref(false)
/** Document the current `result` belongs to — lets us blank a stale result while retyping. */
const validatedDocument = ref('')

const canValidate = computed(() => !!document.value.trim() && !validating.value)

// Retyping invalidates the panel: showing a previous affiliate's ACTIVE badge next
// to a new document is the one mistake this screen must never make.
watch(document, (value) => {
  if (result.value && value.trim() !== validatedDocument.value) {
    result.value = null
    linkedMemberUuid.value = null
  }
})

/**
 * @param fromScan the value came from the credential QR. Only a scan opens the
 *        doctor–patient link (hub ADR 0032) — a typed document never does.
 */
async function validate(fromScan = false) {
  const doc = document.value.trim()
  if (!doc) return
  validating.value = true
  linkedMemberUuid.value = null
  try {
    result.value = await validator.validate(doc)
    validatedDocument.value = doc
    if (fromScan) await openPatientLink()
  }
  catch {
    // silent: true — surface it in the panel instead of a toast, so the operator's
    // eyes stay in one place.
    result.value = null
    validatedDocument.value = ''
    failed.value = true
  }
  finally {
    validating.value = false
  }
}

const failed = ref(false)
watch(document, () => { failed.value = false })

// ---- QR scan ----
// The Digital Credential QR carries the member UUID; the same validate endpoint
// accepts it as-is, so a scan just fills the field and validates.
const scannerOpen = ref(false)

function onScanned(value: string) {
  document.value = value
  validate(true)
}

// ---- Patient medical history (hub ADR 0032) ----
// Offered only to the doctor (or an OPERADOR_MEDICO) of a B2P medical ally, and
// only while the system switch is on. A QR scan opens the doctor–patient link;
// from then on the doctor also finds the patient in "Mis pacientes".
const patientEligible = ref(false)
/** Member whose link this screen just opened — the button belongs to that result only. */
const linkedMemberUuid = ref<string | null>(null)
const recordModalOpen = ref(false)

watch(selectedAllyUuid, async (allyUuid) => {
  patientEligible.value = false
  linkedMemberUuid.value = null
  if (!allyUuid || !can('MEMBER_MEDICAL_RECORD_VIEW_PATIENT')) return
  try {
    const res = await patientAccess.eligibility(allyUuid)
    patientEligible.value = res.enabled && res.eligible
  }
  catch {
    patientEligible.value = false
  }
})

async function openPatientLink() {
  const memberUuid = result.value?.memberUuid
  if (!patientEligible.value || !selectedAllyUuid.value || !memberUuid) return
  try {
    await patientAccess.openLink(selectedAllyUuid.value, memberUuid)
    linkedMemberUuid.value = memberUuid
  }
  catch {
    // useApi already notified; the counter flow (validation, usage) goes on.
  }
}

const canViewMedicalRecord = computed(() =>
  patientEligible.value && !!result.value?.memberUuid && linkedMemberUuid.value === result.value.memberUuid)

function reset() {
  document.value = ''
  result.value = null
  validatedDocument.value = ''
  linkedMemberUuid.value = null
  failed.value = false
  focusDocument()
}

// ---- Benefit usage ----
const usageModalOpen = ref(false)
const lastUsage = ref<BenefitUsageDto | null>(null)

/**
 * The button shows only when the benefit may actually be applied: an ACTIVE
 * result, an ally selected, a VIEWER-free role, and the permission. Anything less
 * would be a button that 403s or 422s at the counter.
 */
const canRegisterUsage = computed(() =>
  isValidationActionable(result.value)
  && !!selectedAlly.value
  && canOperateAtCounter(selectedAlly.value?.allyRole)
  && can('ALLY_REGISTER_USAGE'))

function onRegistered(usage: BenefitUsageDto) {
  lastUsage.value = usage
  // Clear for the next person in line — a counter screen is used back to back.
  reset()
}
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('validator.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('validator.subtitle') }}</p>
    </div>

    <!-- No ally: the whole screen is inert, say why instead of failing later -->
    <UAlert
      v-if="hasNoAlly"
      color="warning"
      variant="subtle"
      icon="i-lucide-building-2"
      :title="t('validator.noAllyTitle')"
      :description="t('validator.noAllyDescription')"
    />

    <template v-else>
      <!-- Just registered: confirmation that survives the form reset -->
      <UAlert
        v-if="lastUsage"
        color="success"
        variant="subtle"
        icon="i-lucide-check-circle"
        :title="t('validator.usage.lastRegisteredTitle')"
        :description="t('validator.usage.lastRegisteredDescription', { date: lastUsage.usageDate_Display ?? formatDate(lastUsage.usageDate) })"
        :close="{ color: 'neutral', variant: 'link' }"
        @update:open="lastUsage = null"
      />

      <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
        <!-- Ally picker only when there's a real choice to make -->
        <UFormField
          v-if="allyOptions.length > 1"
          :label="t('validator.fields.ally')"
          :help="t('validator.fields.allyHelp')"
        >
          <USelectMenu
            clear
            v-model="selectedAllyUuid"
            :items="allyOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-building-2"
            class="w-full"
          />
        </UFormField>
        <p v-else-if="selectedAlly" class="text-xs text-prohealth-500 flex items-center gap-1.5">
          <UIcon name="i-lucide-building-2" class="w-3.5 h-3.5" />
          {{ selectedAlly.name }}
        </p>

        <UFormField :label="t('validator.fields.document')" :help="t('validator.fields.documentHelp')">
          <div class="flex gap-2">
            <UInput
              ref="documentInput"
              v-model="document"
              :placeholder="t('validator.documentPlaceholder')"
              icon="i-lucide-id-card"
              size="xl"
              autofocus
              autocomplete="off"
              class="flex-1 font-mono"
              @keyup.enter="validate()"
            />
            <UButton
              size="xl"
              color="primary"
              icon="i-lucide-search"
              :loading="validating"
              :disabled="!canValidate"
              @click="validate()"
            >
              {{ t('validator.validateButton') }}
            </UButton>
            <UButton
              size="xl"
              color="neutral"
              variant="outline"
              icon="i-lucide-scan-qr-code"
              :aria-label="t('validator.scanner.button')"
              @click="scannerOpen = true"
            >
              <span class="hidden sm:inline">{{ t('validator.scanner.button') }}</span>
            </UButton>
          </div>
        </UFormField>

        <UButton
          v-if="result || failed"
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-rotate-ccw"
          @click="reset"
        >
          {{ t('validator.newQuery') }}
        </UButton>
      </div>

      <!-- Network/server failure: the one case with no status to show -->
      <UAlert
        v-if="failed"
        color="error"
        variant="subtle"
        icon="i-lucide-wifi-off"
        :title="t('validator.failedTitle')"
        :description="t('validator.failedDescription')"
      />

      <!-- Result -->
      <div
        v-if="result"
        class="rounded-2xl border p-6 space-y-4"
        :class="{
          'border-green-200 bg-green-50/60': validationStatusColor(result.status) === 'success',
          'border-amber-200 bg-amber-50/60': validationStatusColor(result.status) === 'warning',
          'border-red-200 bg-red-50/60': validationStatusColor(result.status) === 'error',
          'border-prohealth-200 bg-prohealth-50/60': validationStatusColor(result.status) === 'neutral',
        }"
      >
        <!-- Headline: the one thing readable across the counter -->
        <div class="flex items-start gap-4">
          <UIcon
            :name="validationStatusIcon(result.status)"
            class="w-10 h-10 shrink-0"
            :class="{
              'text-green-600': validationStatusColor(result.status) === 'success',
              'text-amber-600': validationStatusColor(result.status) === 'warning',
              'text-red-600': validationStatusColor(result.status) === 'error',
              'text-prohealth-400': validationStatusColor(result.status) === 'neutral',
            }"
          />
          <div class="min-w-0">
            <p class="text-xl font-extrabold text-prohealth-900">
              {{ result.status_Display ?? t(`validator.status.${result.status}`, String(result.status)) }}
            </p>
            <p class="text-sm text-prohealth-700 mt-0.5">
              {{ t(`validator.statusHint.${result.status}`, '') }}
            </p>
          </div>
        </div>

        <!-- Identity: present whenever the document matched a person, even if not solvent -->
        <dl v-if="result.memberFullName" class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm pt-2 border-t border-prohealth-900/5">
          <div class="flex items-center justify-between sm:block">
            <dt class="text-prohealth-500">{{ t('validator.result.member') }}</dt>
            <dd class="font-semibold text-prohealth-900">{{ result.memberFullName }}</dd>
          </div>
          <div class="flex items-center justify-between sm:block">
            <dt class="text-prohealth-500">{{ t('validator.result.document') }}</dt>
            <dd class="text-prohealth-800 font-mono">
              {{ [result.documentType, result.documentNumber].filter(Boolean).join('-') || t('common.empty') }}
            </dd>
          </div>
          <div v-if="result.planName" class="flex items-center justify-between sm:block">
            <dt class="text-prohealth-500">{{ t('validator.result.plan') }}</dt>
            <dd class="text-prohealth-800">{{ result.planName }}</dd>
          </div>
          <div v-if="result.nextDueDate" class="flex items-center justify-between sm:block">
            <dt class="text-prohealth-500">{{ t('validator.result.nextDueDate') }}</dt>
            <dd class="text-prohealth-800">{{ result.nextDueDate_Display ?? formatDate(result.nextDueDate) }}</dd>
          </div>
        </dl>

        <div v-if="canRegisterUsage || result.memberFullName || canViewMedicalRecord" class="pt-2 flex flex-wrap items-center gap-3">
          <UButton v-if="canRegisterUsage" color="primary" size="lg" icon="i-lucide-clipboard-check" @click="usageModalOpen = true">
            {{ t('validator.usage.openButton') }}
          </UButton>
          <UButton
            v-if="result.memberFullName"
            to="/allies/history"
            color="neutral"
            variant="soft"
            size="lg"
            icon="i-lucide-clipboard-list"
          >
            {{ t('validator.result.viewUsageHistory') }}
          </UButton>
          <UButton
            v-if="canViewMedicalRecord"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-stethoscope"
            @click="recordModalOpen = true"
          >
            {{ t('patientAccess.viewRecord') }}
          </UButton>
        </div>
      </div>
    </template>

    <BenefitUsageModal
      v-model:open="usageModalOpen"
      :ally="selectedAlly"
      :validation="result"
      @registered="onRegistered"
    />
    <QrScannerModal v-model:open="scannerOpen" @scanned="onScanned" />
    <PatientMedicalRecordModal
      v-model:open="recordModalOpen"
      :ally-uuid="selectedAllyUuid ?? null"
      :member-uuid="result?.memberUuid ?? null"
      :member-name="result?.memberFullName"
    />
  </div>
</template>
