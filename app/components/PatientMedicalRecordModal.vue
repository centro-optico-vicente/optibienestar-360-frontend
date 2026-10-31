<script setup lang="ts">
import type { MedicalRecordDto } from '~/types/members'

// Read-only medical history of a patient, for the doctor of a medical ally
// (hub ADR 0032). Fetched every time it opens — the backend never caches it and
// logs each read, which the patient then sees in "Quién vio mi historia".
const props = defineProps<{
  open: boolean
  allyUuid: string | null
  memberUuid: string | null
  memberName?: string | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t } = useI18n()
const patientAccess = usePatientAccess()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const record = ref<MedicalRecordDto | null>(null)
const loading = ref(false)
const failed = ref(false)

watch(() => props.open, async (open) => {
  if (!open) {
    // Do not keep medical data in memory once the modal is closed.
    record.value = null
    return
  }
  if (!props.allyUuid || !props.memberUuid) return
  loading.value = true
  failed.value = false
  try {
    record.value = await patientAccess.medicalRecord(props.allyUuid, props.memberUuid)
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
})

const hasData = computed(() => {
  const r = record.value
  return !!r && !!(r.bloodType || r.allergies || r.chronicConditions || r.currentMedications
    || r.emergencyContactName || r.emergencyContactPhone || r.notes)
})

const fields = computed(() => {
  const r = record.value
  if (!r) return []
  return [
    { label: t('members.medical.fields.bloodType'), value: r.bloodType },
    { label: t('members.medical.fields.allergies'), value: r.allergies },
    { label: t('members.medical.fields.chronicConditions'), value: r.chronicConditions },
    { label: t('members.medical.fields.currentMedications'), value: r.currentMedications },
    { label: t('members.medical.fields.emergencyContact'), value: r.emergencyContactName },
    { label: t('members.medical.fields.emergencyPhone'), value: r.emergencyContactPhone },
    { label: t('members.medical.fields.notes'), value: r.notes },
  ]
})
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('patientAccess.record.title')" :description="memberName ?? undefined">
    <template #body>
      <div class="space-y-4">
        <p class="text-xs text-prohealth-500 flex items-center gap-1.5">
          <UIcon name="i-lucide-shield-check" class="w-3.5 h-3.5" />
          {{ t('patientAccess.record.loggedNotice') }}
        </p>

        <div v-if="loading" class="py-6 flex justify-center">
          <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-prohealth-400" />
        </div>

        <UAlert
          v-else-if="failed"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          :title="t('patientAccess.record.failed')"
        />

        <p v-else-if="!hasData" class="text-sm text-prohealth-600">
          {{ t('patientAccess.record.empty') }}
        </p>

        <dl v-else class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div v-for="field in fields" :key="field.label">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ field.label }}</dt>
            <dd class="text-prohealth-900 whitespace-pre-line">{{ field.value || t('common.empty') }}</dd>
          </div>
        </dl>
      </div>
    </template>
  </UModal>
</template>
