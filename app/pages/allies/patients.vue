<script setup lang="ts">
import type { MyAllyDto } from '~/types/allies'
import type { AllyPatientLinkDto } from '~/types/patientAccess'

// "Mis pacientes" (hub ADR 0032): the patients whose credential QR the doctor —
// or an OPERADOR_MEDICO of the doctor's practice — scanned, and whose medical
// history they may read until the patient revokes the link. The list belongs to
// the doctor, so it is the same from any of the doctor's sites. The permission
// only opens the page; the backend narrows it to B2P medical allies.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_MEDICAL_RECORD_VIEW_PATIENT',
})

const { t } = useI18n()
const { formatDate } = useFormatters()
const myAllies = useMyAllies()
const patientAccess = usePatientAccess()

useSeoMeta({ title: () => t('patientAccess.patients.seoTitle') })

const allies = ref<MyAllyDto[]>([])
const selectedAllyUuid = ref<string | undefined>(undefined)
const allyOptions = computed(() => allies.value.map(a => ({ label: a.name, value: a.uuid })))

const eligible = ref(false)
const enabled = ref(true)
const checking = ref(true)

const data = ref<AllyPatientLinkDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)

const recordModalOpen = ref(false)
const selected = ref<AllyPatientLinkDto | null>(null)

onMounted(async () => {
  try {
    allies.value = await myAllies.list()
    selectedAllyUuid.value = allies.value[0]?.uuid
  }
  catch {
    // useApi already notified.
  }
  finally {
    if (!selectedAllyUuid.value) checking.value = false
  }
})

watch(selectedAllyUuid, async (allyUuid) => {
  data.value = []
  total.value = 0
  if (!allyUuid) return
  checking.value = true
  try {
    const res = await patientAccess.eligibility(allyUuid)
    enabled.value = res.enabled
    eligible.value = res.enabled && res.eligible
  }
  catch {
    eligible.value = false
  }
  finally {
    checking.value = false
  }
  if (eligible.value) {
    if (page.value !== 1) page.value = 1
    else await load()
  }
})

async function load() {
  if (!selectedAllyUuid.value || !eligible.value) return
  loading.value = true
  try {
    const res = await patientAccess.patients(selectedAllyUuid.value, { page: page.value - 1, size: size.value })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

watch(page, load)

function openRecord(link: AllyPatientLinkDto) {
  selected.value = link
  recordModalOpen.value = true
}
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('patientAccess.patients.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('patientAccess.patients.subtitle') }}</p>
      </div>
      <UButton to="/allies/validator" color="primary" variant="soft" icon="i-lucide-scan-qr-code">
        {{ t('patientAccess.patients.scanCta') }}
      </UButton>
    </div>

    <UFormField v-if="allyOptions.length > 1" :label="t('validator.fields.ally')" class="max-w-sm">
      <USelectMenu
        v-model="selectedAllyUuid"
        :items="allyOptions"
        label-key="label"
        value-key="value"
        icon="i-lucide-building-2"
        class="w-full"
      />
    </UFormField>

    <UAlert
      v-if="!checking && !enabled"
      color="neutral"
      variant="subtle"
      icon="i-lucide-lock"
      :title="t('patientAccess.patients.disabledTitle')"
      :description="t('patientAccess.patients.disabledDescription')"
    />
    <UAlert
      v-else-if="!checking && !eligible"
      color="warning"
      variant="subtle"
      icon="i-lucide-stethoscope"
      :title="t('patientAccess.patients.notEligibleTitle')"
      :description="t('patientAccess.patients.notEligibleDescription')"
    />

    <div v-else-if="!checking" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div v-if="loading" class="px-6 py-8 space-y-3">
        <USkeleton class="h-5 w-full rounded" />
        <USkeleton class="h-5 w-3/4 rounded" />
      </div>

      <div v-else-if="data.length === 0" class="px-6 py-10 text-center text-prohealth-500">
        <UIcon name="i-lucide-users" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
        <p class="text-sm">{{ t('patientAccess.patients.empty') }}</p>
      </div>

      <ul v-else class="divide-y divide-prohealth-100">
        <li v-for="p in data" :key="p.uuid" class="px-6 py-3.5 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-semibold text-prohealth-900">{{ p.memberFullName || t('common.empty') }}</p>
            <p class="text-xs text-prohealth-500 truncate">
              {{ t('patientAccess.patients.since', { date: p.createdAt_Display ?? formatDate(p.createdAt) }) }}
              · {{ p.allyName || t('common.empty') }}
            </p>
          </div>
          <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-stethoscope" @click="openRecord(p)">
            {{ t('patientAccess.viewRecord') }}
          </UButton>
        </li>
      </ul>

      <div v-if="!loading && total > size" class="flex items-center justify-end px-6 py-3 border-t border-prohealth-100">
        <UPagination v-model:page="page" :total="total" :items-per-page="size" />
      </div>
    </div>

    <PatientMedicalRecordModal
      v-model:open="recordModalOpen"
      :ally-uuid="selectedAllyUuid ?? null"
      :member-uuid="selected?.memberUuid ?? null"
      :member-name="selected?.memberFullName"
    />
  </div>
</template>
