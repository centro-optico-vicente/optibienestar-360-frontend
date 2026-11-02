<script setup lang="ts">
import type { AllyPatientLinkDto, MyMedicalRecordAccessDto } from '~/types/patientAccess'

// "Quién vio mi historia" (hub ADR 0032): the doctors of medical allies who can
// read the caller's medical history — opened when they scanned the credential QR —
// and every time they read it. The member revokes a link here; scanning the QR
// again reopens it. Scope comes from the JWT (the caller's own member record).
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_PATIENT_LINK_VIEW_OWN',
})

const { t } = useI18n()
const { formatDate } = useFormatters()
const { can } = usePermissions()
const patientAccess = usePatientAccess()
const toast = useToast()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('patientAccess.mine.title') }) })

const access = ref<MyMedicalRecordAccessDto>({ links: [], reads: [] })
const loading = ref(true)

const activeLinks = computed(() => access.value.links.filter(l => l.status === 'ACTIVE'))
const revokedLinks = computed(() => access.value.links.filter(l => l.status !== 'ACTIVE'))
const canRevoke = computed(() => can('ALLY_PATIENT_LINK_REVOKE_OWN'))

async function load() {
  loading.value = true
  try {
    access.value = await patientAccess.myAccess()
  }
  catch {
    access.value = { links: [], reads: [] }
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const toRevoke = ref<AllyPatientLinkDto | null>(null)
const revokeOpen = computed({
  get: () => !!toRevoke.value,
  set: (v: boolean) => { if (!v) toRevoke.value = null },
})
const revoking = ref(false)

async function confirmRevoke() {
  if (!toRevoke.value) return
  revoking.value = true
  try {
    await patientAccess.revoke(toRevoke.value.uuid)
    toast.add({ title: t('patientAccess.mine.revokedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    toRevoke.value = null
    await load()
  }
  catch {
    // useApi already notified.
  }
  finally {
    revoking.value = false
  }
}

function when(value?: string | null, display?: string | null): string {
  if (display) return display
  return value ? formatDate(value, 'datetime') : t('common.empty')
}
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('patientAccess.mine.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('patientAccess.mine.subtitle') }}</p>
    </div>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 px-6 py-8 space-y-3">
      <USkeleton class="h-5 w-full rounded" />
      <USkeleton class="h-5 w-3/4 rounded" />
    </div>

    <template v-else>
      <!-- Who can read it now -->
      <section class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <h2 class="px-6 pt-5 pb-2 text-base font-bold text-prohealth-900">{{ t('patientAccess.mine.activeTitle') }}</h2>
        <p v-if="activeLinks.length === 0" class="px-6 pb-5 text-sm text-prohealth-500">
          {{ t('patientAccess.mine.noActive') }}
        </p>
        <ul v-else class="divide-y divide-prohealth-100">
          <li v-for="l in activeLinks" :key="l.uuid" class="px-6 py-3.5 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-prohealth-900">{{ l.doctorFullName || t('common.empty') }}</p>
              <p class="text-xs text-prohealth-500 truncate">
                {{ l.allyName || t('common.empty') }} · {{ t('patientAccess.mine.since', { date: when(l.createdAt, l.createdAt_Display) }) }}
              </p>
            </div>
            <UButton
              v-if="canRevoke"
              color="error"
              variant="soft"
              size="sm"
              icon="i-lucide-shield-off"
              @click="toRevoke = l"
            >
              {{ t('patientAccess.mine.revoke') }}
            </UButton>
          </li>
        </ul>
      </section>

      <!-- Who read it -->
      <section class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <h2 class="px-6 pt-5 pb-2 text-base font-bold text-prohealth-900">{{ t('patientAccess.mine.readsTitle') }}</h2>
        <p v-if="access.reads.length === 0" class="px-6 pb-5 text-sm text-prohealth-500">
          {{ t('patientAccess.mine.noReads') }}
        </p>
        <ul v-else class="divide-y divide-prohealth-100">
          <li v-for="r in access.reads" :key="r.uuid" class="px-6 py-3 flex items-center justify-between gap-3 text-sm">
            <span class="text-prohealth-900">
              {{ r.doctorFullName || t('common.empty') }}
              <span class="text-prohealth-500">· {{ r.allyName || t('common.empty') }}</span>
            </span>
            <span class="text-xs text-prohealth-500 shrink-0">{{ when(r.accessedAt, r.accessedAt_Display) }}</span>
          </li>
        </ul>
      </section>

      <!-- Revoked: history -->
      <section v-if="revokedLinks.length > 0" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <h2 class="px-6 pt-5 pb-2 text-base font-bold text-prohealth-900">{{ t('patientAccess.mine.revokedTitle') }}</h2>
        <ul class="divide-y divide-prohealth-100">
          <li v-for="l in revokedLinks" :key="l.uuid" class="px-6 py-3 text-sm text-prohealth-600">
            {{ l.doctorFullName || t('common.empty') }} · {{ l.allyName || t('common.empty') }}
            · {{ t('patientAccess.mine.revokedOn', { date: when(l.revokedAt, l.revokedAt_Display) }) }}
          </li>
        </ul>
      </section>
    </template>

    <UModal v-model:open="revokeOpen" :title="t('patientAccess.mine.revokeTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ t('patientAccess.mine.revokeDescription', { doctor: toRevoke?.doctorFullName ?? '' }) }}
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" :disabled="revoking" @click="toRevoke = null">
            {{ t('patientAccess.mine.cancel') }}
          </UButton>
          <UButton color="error" icon="i-lucide-shield-off" :loading="revoking" @click="confirmRevoke">
            {{ t('patientAccess.mine.revoke') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
