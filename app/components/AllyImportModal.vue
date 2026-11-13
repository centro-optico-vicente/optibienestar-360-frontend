<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import { ALLY_IMPORT_DELIMITERS, type AllyImportDelimiter, type AllyImportResultDto } from '~/types/allyRequests'

// Bulk load of allies from the hub template (hub ADR 0036, plan delivery 7):
// POST /v1/admin/ally-requests/import. The file is first validated with
// dryRun=true (summary + errors per row/column); only an error-free file can be
// confirmed, which re-sends the same file with dryRun=false (all or nothing).
// The allies are created PENDING / IMPORT, unpublished and without a user.
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ imported: [result: AllyImportResultDto] }>()

const { t } = useI18n()
const toast = useToast()
const api = useAllyRequests()

const ACCEPT = '.xlsx,.csv,.tsv,.txt'

const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const delimiter = ref<AllyImportDelimiter>('auto')
const validation = ref<AllyImportResultDto | null>(null)
const result = ref<AllyImportResultDto | null>(null)
const validating = ref(false)
const importing = ref(false)
const downloading = ref<'xlsx' | 'csv' | null>(null)

const delimiterItems = computed(() => ALLY_IMPORT_DELIMITERS.map(d => ({ value: d, label: t(`allyRequests.import.delimiters.${d}`) })))
// The delimiter only matters for text files (CSV/TSV/TXT).
const isTextFile = computed(() => !!file.value && !file.value.name.toLowerCase().endsWith('.xlsx'))
const canConfirm = computed(() => !!validation.value && validation.value.errors.length === 0 && validation.value.validRows > 0)

function reset() {
  file.value = null
  if (fileInput.value) fileInput.value.value = ''
  delimiter.value = 'auto'
  validation.value = null
  result.value = null
}

watch(open, (isOpen) => { if (isOpen) reset() })

function onFileChange(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
  validation.value = null
  result.value = null
}

// A new delimiter invalidates the previous dry-run.
watch(delimiter, () => { validation.value = null })

async function validate() {
  if (!file.value) return
  validating.value = true
  result.value = null
  try {
    validation.value = await api.importFile(file.value, true, delimiter.value)
  }
  catch (err) {
    validation.value = null
    // 400 is not toasted by useApi (e.g. unreadable file / missing sheet).
    const e = err as ApiError
    if (e.status === 400) toast.add({ title: e.message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    validating.value = false
  }
}

async function confirmImport() {
  if (!file.value || !canConfirm.value) return
  importing.value = true
  try {
    const res = await api.importFile(file.value, false, delimiter.value)
    if (res.errors?.length) {
      // The data changed between the dry-run and the import: show the new errors.
      validation.value = res
      return
    }
    result.value = res
    validation.value = null
    toast.add({ title: t('allyRequests.import.doneToast', { count: res.createdRows }), color: 'success', icon: 'i-lucide-check-circle' })
    emit('imported', res)
  }
  catch (err) {
    const e = err as ApiError
    if (e.status === 400) toast.add({ title: e.message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    importing.value = false
  }
}

async function downloadTemplate(format: 'xlsx' | 'csv') {
  downloading.value = format
  try {
    const blob = await api.downloadTemplate(format)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `plantilla-registro-aliados.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
  catch { /* toast handled by useApi */ }
  finally {
    downloading.value = null
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('allyRequests.import.title')" :description="t('allyRequests.import.description')" :ui="{ content: 'sm:max-w-3xl' }">
    <template #body>
      <div class="space-y-5">
        <!-- Templates -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-prohealth-700">{{ t('allyRequests.import.templates') }}</span>
          <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-file-spreadsheet" :loading="downloading === 'xlsx'" @click="downloadTemplate('xlsx')">
            Excel (.xlsx)
          </UButton>
          <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-file-text" :loading="downloading === 'csv'" @click="downloadTemplate('csv')">
            CSV
          </UButton>
        </div>

        <!-- File + delimiter -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField :label="t('allyRequests.import.file')" :help="t('allyRequests.import.fileHelp')" class="sm:col-span-2">
            <input
              ref="fileInput"
              type="file"
              :accept="ACCEPT"
              class="block w-full text-sm text-prohealth-600 file:mr-3 file:rounded-lg file:border-0 file:bg-prohealth-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-prohealth-700 hover:file:bg-prohealth-100"
              @change="onFileChange"
            >
          </UFormField>
          <UFormField :label="t('allyRequests.import.delimiter')" :help="t('allyRequests.import.delimiterHelp')">
            <USelectMenu value-key="value" v-model="delimiter" :items="delimiterItems" :disabled="!isTextFile" class="w-full" />
          </UFormField>
        </div>

        <!-- Dry-run summary -->
        <div v-if="validation" class="rounded-xl border p-4 space-y-3" :class="validation.errors.length ? 'border-red-200 bg-red-50/40' : 'border-green-200 bg-green-50/40'">
          <p class="text-sm font-semibold" :class="validation.errors.length ? 'text-red-700' : 'text-green-700'">
            {{ validation.errors.length ? t('allyRequests.import.hasErrors', { count: validation.errors.length }) : t('allyRequests.import.noErrors') }}
          </p>
          <p class="text-xs text-prohealth-600">
            {{ t('allyRequests.import.summary', { format: validation.format, total: validation.totalRows, valid: validation.validRows }) }}
            <template v-if="validation.delimiter"> · {{ t('allyRequests.import.detectedDelimiter', { delimiter: validation.delimiter }) }}</template>
          </p>
          <div v-if="validation.errors.length" class="max-h-72 overflow-auto rounded-lg border border-prohealth-100 bg-white">
            <table class="w-full text-sm">
              <thead class="bg-prohealth-50/60 sticky top-0">
                <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400">
                  <th class="px-3 py-2 font-semibold">{{ t('allyRequests.import.columns.row') }}</th>
                  <th class="px-3 py-2 font-semibold">{{ t('allyRequests.import.columns.column') }}</th>
                  <th class="px-3 py-2 font-semibold">{{ t('allyRequests.import.columns.message') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-prohealth-100">
                <tr v-for="(e, i) in validation.errors" :key="i">
                  <td class="px-3 py-2 font-mono text-prohealth-700">{{ e.row }}</td>
                  <td class="px-3 py-2 text-prohealth-700">{{ e.column || t('common.empty') }}</td>
                  <td class="px-3 py-2 text-prohealth-800">{{ e.message }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <UAlert
          v-if="result"
          color="success"
          variant="subtle"
          icon="i-lucide-check-circle"
          :title="t('allyRequests.import.doneToast', { count: result.createdRows })"
          :description="t('allyRequests.import.doneBody')"
        />

        <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
          <UButton color="neutral" variant="ghost" @click="open = false">{{ result ? t('common.close') : t('common.cancel') }}</UButton>
          <UButton v-if="!result" color="primary" variant="outline" icon="i-lucide-file-check" :disabled="!file" :loading="validating" @click="validate">
            {{ t('allyRequests.import.validate') }}
          </UButton>
          <UButton v-if="!result" color="primary" icon="i-lucide-upload" :disabled="!canConfirm" :loading="importing" @click="confirmImport">
            {{ t('allyRequests.import.confirm') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
