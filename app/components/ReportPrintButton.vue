<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Table or resource slug (e.g. 'allies', 'members', 'payments'). Inferred from route if omitted. */
    tableName?: string
    /** Record UUID for individual record report. Generates full table list report if omitted. */
    recordUuid?: string
    /** Optional title to customize the report header */
    title?: string
    /** Button color (Nuxt UI style) */
    color?: string
    /** Button variant style */
    variant?: string
    /** Button size */
    size?: string
    /** Button label */
    label?: string
    /** Render only icon (for table row actions) */
    iconOnly?: boolean
  }>(),
  {
    color: 'neutral',
    variant: 'outline',
    size: 'md',
    iconOnly: false,
  }
)

import type { Permission } from '~/types/permissions'

const { t } = useI18n()
const route = useRoute()
const reports = useDocumentReports()
const { can } = usePermissions()
const loading = ref(false)

// Deduce table name automatically from current route path if not passed explicitly
const effectiveTableName = computed(() => {
  if (props.tableName) return props.tableName
  const cleanPath = route.path.replace(/^\/dashboard\//, '').split('?')[0] || ''
  return cleanPath.split('/')[0] || ''
})

const requiredPermission = computed<Permission>(() => {
  const table = effectiveTableName.value.toLowerCase().replace(/[-_]/g, '')
  const map: Record<string, Permission> = {
    allies: 'ALLY_REPORT_GENERATE',
    ally: 'ALLY_REPORT_GENERATE',
    members: 'MEMBER_REPORT_GENERATE',
    member: 'MEMBER_REPORT_GENERATE',
    users: 'USER_REPORT_GENERATE',
    user: 'USER_REPORT_GENERATE',
    plans: 'PLAN_REPORT_GENERATE',
    plan: 'PLAN_REPORT_GENERATE',
    memberships: 'MEMBERSHIP_REPORT_GENERATE',
    membership: 'MEMBERSHIP_REPORT_GENERATE',
    payments: 'PAYMENT_REPORT_GENERATE',
    payment: 'PAYMENT_REPORT_GENERATE',
    promoters: 'PROMOTER_REPORT_GENERATE',
    promoter: 'PROMOTER_REPORT_GENERATE',
    commissions: 'COMMISSION_REPORT_GENERATE',
    commission: 'COMMISSION_REPORT_GENERATE',
    referrals: 'REFERRAL_REPORT_GENERATE',
    referral: 'REFERRAL_REPORT_GENERATE',
    scheduledjobs: 'JOB_REPORT_GENERATE',
    scheduledjob: 'JOB_REPORT_GENERATE',
  }
  return map[table] || 'REPORT_REPORT_GENERATE'
})

const canPrint = computed(() => can(requiredPermission.value) || can('REPORT_PRINT'))

async function handleDownload(format: 'PDF' | 'XLSX') {
  if (!effectiveTableName.value) return
  loading.value = true
  try {
    if (props.recordUuid) {
      await reports.downloadRecordReport(effectiveTableName.value, props.recordUuid, format, props.title)
    } else {
      await reports.downloadTableReport(effectiveTableName.value, format, props.title)
    }
  } finally {
    loading.value = false
  }
}

const dropdownItems = computed(() => [
  [
    {
      label: t('reports.exportPdf'),
      icon: 'i-lucide-file-text',
      onSelect: () => handleDownload('PDF'),
    },
    {
      label: t('reports.exportExcel'),
      icon: 'i-lucide-file-spreadsheet',
      onSelect: () => handleDownload('XLSX'),
    },
  ],
])

const defaultLabel = computed(() => {
  return props.label || (props.recordUuid ? t('reports.printRecord') : t('reports.printList'))
})
</script>

<template>
  <template v-if="canPrint">
    <div v-if="!iconOnly" class="inline-flex items-center">
      <UButtonGroup>
        <UButton
          :color="(color as any)"
          :variant="(variant as any)"
          :size="(size as any)"
          icon="i-lucide-printer"
          :loading="loading"
          @click="handleDownload('PDF')"
        >
          {{ defaultLabel }}
        </UButton>

        <UDropdownMenu :items="dropdownItems" :content="{ align: 'end' }">
          <UButton
            :color="(color as any)"
            :variant="(variant as any)"
            :size="(size as any)"
            icon="i-lucide-chevron-down"
            :disabled="loading"
            :aria-label="t('reports.printOptions')"
          />
        </UDropdownMenu>
      </UButtonGroup>
    </div>

    <div v-else class="inline-flex items-center">
      <UTooltip :text="defaultLabel">
        <UButton
          :color="(color as any)"
          :variant="(variant as any)"
          :size="(size as any)"
          icon="i-lucide-printer"
          :loading="loading"
          @click="handleDownload('PDF')"
        />
      </UTooltip>
    </div>
  </template>
</template>

