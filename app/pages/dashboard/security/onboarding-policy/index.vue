<script setup lang="ts">
import {
  ALLY_APPROVAL_MODES,
  ALLY_PUBLISH_MODES,
  MEMBER_ACTIVATION_MODES,
  MEMBER_APPROVAL_MODES,
  type OnboardingPolicyDto,
  type OnboardingPolicyUpdateRequest,
} from '~/types/onboardingPolicy'

// Onboarding policy (hub ADR 0037 §1): which self-registrations are open and
// how requests are approved and activated. While a self-registration is off,
// its modes are read-only (the backend rejects a change with 422).
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ONBOARDING_POLICY_VIEW',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('onboardingPolicy.seoTitle') })

const api = useOnboardingPolicy()
const { can } = usePermissions()
const toast = useToast()
const publicPolicy = usePublicOnboardingPolicy()

const canUpdate = computed(() => can('ONBOARDING_POLICY_UPDATE'))

const loading = ref(false)
const isSubmitting = ref(false)

const state = reactive<OnboardingPolicyUpdateRequest>({
  allowMemberSelfRegistration: true,
  allowAllySelfRegistration: true,
  memberApprovalMode: 'MANUAL',
  memberActivationMode: 'ON_PAYMENT_APPROVED',
  allyApprovalMode: 'MANUAL_WITH_AGREEMENT',
  allyPublishMode: 'MANUAL',
})

/** Values last loaded from the server: the modes of a switched-off registration snap back to these. */
const saved = ref<OnboardingPolicyUpdateRequest | null>(null)

const snapshot = ref('')
const isDirty = computed(() => snapshot.value !== '' && JSON.stringify(state) !== snapshot.value)
const discardConfirmOpen = ref(false)

// Read-only while the registration is off (as saved on the server, or switched off now).
const memberModesLocked = computed(() => !canUpdate.value || isSubmitting.value || !state.allowMemberSelfRegistration)
const allyModesLocked = computed(() => !canUpdate.value || isSubmitting.value || !state.allowAllySelfRegistration)

// Switching a registration off puts back its saved modes, so the PUT never
// changes the modes of a closed registration.
watch(() => state.allowMemberSelfRegistration, (open) => {
  if (!open && saved.value) {
    state.memberApprovalMode = saved.value.memberApprovalMode
    state.memberActivationMode = saved.value.memberActivationMode
  }
})
watch(() => state.allowAllySelfRegistration, (open) => {
  if (!open && saved.value) {
    state.allyApprovalMode = saved.value.allyApprovalMode
    state.allyPublishMode = saved.value.allyPublishMode
  }
})

function options<T extends string>(group: string, values: readonly T[]) {
  return values.map(value => ({
    value,
    label: t(`onboardingPolicy.modes.${group}.${value}.label`),
    description: t(`onboardingPolicy.modes.${group}.${value}.help`),
  }))
}

const memberApprovalOptions = computed(() => options('memberApproval', MEMBER_APPROVAL_MODES))
const memberActivationOptions = computed(() => options('memberActivation', MEMBER_ACTIVATION_MODES))
const allyApprovalOptions = computed(() => options('allyApproval', ALLY_APPROVAL_MODES))
const allyPublishOptions = computed(() => options('allyPublish', ALLY_PUBLISH_MODES))

/** Plain-language summary of the resulting affiliate flow. */
const memberFlow = computed(() => {
  if (!state.allowMemberSelfRegistration) return [t('onboardingPolicy.flow.memberClosed')]
  return [
    t('onboardingPolicy.flow.memberSubmit'),
    t(`onboardingPolicy.flow.memberApproval.${state.memberApprovalMode}`),
    t(`onboardingPolicy.flow.memberActivation.${state.memberActivationMode}`),
  ]
})

/** Plain-language summary of the resulting ally flow. */
const allyFlow = computed(() => {
  if (!state.allowAllySelfRegistration) return [t('onboardingPolicy.flow.allyClosed')]
  return [
    t('onboardingPolicy.flow.allySubmit'),
    t(`onboardingPolicy.flow.allyApproval.${state.allyApprovalMode}`),
    t(`onboardingPolicy.flow.allyPublish.${state.allyPublishMode}`),
  ]
})

function applyDto(dto: OnboardingPolicyDto) {
  state.allowMemberSelfRegistration = dto.allowMemberSelfRegistration
  state.allowAllySelfRegistration = dto.allowAllySelfRegistration
  state.memberApprovalMode = dto.memberApprovalMode
  state.memberActivationMode = dto.memberActivationMode
  state.allyApprovalMode = dto.allyApprovalMode
  state.allyPublishMode = dto.allyPublishMode
  saved.value = { ...state }
}

async function load() {
  loading.value = true
  try {
    applyDto(await api.get())
  }
  catch {
    // handled by useApi
  }
  finally {
    loading.value = false
    snapshot.value = JSON.stringify(state)
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

async function onSubmit() {
  if (!canUpdate.value) return
  isSubmitting.value = true
  try {
    applyDto(await api.update({ ...state }))
    snapshot.value = JSON.stringify(state)
    // The public pages read the cached public view: refresh it for this session.
    void publicPolicy.load(true)
    toast.add({ title: t('onboardingPolicy.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch {
    // handled by useApi
  }
  finally {
    isSubmitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('onboardingPolicy.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('onboardingPolicy.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <RefreshButton
          :loading="loading"
          :icon-only="false"
          :label="t('common.refresh')"
          :title="t('common.refresh')"
          @refresh="onRefresh"
        />
        <UButton
          v-if="canUpdate"
          color="info"
          variant="outline"
          icon="i-lucide-save"
          :loading="isSubmitting"
          :disabled="loading"
          @click="onSubmit"
        >
          {{ t('common.save') }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
      <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
      <span class="text-sm">{{ t('common.loading') }}</span>
    </div>

    <template v-else>
      <UAlert
        v-if="!canUpdate"
        color="info"
        variant="subtle"
        icon="i-lucide-eye"
        :title="t('onboardingPolicy.readOnly')"
      />

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <!-- Affiliates -->
        <section class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-prohealth-900">{{ t('onboardingPolicy.member.title') }}</h2>
              <p class="text-sm text-prohealth-700/70 mt-1">{{ t('onboardingPolicy.member.subtitle') }}</p>
            </div>
            <USwitch
              v-model="state.allowMemberSelfRegistration"
              :label="t('onboardingPolicy.member.allow')"
              :disabled="!canUpdate || isSubmitting"
            />
          </div>

          <UAlert
            v-if="!state.allowMemberSelfRegistration"
            color="warning"
            variant="subtle"
            icon="i-lucide-qr-code"
            :title="t('onboardingPolicy.member.closedTitle')"
            :description="t('onboardingPolicy.member.closedBody')"
          />

          <UFormField :label="t('onboardingPolicy.member.approval')" :help="memberModesLocked && canUpdate ? t('onboardingPolicy.lockedHelp') : undefined">
            <URadioGroup v-model="state.memberApprovalMode" :items="memberApprovalOptions" :disabled="memberModesLocked" />
          </UFormField>

          <UFormField :label="t('onboardingPolicy.member.activation')">
            <URadioGroup v-model="state.memberActivationMode" :items="memberActivationOptions" :disabled="memberModesLocked" />
          </UFormField>

          <div class="rounded-xl bg-prohealth-50 border border-prohealth-100 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-prohealth-600 mb-2">{{ t('onboardingPolicy.flow.title') }}</p>
            <ol class="flex flex-wrap items-center gap-2 text-sm text-prohealth-800">
              <template v-for="(step, i) in memberFlow" :key="i">
                <li>{{ step }}</li>
                <UIcon v-if="i < memberFlow.length - 1" name="i-lucide-arrow-right" class="w-4 h-4 text-prohealth-400" />
              </template>
            </ol>
          </div>
        </section>

        <!-- Allies -->
        <section class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-prohealth-900">{{ t('onboardingPolicy.ally.title') }}</h2>
              <p class="text-sm text-prohealth-700/70 mt-1">{{ t('onboardingPolicy.ally.subtitle') }}</p>
            </div>
            <USwitch
              v-model="state.allowAllySelfRegistration"
              :label="t('onboardingPolicy.ally.allow')"
              :disabled="!canUpdate || isSubmitting"
            />
          </div>

          <UAlert
            v-if="!state.allowAllySelfRegistration"
            color="warning"
            variant="subtle"
            icon="i-lucide-info"
            :title="t('onboardingPolicy.ally.closedTitle')"
            :description="t('onboardingPolicy.ally.closedBody')"
          />

          <UFormField :label="t('onboardingPolicy.ally.approval')" :help="allyModesLocked && canUpdate ? t('onboardingPolicy.lockedHelp') : undefined">
            <URadioGroup v-model="state.allyApprovalMode" :items="allyApprovalOptions" :disabled="allyModesLocked" />
          </UFormField>

          <UFormField :label="t('onboardingPolicy.ally.publish')">
            <URadioGroup v-model="state.allyPublishMode" :items="allyPublishOptions" :disabled="allyModesLocked" />
          </UFormField>

          <div class="rounded-xl bg-prohealth-50 border border-prohealth-100 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-prohealth-600 mb-2">{{ t('onboardingPolicy.flow.title') }}</p>
            <ol class="flex flex-wrap items-center gap-2 text-sm text-prohealth-800">
              <template v-for="(step, i) in allyFlow" :key="i">
                <li>{{ step }}</li>
                <UIcon v-if="i < allyFlow.length - 1" name="i-lucide-arrow-right" class="w-4 h-4 text-prohealth-400" />
              </template>
            </ol>
          </div>
        </section>
      </div>
    </template>

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
