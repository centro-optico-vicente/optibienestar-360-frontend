<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { toSelectItems, type SelectItem } from '~/types/options'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ORGANIZATION_VIEW',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('organization.seoTitle') })

const organizationApi = useOrganization()
const currenciesApi = useCurrencies()
const { can } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('ORGANIZATION_UPDATE'))

const loading = ref(false)
const isSubmitting = ref(false)
const currencyItems = ref<SelectItem[]>([])
const loadingCurrencies = ref(false)

const state = reactive({
  name: '',
  legalName: '',
  taxIdentifier: '',
  logoKey: '',
  officialCurrencyUuid: undefined as string | undefined,
  referenceCurrencyUuid: undefined as string | undefined,
})

const schema = computed(() =>
  z.object({
    name: z.string().min(1, t('validation.required')),
    legalName: z.string().optional().or(z.literal('')),
    taxIdentifier: z.string().optional().or(z.literal('')),
    logoKey: z.string().optional().or(z.literal('')),
    officialCurrencyUuid: z.string().optional(),
    referenceCurrencyUuid: z.string().optional(),
  })
)

// Snapshot of the last server-loaded state, used to warn before a refresh
// throws away unsaved edits.
const snapshot = ref('')
function snapshotState() { return JSON.stringify(state) }
const isDirty = computed(() => snapshot.value !== '' && snapshotState() !== snapshot.value)
const discardConfirmOpen = ref(false)

async function loadCurrencyOptions() {
  loadingCurrencies.value = true
  try {
    currencyItems.value = toSelectItems(await currenciesApi.options())
  }
  catch {
    currencyItems.value = []
  }
  finally {
    loadingCurrencies.value = false
  }
}

async function load() {
  loading.value = true
  try {
    const org = await organizationApi.ensureLoaded()
    if (org) {
      state.name = org.name
      state.legalName = org.legalName ?? ''
      state.taxIdentifier = org.taxIdentifier ?? ''
      state.logoKey = org.logoKey ?? ''
      state.officialCurrencyUuid = org.officialCurrency_Uuid ?? undefined
      state.referenceCurrencyUuid = org.referenceCurrency_Uuid ?? undefined
    }
    else {
      toast.add({ title: t('organization.loadError'), color: 'error', icon: 'i-lucide-alert-triangle' })
    }
  }
  finally {
    loading.value = false
    snapshot.value = snapshotState()
  }
}

function onRefresh() {
  if (isDirty.value) discardConfirmOpen.value = true
  else load()
}

function discardAndRefresh() {
  discardConfirmOpen.value = false
  load()
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  if (!canUpdate.value) return
  isSubmitting.value = true
  try {
    const updated = await organizationApi.update({
      name: state.name,
      legalName: state.legalName || undefined,
      taxIdentifier: state.taxIdentifier || undefined,
      logoKey: state.logoKey || undefined,
      officialCurrencyUuid: state.officialCurrencyUuid,
      referenceCurrencyUuid: state.referenceCurrencyUuid,
    })
    state.name = updated.name
    state.legalName = updated.legalName ?? ''
    state.taxIdentifier = updated.taxIdentifier ?? ''
    state.logoKey = updated.logoKey ?? ''
    state.officialCurrencyUuid = updated.officialCurrency_Uuid ?? undefined
    state.referenceCurrencyUuid = updated.referenceCurrency_Uuid ?? undefined
    snapshot.value = snapshotState()
    toast.add({
      title: t('organization.updatedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  }
  catch {
    // handled by useApi
  }
  finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  load()
  loadCurrencyOptions()
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('organization.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('organization.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <RefreshButton
          :loading="loading"
          :icon-only="false"
          :label="t('common.refresh')"
          :title="t('common.refreshRecord')"
          @refresh="onRefresh"
        />
        <UButton
          v-if="canUpdate"
          type="submit"
          form="organization-form"
          color="info"
          variant="outline"
          icon="i-lucide-save"
          :loading="isSubmitting"
          :disabled="loading"
        >
          {{ t('organization.saveButton') }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
      <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
      <span class="text-sm">{{ t('common.loading') }}</span>
    </div>

    <UForm
      v-else
      id="organization-form"
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- Datos generales -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-4">
          <h2 class="text-base font-bold text-prohealth-900">{{ t('organization.sections.general') }}</h2>

          <UFormField :label="t('organization.fields.name')" name="name">
            <UInput
              v-model="state.name"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField :label="t('organization.fields.legalName')" name="legalName">
            <UInput
              v-model="state.legalName"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField :label="t('organization.fields.taxIdentifier')" name="taxIdentifier">
            <UInput
              v-model="state.taxIdentifier"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField
            :label="t('organization.fields.logoKey')"
            :help="t('organization.fields.logoKeyHelp')"
            name="logoKey"
          >
            <UInput
              v-model="state.logoKey"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>
        </div>

        <!-- Monedas -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-4">
          <h2 class="text-base font-bold text-prohealth-900">{{ t('organization.sections.currencies') }}</h2>

          <UFormField
            :label="t('organization.fields.officialCurrency')"
            :help="t('organization.fields.officialCurrencyHelp')"
            name="officialCurrencyUuid"
          >
            <USelectMenu
              v-model="state.officialCurrencyUuid"
              :items="currencyItems"
              label-key="label"
              value-key="value"
              :loading="loadingCurrencies"
              :search-input="false"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField
            :label="t('organization.fields.referenceCurrency')"
            :help="t('organization.fields.referenceCurrencyHelp')"
            name="referenceCurrencyUuid"
          >
            <USelectMenu
              v-model="state.referenceCurrencyUuid"
              :items="currencyItems"
              label-key="label"
              value-key="value"
              :loading="loadingCurrencies"
              :search-input="false"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>
        </div>
      </div>
    </UForm>

    <!-- Discard unsaved changes before refreshing -->
    <UModal v-model:open="discardConfirmOpen" :title="t('common.discardChangesTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('common.discardChangesBody') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="warning" icon="i-lucide-refresh-cw" @click="discardAndRefresh">
            {{ t('common.discardAndRefresh') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
