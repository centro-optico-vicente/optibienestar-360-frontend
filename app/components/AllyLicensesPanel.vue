<script setup lang="ts">
// Professional licenses (colegiaturas) of a B2P ally's holder person — V213,
// hub ADR 0031 §5. The license belongs to the PERSON, so every practice site
// of the same professional shows the same list. One granular permission per
// action (PERSON_LICENSE_*). Editing the body or the number sends a verified
// license back to "pending" (the backend does it; the UI just says so).
import { z } from 'zod'
import type { AllyLicenseDto } from '~/types/licenses'
import { toSelectItems } from '~/types/options'

const props = defineProps<{
  allyUuid: string
  /** False when the ally still has no holder person: nothing to license yet. */
  hasHolder: boolean
}>()

const { t } = useI18n()
const toast = useToast()
const { can } = usePermissions()
const licensesApi = useAllyLicenses()

const canCreate = computed(() => can('PERSON_LICENSE_CREATE'))
const canUpdate = computed(() => can('PERSON_LICENSE_UPDATE'))
const canDelete = computed(() => can('PERSON_LICENSE_DELETE'))
const canVerify = computed(() => can('PERSON_LICENSE_VERIFY'))

const licenses = ref<AllyLicenseDto[]>([])
const loading = ref(false)
const bodyOptions = ref<{ label: string, value: string }[]>([])

async function load() {
  loading.value = true
  try {
    licenses.value = await licensesApi.list(props.allyUuid)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    loading.value = false
  }
}

async function loadBodies() {
  try {
    bodyOptions.value = toSelectItems(await useCatalogOptions('licensing-bodies').options({ limit: 200 }))
  }
  catch {
    bodyOptions.value = []
  }
}

onMounted(() => {
  load()
  if (canCreate.value || canUpdate.value) loadBodies()
})
watch(() => props.allyUuid, () => load())

function statusColor(status: string): 'success' | 'error' | 'warning' {
  if (status === 'VERIFIED') return 'success'
  if (status === 'REJECTED') return 'error'
  return 'warning'
}

// ---- Create / edit ----
const formOpen = ref(false)
const editing = ref<AllyLicenseDto | null>(null)
const submitting = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)
const state = reactive({ licensingBodyUuid: '', licenseNumber: '' })
const schema = computed(() => z.object({
  licensingBodyUuid: z.string().min(1, t('validation.required')),
  licenseNumber: z.string().trim().min(1, t('validation.required')).max(40, t('validation.maxChars', { n: 40 })),
}))

function openCreate() {
  editing.value = null
  state.licensingBodyUuid = ''
  state.licenseNumber = ''
  formOpen.value = true
}

function openEdit(license: AllyLicenseDto) {
  editing.value = license
  state.licensingBodyUuid = license.licensingBody_Uuid ?? ''
  state.licenseNumber = license.licenseNumber
  formOpen.value = true
}

async function onSubmit() {
  submitting.value = true
  const body = { licensingBodyUuid: state.licensingBodyUuid, licenseNumber: state.licenseNumber.trim() }
  try {
    if (editing.value) {
      await licensesApi.update(props.allyUuid, editing.value.uuid, body)
      toast.add({ title: t('allies.licenses.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      await licensesApi.create(props.allyUuid, body)
      toast.add({ title: t('allies.licenses.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    submitting.value = false
  }
}

// ---- Verify / reject / delete ----
const mutating = ref<string | null>(null)

async function verify(license: AllyLicenseDto, status: 'VERIFIED' | 'REJECTED') {
  mutating.value = license.uuid
  try {
    await licensesApi.verify(props.allyUuid, license.uuid, status)
    toast.add({
      title: status === 'VERIFIED' ? t('allies.licenses.verifiedToast') : t('allies.licenses.rejectedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    mutating.value = null
  }
}

const deleteTarget = ref<AllyLicenseDto | null>(null)
const deleteOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (open: boolean) => { if (!open) deleteTarget.value = null },
})

async function confirmDelete() {
  if (!deleteTarget.value) return
  const target = deleteTarget.value
  mutating.value = target.uuid
  try {
    await licensesApi.remove(props.allyUuid, target.uuid)
    toast.add({ title: t('allies.licenses.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteTarget.value = null
    await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    mutating.value = null
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100">
    <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100 gap-4">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('allies.licenses.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('allies.licenses.hint') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="canCreate"
          color="primary"
          variant="soft"
          icon="i-lucide-plus"
          size="sm"
          :disabled="!hasHolder"
          @click="openCreate"
        >
          {{ t('allies.licenses.addButton') }}
        </UButton>
        <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
      </div>
    </div>

    <div class="p-6">
      <p v-if="!hasHolder" class="text-sm text-prohealth-500">{{ t('allies.licenses.noHolder') }}</p>
      <div v-else-if="loading" class="space-y-2">
        <USkeleton v-for="i in 2" :key="i" class="h-10 w-full" />
      </div>
      <p v-else-if="licenses.length === 0" class="text-sm text-prohealth-500">{{ t('allies.licenses.empty') }}</p>
      <ul v-else class="divide-y divide-prohealth-100">
        <li v-for="l in licenses" :key="l.uuid" class="flex flex-wrap items-center justify-between gap-3 py-3">
          <div class="min-w-0">
            <p class="font-medium text-prohealth-900">
              {{ l.licensingBody_Display || l.licensingBody_Code }} · {{ l.licenseNumber }}
            </p>
            <p v-if="l.verifiedAt_Display" class="text-xs text-prohealth-500">
              {{ t('allies.licenses.reviewedAt', { date: l.verifiedAt_Display }) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UBadge :color="statusColor(l.verificationStatus)" variant="subtle">
              {{ l.verificationStatus_Display || t(`allies.licenses.status.${l.verificationStatus}`) }}
            </UBadge>
            <template v-if="canVerify">
              <UButton
                v-if="l.verificationStatus !== 'VERIFIED'"
                color="success"
                variant="ghost"
                size="xs"
                icon="i-lucide-badge-check"
                :label="t('allies.licenses.verify')"
                :loading="mutating === l.uuid"
                @click="verify(l, 'VERIFIED')"
              />
              <UButton
                v-if="l.verificationStatus !== 'REJECTED'"
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-badge-x"
                :label="t('allies.licenses.reject')"
                :loading="mutating === l.uuid"
                @click="verify(l, 'REJECTED')"
              />
            </template>
            <UButton
              v-if="canUpdate"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-pencil"
              :aria-label="t('common.edit')"
              :disabled="mutating === l.uuid"
              @click="openEdit(l)"
            />
            <UButton
              v-if="canDelete"
              color="error"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              :aria-label="t('common.delete')"
              :disabled="mutating === l.uuid"
              @click="deleteTarget = l"
            />
          </div>
        </li>
      </ul>
    </div>

    <UModal
      v-model:open="formOpen"
      :title="editing ? t('allies.licenses.form.editTitle') : t('allies.licenses.form.createTitle')"
      :description="editing ? t('allies.licenses.form.editDescription') : t('allies.licenses.form.createDescription')"
    >
      <template #body>
        <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField :label="t('allies.licenses.form.body')" name="licensingBodyUuid" required>
            <USelectMenu
              v-model="state.licensingBodyUuid"
              :items="bodyOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('allies.licenses.form.number')" name="licenseNumber" required>
            <UInput v-model="state.licenseNumber" maxlength="40" class="w-full" />
          </UFormField>
        </UForm>
      </template>
      <template #footer>
        <div class="flex w-full items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="formOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="submitting" @click="formRef?.submit()">
            {{ t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" :title="t('allies.licenses.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ t('allies.licenses.deleteBody', { body: deleteTarget?.licensingBody_Display ?? '', number: deleteTarget?.licenseNumber ?? '' }) }}
        </p>
      </template>
      <template #footer>
        <div class="flex w-full items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="mutating !== null" @click="deleteTarget = null">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="mutating !== null" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
