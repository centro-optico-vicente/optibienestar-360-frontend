<script setup lang="ts">
import { z } from 'zod'
import type { PromoterReferenceDto, PromoterReferenceRequest } from '~/types/promoters'

// "Referencias" tab of the advisor detail (backend V180, dossier section IV):
// personal references (1..n) — table + create/edit modal + delete confirmation.
const props = defineProps<{
  promoterUuid: string
  /** PROMOTER_UPDATE and not the INSTITUCION system row. */
  canEdit: boolean
}>()

const { t } = useI18n()
const promoters = usePromoters()
const toast = useToast()

const references = ref<PromoterReferenceDto[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    references.value = await promoters.listReferences(props.promoterUuid)
  }
  catch {
    references.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
defineExpose({ load })

function documentLabel(r: PromoterReferenceDto): string {
  return r.documentType && r.documentNumber ? `${r.documentType}-${r.documentNumber}` : t('common.empty')
}

// ---- Create / edit modal ----
const formOpen = ref(false)
const editingUuid = ref<string | null>(null)
const saving = ref(false)

interface FormState {
  firstName: string
  lastName: string
  documentType: 'V' | 'E' | undefined
  documentNumber: string
  phone: string
}

const state = reactive<FormState>({ firstName: '', lastName: '', documentType: undefined, documentNumber: '', phone: '' })

const documentTypeOptions = computed(() => [
  { label: t('promoters.dossier.documentTypes.V'), value: 'V' },
  { label: t('promoters.dossier.documentTypes.E'), value: 'E' },
])

const schema = computed(() => z.object({
  firstName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  lastName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  documentNumber: z.string().regex(/^(\d{1,9})?$/, t('promoters.dossier.validation.documentNumber')).optional(),
  phone: z.string().max(30, t('validation.maxChars', { n: 30 })).optional(),
}).refine(v => Boolean(state.documentType) === Boolean(v.documentNumber?.trim()), {
  message: t('promoters.references.documentPair'),
  path: ['documentNumber'],
}))

function openCreate() {
  editingUuid.value = null
  Object.assign(state, { firstName: '', lastName: '', documentType: undefined, documentNumber: '', phone: '' })
  formOpen.value = true
}

function openEdit(r: PromoterReferenceDto) {
  editingUuid.value = r.uuid
  Object.assign(state, {
    firstName: r.firstName,
    lastName: r.lastName,
    documentType: r.documentType ?? undefined,
    documentNumber: r.documentNumber ?? '',
    phone: r.phone ?? '',
  })
  formOpen.value = true
}

async function onSubmit() {
  saving.value = true
  try {
    // Blank optional fields are sent as '' so an edit can clear them.
    const body: PromoterReferenceRequest = {
      firstName: state.firstName.trim(),
      lastName: state.lastName.trim(),
      documentType: state.documentType ?? '',
      documentNumber: state.documentNumber.trim(),
      phone: state.phone.trim(),
    }
    if (editingUuid.value) {
      await promoters.updateReference(props.promoterUuid, editingUuid.value, body)
      toast.add({ title: t('promoters.references.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      await promoters.createReference(props.promoterUuid, body)
      toast.add({ title: t('promoters.references.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // useApi already reported the API error.
  }
  finally {
    saving.value = false
  }
}

function submitForm() {
  document.querySelector<HTMLFormElement>('[data-promoter-reference-form]')?.requestSubmit()
}

// ---- Delete ----
const deleteTarget = ref<PromoterReferenceDto | null>(null)
const deleting = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await promoters.removeReference(props.promoterUuid, deleteTarget.value.uuid)
    toast.add({ title: t('promoters.references.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteTarget.value = null
    await load()
  }
  catch {
    // useApi already reported the API error.
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('promoters.references.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('promoters.references.hint') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
        <UButton v-if="canEdit" size="xs" color="primary" icon="i-lucide-plus" @click="openCreate">
          {{ t('promoters.references.add') }}
        </UButton>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-6 py-3 font-semibold">{{ t('promoters.references.columns.name') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('promoters.references.columns.document') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('promoters.references.columns.phone') }}</th>
            <th v-if="canEdit" class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <TableSkeleton v-if="loading" :rows="2" :cols="canEdit ? 4 : 3" />
          <tr v-else-if="references.length === 0">
            <td :colspan="canEdit ? 4 : 3" class="px-6 py-10 text-center text-prohealth-500">
              <UIcon name="i-lucide-contact" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
              {{ t('promoters.references.empty') }}
            </td>
          </tr>
          <tr v-for="r in references" v-else :key="r.uuid" class="hover:bg-prohealth-50/50">
            <td class="px-6 py-3 font-semibold text-prohealth-900">{{ r.firstName }} {{ r.lastName }}</td>
            <td class="px-6 py-3 text-prohealth-700 font-mono">{{ documentLabel(r) }}</td>
            <td class="px-6 py-3 text-prohealth-700">{{ r.phone || t('common.empty') }}</td>
            <td v-if="canEdit" class="px-6 py-3 text-right whitespace-nowrap">
              <UButton color="info" variant="ghost" size="xs" icon="i-lucide-pencil" :aria-label="t('common.edit')" @click="openEdit(r)" />
              <UButton color="error" variant="ghost" size="xs" icon="i-lucide-trash-2" :aria-label="t('common.delete')" @click="deleteTarget = r" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / edit -->
    <UModal v-model:open="formOpen" :title="editingUuid ? t('promoters.references.editTitle') : t('promoters.references.createTitle')">
      <template #body>
        <UForm data-promoter-reference-form :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('promoters.dossier.fields.firstName')" name="firstName" required>
              <UInput v-model="state.firstName" class="w-full" />
            </UFormField>
            <UFormField :label="t('promoters.dossier.fields.lastName')" name="lastName" required>
              <UInput v-model="state.lastName" class="w-full" />
            </UFormField>
            <UFormField :label="t('promoters.dossier.fields.documentType')" name="documentType">
              <USelect v-model="state.documentType" :items="documentTypeOptions" class="w-full" :placeholder="t('common.select')" />
            </UFormField>
            <UFormField :label="t('promoters.dossier.fields.documentNumber')" name="documentNumber">
              <UInput v-model="state.documentNumber" inputmode="numeric" class="w-full" />
            </UFormField>
            <UFormField class="sm:col-span-2" :label="t('promoters.references.columns.phone')" name="phone">
              <UInput v-model="state.phone" class="w-full" />
            </UFormField>
          </div>
          <button type="submit" class="hidden" />
        </UForm>
      </template>
      <template #footer>
        <div class="flex w-full items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="saving" @click="formOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="primary" variant="outline" icon="i-lucide-save" :loading="saving" @click="submitForm">{{ t('common.save') }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation -->
    <UModal :open="Boolean(deleteTarget)" :title="t('promoters.references.deleteTitle')" @update:open="v => { if (!v) deleteTarget = null }">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ t('promoters.references.deleteConfirm', { name: deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : '' }) }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteTarget = null">{{ t('common.cancel') }}</UButton>
          <UButton color="error" icon="i-lucide-trash-2" :loading="deleting" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
