<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { MemberDto } from '~/types/members'
import { relationshipLabel } from '~/types/members'
import logoUrl from '~/assets/centro-optico-vicente-logo.png'

// Portal del afiliado: carnet digital + beneficiarios cubiertos.
// GET /v1/me/member exige MEMBER_VIEW_OWN; responde 404 si el usuario no está afiliado.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_VIEW_OWN',
})

useSeoMeta({ title: 'Mi carnet — OptiBienestar 360' })

const members = useMembers()
const auth = useAuthStore()

const member = ref<MemberDto | null>(null)
const loading = ref(true)
const notAffiliated = ref(false)
const loadError = ref(false)

onMounted(async () => {
  try {
    member.value = await members.me()
  }
  catch (err) {
    if ((err as ApiError).status === 404) notAffiliated.value = true
    else loadError.value = true
  }
  finally {
    loading.value = false
  }
})

const displayName = computed(() => {
  const m = member.value
  if (!m) return auth.fullName
  return m.fullName || [m.firstName, m.middleName, m.lastName, m.secondLastName].filter(Boolean).join(' ')
})

/** Código corto del carnet (8 primeros caracteres del UUID). */
const cardCode = computed(() => member.value?.uuid?.slice(0, 8).toUpperCase() ?? '')

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' })
}
</script>

<template>
  <div class="space-y-6 max-w-3xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">Mi carnet</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">
        Presenta tu carnet digital en cualquier aliado de la red.
      </p>
    </div>

    <!-- Cargando -->
    <div v-if="loading" class="space-y-4">
      <USkeleton class="h-56 w-full max-w-md rounded-3xl" />
      <USkeleton class="h-4 w-64 rounded" />
    </div>

    <!-- No afiliado -->
    <div v-else-if="notAffiliated" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-id-card" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">Aún no tienes una afiliación activa</p>
      <p class="text-sm text-prohealth-500 mt-1">
        Contáctanos para activar tu plan y disfrutar de la red de aliados.
      </p>
      <UButton to="/#contact" color="primary" variant="soft" size="sm" class="mt-4">
        Quiero afiliarme
      </UButton>
    </div>

    <!-- Error -->
    <div v-else-if="loadError || !member" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-circle-alert" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">No se pudo cargar tu carnet</p>
      <p class="text-sm text-prohealth-500 mt-1">Intenta de nuevo en unos minutos.</p>
    </div>

    <template v-else>
      <!-- Carnet digital -->
      <div class="relative max-w-md rounded-3xl bg-hero-prohealth text-white p-6 overflow-hidden shadow-lg">
        <div class="absolute inset-0 opacity-25 pointer-events-none">
          <div class="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-cyan-400/50 blur-3xl" />
          <div class="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-lime-400/30 blur-3xl" />
        </div>

        <div class="relative">
          <!-- Marca + estado -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img :src="logoUrl" alt="OptiBienestar 360" class="w-8 h-8 rounded-full object-contain bg-white/90">
              <span class="font-extrabold">
                OptiBienestar<span class="text-lime-300"> 360</span>
              </span>
            </div>
            <UBadge
              :color="member.status === 'ACTIVE' ? 'success' : 'warning'"
              variant="solid"
              size="sm"
            >
              {{ member.status === 'ACTIVE' ? 'Activo' : member.status }}
            </UBadge>
          </div>

          <!-- Titular -->
          <div class="mt-8">
            <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">Titular</p>
            <p class="text-xl font-bold leading-tight mt-0.5">{{ displayName }}</p>
            <p class="text-sm text-prohealth-100/80 mt-0.5">
              {{ member.documentType }}-{{ member.documentNumber }}
            </p>
          </div>

          <!-- Pie del carnet -->
          <div class="flex items-end justify-between mt-7">
            <div>
              <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">Afiliado desde</p>
              <p class="text-sm font-semibold mt-0.5">{{ formatDate(member.enrolledAt) }}</p>
            </div>
            <div class="text-right">
              <p class="text-[11px] uppercase tracking-widest text-prohealth-100/70">Carnet N°</p>
              <p class="text-sm font-mono font-semibold tracking-wider mt-0.5">{{ cardCode }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Beneficiarios cubiertos -->
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="px-6 py-4 border-b border-prohealth-100">
          <h2 class="font-bold text-prohealth-900">Beneficiarios cubiertos</h2>
          <p class="text-xs text-prohealth-500 mt-0.5">Familiares incluidos en tu plan.</p>
        </div>

        <div v-if="!member.beneficiaries?.length" class="px-6 py-10 text-center text-prohealth-500">
          <UIcon name="i-lucide-users" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
          <p class="text-sm">No tienes beneficiarios registrados.</p>
        </div>

        <ul v-else class="divide-y divide-prohealth-100">
          <li
            v-for="b in member.beneficiaries"
            :key="b.uuid"
            class="px-6 py-3.5 flex items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="font-semibold text-prohealth-900 truncate">
                {{ b.fullName || [b.firstName, b.lastName].filter(Boolean).join(' ') }}
              </p>
              <p class="text-xs text-prohealth-500">
                <template v-if="b.documentNumber">{{ b.documentType }}-{{ b.documentNumber }} · </template>
                Nac. {{ formatDate(b.birthDate) }}
              </p>
            </div>
            <UBadge color="primary" variant="subtle" size="sm">
              {{ relationshipLabel(b.relationship) }}
            </UBadge>
          </li>
        </ul>
      </div>

      <!-- My payments (self-gated by PAYMENT_VIEW_OWN) -->
      <MyPaymentsCard />

      <!-- Datos de contacto registrados -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">Mis datos</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Teléfono</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.phone || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Email</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.email || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Ciudad</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.city?.name || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Dirección</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.address || '—' }}</dd>
          </div>
        </dl>
        <p class="text-xs text-prohealth-500 mt-5">
          ¿Datos desactualizados? Escríbenos desde el
          <NuxtLink to="/#contact" class="text-cyan-700 hover:underline">formulario de contacto</NuxtLink>.
        </p>
      </div>

      <!-- Acceso al directorio -->
      <div class="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-handshake" class="w-6 h-6 text-cyan-600" />
          <p class="text-sm text-prohealth-800">
            Explora la <span class="font-semibold">red de aliados</span> y sus precios preferenciales.
          </p>
        </div>
        <UButton to="/aliados" color="primary" variant="soft" size="sm" trailing-icon="i-lucide-arrow-right">
          Ver directorio
        </UButton>
      </div>
    </template>
  </div>
</template>
