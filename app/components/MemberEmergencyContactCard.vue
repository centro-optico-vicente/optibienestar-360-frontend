<script setup lang="ts">
import { toEmergencyContactRequest, type EmergencyContactDto, type EmergencyContactFieldsState, type EmergencyContactScope } from '~/types/members'

// The titular's emergency contact on a member detail (V212): shows it and, when the user may,
// edits it in place. Never loads the rest of the medical record.
const props = defineProps<{
  scope: EmergencyContactScope
  /** Required for the admin and advisor scopes; ignored for `own`. */
  memberUuid?: string
}>()

const { t } = useI18n()
const toast = useToast()
const { canAny } = usePermissions()
const emergency = useEmergencyContact()

const perms = emergency.permissions(props.scope)
const canView = computed(() => canAny(...perms.view))
const canEdit = computed(() => canAny(...perms.update))

const contact = ref<EmergencyContactDto | null>(null)
const loading = ref(false)
const editing = ref(false)
const saving = ref(false)
const state = ref<EmergencyContactFieldsState>({ name: '', phone: '', relationship: undefined })

async function load() {
  if (!canView.value) return
  loading.value = true
  try {
    contact.value = await emergency.get(props.scope, props.memberUuid)
  }
  catch {
    contact.value = null
  }
  finally {
    loading.value = false
  }
}

function startEdit() {
  state.value = {
    name: contact.value?.name ?? '',
    phone: contact.value?.phone ?? '',
    relationship: contact.value?.relationship ?? undefined,
  }
  editing.value = true
}

async function save() {
  saving.value = true
  try {
    contact.value = await emergency.update(props.scope, toEmergencyContactRequest(state.value), props.memberUuid)
    editing.value = false
    toast.add({ title: t('members.emergencyContact.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch {
    // useApi already notified the error
  }
  finally {
    saving.value = false
  }
}

watch(() => props.memberUuid, load, { immediate: true })
defineExpose({ reload: load })
</script>

<template>
  <UCard v-if="canView">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-phone-call" />
          {{ t('members.emergencyContact.title') }}
        </h3>
        <UButton
          v-if="canEdit && !editing"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-pencil"
          :label="t('common.edit')"
          :disabled="loading"
          @click="startEdit"
        />
      </div>
    </template>

    <div v-if="loading" class="text-sm text-muted">{{ t('common.loading') }}</div>

    <div v-else-if="editing" class="space-y-4">
      <EmergencyContactFields v-model="state" :disabled="saving" />
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="ghost" :disabled="saving" @click="editing = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton color="primary" variant="outline" icon="i-lucide-save" :loading="saving" @click="save">
          {{ t('common.save') }}
        </UButton>
      </div>
    </div>

    <p v-else-if="!contact?.exists" class="text-sm text-muted">
      {{ t('members.emergencyContact.empty') }}
    </p>

    <dl v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
      <div>
        <dt class="text-muted">{{ t('members.emergencyContact.fields.name') }}</dt>
        <dd>{{ contact.name || '—' }}</dd>
      </div>
      <div>
        <dt class="text-muted">{{ t('members.emergencyContact.fields.phone') }}</dt>
        <dd>
          <a v-if="contact.phone" :href="`tel:${contact.phone}`" class="underline">{{ contact.phone }}</a>
          <span v-else>—</span>
        </dd>
      </div>
      <div>
        <dt class="text-muted">{{ t('members.emergencyContact.fields.relationship') }}</dt>
        <dd>{{ contact.relationship_Display || (contact.relationship ? t(`members.relationships.${contact.relationship}`) : '—') }}</dd>
      </div>
    </dl>
  </UCard>
</template>
