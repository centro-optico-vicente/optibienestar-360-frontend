<script setup lang="ts">
import type { MemberDto } from '~/types/members'

// Memberships have no global admin list in the backend — they are a sub-resource of a
// member (enroll/cancel/reactivate per member). So this page is a member picker that
// renders the shared <MemberMembershipsCard> for the chosen member, giving the
// top-level "Membresías" menu entry a real destination instead of the catch-all.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBERSHIP_VIEW_ALL',
})

useSeoMeta({ title: 'Membresías — OptiBienestar 360' })

const { t } = useI18n()
const members = useMembers()

// ---- Member search (server-side, debounced) ----
type Option = { label: string, value: string }
const memberSearch = ref('')
const memberOptions = ref<Option[]>([])
const searching = ref(false)
const selectedMemberUuid = ref<string>('')

function memberLabel(m: MemberDto): string {
  const name = m.fullName || [m.firstName, m.middleName, m.lastName, m.secondLastName].filter(Boolean).join(' ') || t('common.empty')
  const doc = m.documentNumber ? ` · ${m.documentType ?? ''} ${m.documentNumber}`.trimEnd() : ''
  return `${name}${doc}`
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(memberSearch, (q) => {
  clearTimeout(searchTimer)
  const term = q.trim()
  if (term.length < 2) {
    memberOptions.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const res = await members.list({ size: 10, q: term })
      memberOptions.value = (res.content ?? []).map(m => ({ label: memberLabel(m), value: m.uuid }))
    }
    catch {
      memberOptions.value = []
    }
    finally {
      searching.value = false
    }
  }, 400)
})

const selectedMemberLabel = computed(() =>
  memberOptions.value.find(o => o.value === selectedMemberUuid.value)?.label ?? '')
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">Membresías</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">
        Las afiliaciones a planes se gestionan por titular. Busca un afiliado para ver y administrar sus membresías.
      </p>
    </div>

    <!-- Member picker -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField label="Buscar afiliado" help="Escribe nombre o documento (mín. 2 caracteres).">
          <UInput
            v-model="memberSearch"
            placeholder="Buscar por nombre o documento…"
            icon="i-lucide-search"
            :loading="searching"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Afiliado">
          <USelectMenu
            v-model="selectedMemberUuid"
            :items="memberOptions"
            label-key="label"
            value-key="value"
            :placeholder="memberOptions.length ? 'Selecciona' : 'Busca primero'"
            class="w-full"
          />
        </UFormField>
      </div>
      <p v-if="selectedMemberLabel" class="text-xs text-prohealth-500">
        Gestionando membresías de <span class="font-semibold text-prohealth-700">{{ selectedMemberLabel }}</span>.
        <NuxtLink :to="`/dashboard/members/${selectedMemberUuid}`" class="text-cyan-700 hover:underline">Ver expediente completo</NuxtLink>.
      </p>
    </div>

    <!-- Memberships of the selected member -->
    <MemberMembershipsCard v-if="selectedMemberUuid" :key="selectedMemberUuid" :member-uuid="selectedMemberUuid" />

    <!-- Empty state before choosing a member -->
    <div v-else class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-badge-check" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">Selecciona un afiliado</p>
      <p class="text-sm text-prohealth-500 mt-1">Busca por nombre o documento para gestionar sus membresías.</p>
    </div>
  </div>
</template>
