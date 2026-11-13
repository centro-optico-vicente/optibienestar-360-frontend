<script setup lang="ts">
import type { CatalogItem } from '~/types/catalogs'
import type { MyAllyProfileDto, MyAllyProfileUpdateRequest } from '~/types/allies'
import { isValidFoundedYear, isValidPhone, isValidWebsite, withWebScheme } from '~/utils/contactValidation'

// Own ally profile editor of the ally portal (hub ADR 0036):
// PUT /v1/me/allies/{allyUuid}/profile, PATCH semantics (omitted = unchanged,
// '' = clear). Only the changed fields travel, and only those of the ally's
// segment; `name` only while the request is under review (`nameEditable`).
// The labels reuse the admin ally form (allies.form.fields.*).
const props = defineProps<{
  allyUuid: string
  profile: MyAllyProfileDto
  readonly?: boolean
}>()

const emit = defineEmits<{ saved: [profile: MyAllyProfileDto] }>()

const { t } = useI18n()
const toast = useToast()
const myAllies = useMyAllies()

const STRING_FIELDS = [
  'name', 'email', 'phone', 'whatsapp', 'website', 'instagram', 'facebook', 'address',
  'googleMapsUrl', 'description',
] as const
const B2B_STRING_FIELDS = ['tradeName', 'commercialZone', 'representativePosition'] as const
const B2B_NUMBER_FIELDS = ['foundedYear', 'cashRegistersCount', 'branchesCount'] as const
const B2P_STRING_FIELDS = ['hostName', 'officeNumber', 'appointmentPhone', 'assistantName'] as const

type StringField = typeof STRING_FIELDS[number] | typeof B2B_STRING_FIELDS[number] | typeof B2P_STRING_FIELDS[number]
type NumberField = typeof B2B_NUMBER_FIELDS[number]

const isB2B = computed(() => props.profile.segment === 'B2B')

const form = reactive({
  name: '', email: '', phone: '', whatsapp: '', website: '', instagram: '', facebook: '', address: '',
  googleMapsUrl: '', description: '',
  tradeName: '', commercialZone: '', representativePosition: '',
  foundedYear: '', cashRegistersCount: '', branchesCount: '',
  hasPos: false,
  hostName: '', officeNumber: '', appointmentPhone: '', assistantName: '',
  stateUuid: '', cityUuid: '',
})

// ---- State → city ----
const states = ref<CatalogItem[]>([])
const cities = ref<CatalogItem[]>([])
const loadingCities = ref(false)
const stateItems = computed(() => states.value.map(s => ({ value: s.uuid, label: s.name })))
const cityItems = computed(() => {
  const items = cities.value.map(c => ({ value: c.uuid, label: c.name }))
  // Keep the current city visible while its state's list loads (or if it is inactive).
  const p = props.profile
  if (p.city_Uuid && form.cityUuid === p.city_Uuid && !items.some(i => i.value === p.city_Uuid)) {
    items.unshift({ value: p.city_Uuid, label: p.city_Display ?? p.city_Uuid })
  }
  return items
})

async function loadCities(stateUuid: string) {
  cities.value = []
  if (!stateUuid) return
  loadingCities.value = true
  try {
    cities.value = (await usePublicCatalog('cities').list({ stateUuid }))
      .filter(c => c.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }
  catch {
    cities.value = []
  }
  finally {
    loadingCities.value = false
  }
}

onMounted(async () => {
  try {
    states.value = (await usePublicCatalog('states').list())
      .filter(s => s.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }
  catch {
    states.value = []
  }
})

// Set by reset(): the state watcher must not wipe the city it is restoring.
let restoring = false
watch(() => form.stateUuid, async (stateUuid) => {
  if (!restoring) form.cityUuid = ''
  await loadCities(stateUuid)
})

function str(v: string | null | undefined): string {
  return v ?? ''
}
function num(v: number | null | undefined): string {
  return v == null ? '' : String(v)
}

function reset() {
  const p = props.profile
  restoring = true
  Object.assign(form, {
    name: str(p.name), email: str(p.email), phone: str(p.phone), whatsapp: str(p.whatsapp),
    website: str(p.website), instagram: str(p.instagram), facebook: str(p.facebook), address: str(p.address),
    googleMapsUrl: str(p.googleMapsUrl), description: str(p.description),
    tradeName: str(p.tradeName), commercialZone: str(p.commercialZone), representativePosition: str(p.representativePosition),
    foundedYear: num(p.foundedYear), cashRegistersCount: num(p.cashRegistersCount), branchesCount: num(p.branchesCount),
    hasPos: Boolean(p.hasPos),
    hostName: str(p.hostName), officeNumber: str(p.officeNumber), appointmentPhone: str(p.appointmentPhone),
    assistantName: str(p.assistantName),
    stateUuid: str(p.state_Uuid), cityUuid: str(p.city_Uuid),
  })
  nextTick(() => { restoring = false })
}

watch(() => props.profile, reset, { immediate: true })

function stringFields(): StringField[] {
  const own: StringField[] = props.profile.nameEditable ? [...STRING_FIELDS] : STRING_FIELDS.filter(f => f !== 'name')
  return [...own, ...(isB2B.value ? B2B_STRING_FIELDS : B2P_STRING_FIELDS)]
}

/** Only what changed; '' clears a text field. */
function buildChanges(): MyAllyProfileUpdateRequest {
  const p = props.profile
  const body: MyAllyProfileUpdateRequest = {}
  for (const field of stringFields()) {
    const value = form[field].trim()
    if (value !== str(p[field])) body[field] = value
  }
  if ((form.cityUuid || '') !== str(p.city_Uuid) && form.cityUuid) body.cityUuid = form.cityUuid
  if (isB2B.value) {
    for (const field of B2B_NUMBER_FIELDS as readonly NumberField[]) {
      const raw = form[field].trim()
      if (raw !== num(p[field])) body[field] = raw === '' ? null : Number(raw)
    }
    if (form.hasPos !== Boolean(p.hasPos)) body.hasPos = form.hasPos
  }
  return body
}

const dirty = computed(() => Object.keys(buildChanges()).length > 0)

function invalid(): string | null {
  if (props.profile.nameEditable && !form.name.trim()) return t('allies.portal.profile.nameRequired')
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return t('validation.emailInvalid')
  // Phones and the website reach the public directory: free text ("hola", "mi sitio web") is rejected (#314, #318).
  // Only what is being changed: a value saved before these checks must not block every other edit of the profile.
  const phoneFields = isB2B.value ? (['phone', 'whatsapp'] as const) : (['phone', 'whatsapp', 'appointmentPhone'] as const)
  for (const field of phoneFields) {
    const raw = form[field].trim()
    if (raw && raw !== str(props.profile[field]) && !isValidPhone(raw)) {
      return t('allies.portal.profile.badPhone', { field: t(`allies.form.fields.${field}`) })
    }
  }
  const website = form.website.trim()
  if (website && website !== str(props.profile.website) && !isValidWebsite(website)) return t('allies.portal.profile.badWebsite')
  if (isB2B.value) {
    for (const field of B2B_NUMBER_FIELDS) {
      const raw = form[field].trim()
      if (raw && !/^\d{1,4}$/.test(raw)) return t('allies.portal.profile.badNumber', { field: t(`allies.form.fields.${field}`) })
    }
    const year = form.foundedYear.trim()
    if (year && year !== num(props.profile.foundedYear) && !isValidFoundedYear(year)) {
      return t('allies.portal.profile.badFoundedYear', { year: new Date().getFullYear() })
    }
  }
  return null
}

const saving = ref(false)
async function save() {
  // "miempresa.com" / "www.miempresa.com" is how most people type it: complete the scheme instead of rejecting it.
  form.website = withWebScheme(form.website)
  const error = invalid()
  if (error) {
    toast.add({ title: error, color: 'error' })
    return
  }
  const body = buildChanges()
  if (!Object.keys(body).length) return
  saving.value = true
  try {
    const saved = await myAllies.updateProfile(props.allyUuid, body)
    toast.add({ title: t('allies.portal.profile.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', saved)
  }
  catch (err) {
    // 400 (field validation) is not toasted by useApi.
    const e = err as { status?: number, message?: string }
    if (e.status === 400 && e.message) toast.add({ title: e.message, color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UFormField
        :label="isB2B ? t('allies.form.fields.name') : t('allies.form.fields.nameProfessional')"
        :help="profile.nameEditable ? undefined : t('allies.portal.profile.nameLocked')"
        :required="profile.nameEditable"
        class="sm:col-span-2"
      >
        <UInput v-model="form.name" class="w-full" maxlength="150" :disabled="readonly || !profile.nameEditable" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.email')">
        <UInput v-model="form.email" type="email" class="w-full" maxlength="254" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.phone')">
        <UInput v-model="form.phone" class="w-full" maxlength="30" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.whatsapp')">
        <UInput v-model="form.whatsapp" class="w-full" maxlength="30" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.website')">
        <UInput v-model="form.website" class="w-full" maxlength="255" placeholder="https://" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.instagram')">
        <UInput v-model="form.instagram" class="w-full" maxlength="255" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.facebook')">
        <UInput v-model="form.facebook" class="w-full" maxlength="255" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.state')">
        <USelectMenu
          clear
          v-model="form.stateUuid"
          :items="stateItems"
          label-key="label"
          value-key="value"
          :placeholder="t('common.select')"
          :disabled="readonly"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('allies.form.fields.city')">
        <USelectMenu
          clear
          v-model="form.cityUuid"
          :items="cityItems"
          label-key="label"
          value-key="value"
          :loading="loadingCities"
          :placeholder="form.stateUuid ? t('common.select') : t('allies.form.selectCityFirst')"
          :disabled="readonly || !form.stateUuid"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('allies.form.fields.address')" class="sm:col-span-2">
        <UTextarea v-model="form.address" :rows="2" :maxlength="500" class="w-full" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.googleMapsUrl')" class="sm:col-span-2">
        <UInput v-model="form.googleMapsUrl" class="w-full" maxlength="500" placeholder="https://maps.google.com/…" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.description')" class="sm:col-span-2">
        <UTextarea v-model="form.description" :rows="3" :maxlength="2000" class="w-full" :disabled="readonly" />
      </UFormField>
    </div>

    <!-- B2B commercial data -->
    <fieldset v-if="isB2B" class="rounded-xl border border-prohealth-100 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <legend class="px-1 text-sm font-semibold text-prohealth-900">{{ t('allies.portal.profile.commercialTitle') }}</legend>
      <UFormField :label="t('allies.form.fields.tradeName')">
        <UInput v-model="form.tradeName" class="w-full" maxlength="150" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.commercialZone')">
        <UInput v-model="form.commercialZone" class="w-full" maxlength="100" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.representativePosition')">
        <UInput v-model="form.representativePosition" class="w-full" maxlength="100" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.foundedYear')">
        <UInput v-model="form.foundedYear" class="w-full" inputmode="numeric" maxlength="4" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.branchesCount')">
        <UInput v-model="form.branchesCount" class="w-full" inputmode="numeric" maxlength="4" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.cashRegistersCount')">
        <UInput v-model="form.cashRegistersCount" class="w-full" inputmode="numeric" maxlength="4" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.hasPos')">
        <USwitch v-model="form.hasPos" :disabled="readonly" />
      </UFormField>
    </fieldset>

    <!-- B2P practice site -->
    <fieldset v-else class="rounded-xl border border-prohealth-100 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <legend class="px-1 text-sm font-semibold text-prohealth-900">{{ t('allies.portal.profile.practiceTitle') }}</legend>
      <UFormField :label="t('allies.form.fields.hostName')">
        <UInput v-model="form.hostName" class="w-full" maxlength="150" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.officeNumber')">
        <UInput v-model="form.officeNumber" class="w-full" maxlength="30" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.appointmentPhone')">
        <UInput v-model="form.appointmentPhone" class="w-full" maxlength="30" :disabled="readonly" />
      </UFormField>
      <UFormField :label="t('allies.form.fields.assistantName')">
        <UInput v-model="form.assistantName" class="w-full" maxlength="100" :disabled="readonly" />
      </UFormField>
    </fieldset>

    <div v-if="!readonly" class="flex items-center justify-end gap-2">
      <UButton color="neutral" variant="ghost" :disabled="!dirty || saving" @click="reset">{{ t('common.cancel') }}</UButton>
      <UButton type="submit" color="primary" icon="i-lucide-save" :loading="saving" :disabled="!dirty">{{ t('common.saveChanges') }}</UButton>
    </div>
  </form>
</template>
