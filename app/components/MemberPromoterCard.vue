<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { MemberPromoterAssignmentDto } from '~/types/members'
import type { PromoterDto } from '~/types/promoters'

// Permanent member↔promoter link (v2 PDF 2.a): current promoter + reassign/link-by-code
// + history. Embedded in the member detail page (/dashboard/members/[uuid]) like
// MemberReferralCodeCard. Self-gated on MEMBER_ASSIGN_PROMOTER for the mutating actions;
// the current-promoter display and history are visible to anyone who can view the card
// (the page itself already gates on MEMBER_VIEW_ALL).
const props = defineProps<{
  memberUuid: string
  currentPromoterUuid?: string | null
  currentPromoterName?: string | null
}>()

const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const { formatDate } = useFormatters()
const members = useMembers()
const promoters = usePromoters()
const { can } = usePermissions()
const toast = useToast()

const canAssign = computed(() => can('MEMBER_ASSIGN_PROMOTER'))

// ---- History ----
const history = ref<MemberPromoterAssignmentDto[]>([])
const historyLoading = ref(false)

async function loadHistory() {
  historyLoading.value = true
  try {
    history.value = await members.promoterHistory(props.memberUuid)
  }
  catch {
    history.value = []
  }
  finally {
    historyLoading.value = false
  }
}

onMounted(loadHistory)

// ---- Change / link form ----
// Same modal covers both flows: "change" (target picked from the list) when the member
// already has a promoter, "link by code" when it doesn't — the backend endpoint accepts
// promoterUuid XOR referralCode either way.
const formOpen = ref(false)
const submitting = ref(false)
const promoterOptions = ref<{ label: string, value: string }[]>([])
const loadingOptions = ref(false)

const state = reactive({
  mode: 'select' as 'select' | 'code',
  promoterUuid: undefined as string | undefined,
  referralCode: '',
  reason: '',
})

const schema = computed(() => z.object({
  promoterUuid: state.mode === 'select' ? z.string({ message: t('validation.required') }) : z.string().optional(),
  referralCode: state.mode === 'code'
    ? z.string().regex(/^[A-Z0-9-]{4,20}$/, t('referrals.code.form.customCodeFormat'))
    : z.string().optional(),
  reason: z.string().min(3, t('validation.minChars', { n: 3 })),
}))

async function loadPromoterOptions() {
  loadingOptions.value = true
  try {
    const page = await promoters.list({ size: 100, sort: 'displayName,asc' })
    promoterOptions.value = (page.content ?? [])
      .filter((p: PromoterDto) => p.active && p.uuid !== props.currentPromoterUuid)
      .map((p: PromoterDto) => ({ label: p.displayName, value: p.uuid }))
  }
  catch {
    promoterOptions.value = []
  }
  finally {
    loadingOptions.value = false
  }
}

function openForm(mode: 'select' | 'code') {
  state.mode = mode
  state.promoterUuid = undefined
  state.referralCode = ''
  state.reason = ''
  formOpen.value = true
  if (mode === 'select') loadPromoterOptions()
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  submitting.value = true
  try {
    await members.assignPromoter(props.memberUuid, {
      promoterUuid: state.mode === 'select' ? state.promoterUuid : undefined,
      referralCode: state.mode === 'code' ? state.referralCode.trim().toUpperCase() : undefined,
      reason: state.reason,
    })
    toast.add({
      title: props.currentPromoterUuid ? t('members.promoter.changedToast') : t('members.promoter.linkedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    formOpen.value = false
    await loadHistory()
    emit('changed')
  }
  catch {
    // toast handled by useApi
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('members.promoter.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('members.promoter.subtitle') }}</p>
      </div>
      <div v-if="canAssign" class="flex items-center gap-2">
        <UButton
          v-if="!currentPromoterUuid"
          color="primary"
          variant="soft"
          icon="i-lucide-link"
          size="sm"
          @click="openForm('code')"
        >
          {{ t('members.promoter.linkButton') }}
        </UButton>
        <UButton
          v-else
          color="primary"
          variant="soft"
          icon="i-lucide-repeat"
          size="sm"
          @click="openForm('select')"
        >
          {{ t('members.promoter.changeButton') }}
        </UButton>
      </div>
    </div>

    <div class="px-6 py-4">
      <div class="flex items-center gap-3">
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.promoter.current') }}</dt>
        <dd v-if="currentPromoterUuid">
          <NuxtLink :to="`/dashboard/promoters/${currentPromoterUuid}`" class="text-primary-600 hover:underline font-semibold">
            {{ currentPromoterName }}
          </NuxtLink>
        </dd>
        <dd v-else class="text-prohealth-400">{{ t('members.promoter.none') }}</dd>
      </div>
    </div>

    <!-- History -->
    <div class="border-t border-prohealth-100">
      <div class="px-6 py-3">
        <h3 class="text-sm font-semibold text-prohealth-800">{{ t('members.promoter.history.title') }}</h3>
      </div>
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-6 py-2 font-semibold">{{ t('members.promoter.history.columns.from') }}</th>
              <th class="px-6 py-2 font-semibold">{{ t('members.promoter.history.columns.to') }}</th>
              <th class="px-6 py-2 font-semibold">{{ t('members.promoter.history.columns.date') }}</th>
              <th class="px-6 py-2 font-semibold">{{ t('members.promoter.history.columns.reason') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="historyLoading" :rows="2" :cols="4" />
            <tr v-else-if="history.length === 0">
              <td colspan="4" class="px-6 py-6 text-center text-prohealth-400 text-sm">
                {{ t('members.promoter.history.empty') }}
              </td>
            </tr>
            <tr v-for="row in history" v-else :key="row.uuid">
              <td class="px-6 py-2 text-prohealth-600">{{ row.fromPromoterName || t('members.promoter.none') }}</td>
              <td class="px-6 py-2 text-prohealth-800 font-medium">{{ row.toPromoterName }}</td>
              <td class="px-6 py-2 text-prohealth-600">{{ formatDate(row.assignedAt, 'short') }}</td>
              <td class="px-6 py-2 text-prohealth-600">{{ row.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Change / link modal -->
    <UModal
      v-model:open="formOpen"
      :title="state.mode === 'select' ? t('members.promoter.form.changeTitle') : t('members.promoter.form.linkTitle')"
      :description="state.mode === 'select' ? t('members.promoter.form.changeDescription') : t('members.promoter.form.linkDescription')"
    >
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-info"
            :description="t('members.promoter.permanentNotice')"
          />

          <UFormField v-if="state.mode === 'select'" :label="t('members.promoter.form.promoter')" name="promoterUuid" required>
            <USelectMenu
              v-model="state.promoterUuid"
              :items="promoterOptions"
              :loading="loadingOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>

          <UFormField v-else :label="t('members.promoter.form.referralCode')" name="referralCode" required>
            <UInput v-model="state.referralCode" placeholder="VICENTE-2026" class="w-full font-mono" />
          </UFormField>

          <UFormField :label="t('members.promoter.form.reason')" name="reason" required>
            <UTextarea
              v-model="state.reason"
              :rows="2"
              :placeholder="t('members.promoter.form.reasonPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="submitting" @click="formOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton type="submit" color="primary" :loading="submitting" icon="i-lucide-save">
              {{ t('members.promoter.form.submit') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
