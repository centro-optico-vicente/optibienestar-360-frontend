<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ReferralCodeIssueResponse } from '~/types/promoters'

// Issues / regenerates a member's affiliate referral code (POST /v1/admin/referral-codes,
// REFERRAL_CODE_CREATE). Self-gated: renders nothing without the permission. Embedded in
// the member detail page (/dashboard/members/[uuid]) like MemberMembershipsCard.
const props = defineProps<{ memberUuid: string }>()

const { t } = useI18n()
const { formatDate } = useFormatters()
const referrals = useReferrals()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('REFERRAL_CODE_CREATE'))

// Last issuance result (MemberDto carries no referralCode, so we only know the code
// after issuing it in this session).
const result = ref<ReferralCodeIssueResponse | null>(null)

const formOpen = ref(false)
const submitting = ref(false)
const state = reactive({ customCode: '' })

const schema = computed(() => z.object({
  // Optional vanity code: 4–20 chars A–Z, 0–9, dashes. Empty = auto-generate.
  customCode: z.string().regex(/^[A-Z0-9-]{4,20}$/, t('referrals.code.form.customCodeFormat')).optional().or(z.literal('')),
}))

function openForm() {
  state.customCode = ''
  formOpen.value = true
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  submitting.value = true
  try {
    result.value = await referrals.issueCode({
      memberUuid: props.memberUuid,
      customCode: state.customCode.trim() || undefined,
    })
    toast.add({ title: t('referrals.code.issuedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    formOpen.value = false
  }
  catch {
    // toast handled by useApi
  }
  finally {
    submitting.value = false
  }
}

// Copy-to-clipboard with a short "copied" confirmation.
const copied = ref(false)
async function copyCode() {
  if (!result.value || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(result.value.referralCode)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
  catch {
    // clipboard may be unavailable (insecure context); ignore silently
  }
}
</script>

<template>
  <div v-if="canCreate" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('referrals.code.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('referrals.code.subtitle') }}</p>
      </div>
      <UButton
        color="primary"
        variant="soft"
        icon="i-lucide-ticket"
        size="sm"
        @click="openForm"
      >
        {{ t('referrals.code.issue') }}
      </UButton>
    </div>

    <div class="p-6">
      <!-- No code issued yet in this session -->
      <div v-if="!result" class="text-center py-4 text-prohealth-500">
        <UIcon name="i-lucide-ticket" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
        <p class="text-sm">{{ t('referrals.code.hint') }}</p>
      </div>

      <!-- Result of the last issuance -->
      <div v-else class="space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2 rounded-xl bg-prohealth-50 border border-prohealth-100 px-4 py-2.5">
            <span class="font-mono text-lg font-bold tracking-wider text-prohealth-900">{{ result.referralCode }}</span>
            <UTooltip :text="copied ? t('referrals.code.copied') : t('referrals.code.copy')">
              <UButton
                :color="copied ? 'success' : 'neutral'"
                variant="ghost"
                :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                size="sm"
                @click="copyCode"
              />
            </UTooltip>
          </div>
          <UBadge :color="result.generated ? 'primary' : 'info'" variant="subtle" size="sm">
            {{ result.generated ? t('referrals.code.generatedAuto') : t('referrals.code.generatedCustom') }}
          </UBadge>
        </div>

        <dl class="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div v-if="result.previousCode">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('referrals.code.previousCode') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono line-through">{{ result.previousCode }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('referrals.code.holder') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ result.memberFullName }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('referrals.code.issuedAt') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(result.issuedAt, 'short') }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Issue / regenerate modal -->
    <UModal
      v-model:open="formOpen"
      :title="t('referrals.code.form.title')"
      :description="t('referrals.code.form.description')"
    >
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField
            :label="t('referrals.code.form.customCode')"
            name="customCode"
            :help="t('referrals.code.form.customCodeHelp')"
          >
            <UInput
              v-model="state.customCode"
              placeholder="VICENTE-2026"
              class="w-full font-mono"
            />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="submitting" @click="formOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton type="submit" color="primary" :loading="submitting" icon="i-lucide-ticket">
              {{ t('referrals.code.form.submit') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
