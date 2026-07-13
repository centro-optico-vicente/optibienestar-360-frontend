<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('auth.changePassword.seoTitle') })

const { changePassword } = useAuth()
const toast = useToast()

interface Schema {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const schema = computed(() => z
  .object({
    currentPassword: z.string().min(8, t('validation.minChars', { n: 8 })),
    newPassword: z
      .string()
      .min(10, t('validation.minChars', { n: 10 }))
      .regex(/[A-Z]/, t('validation.passwordUppercase'))
      .regex(/[a-z]/, t('validation.passwordLowercase'))
      .regex(/[0-9]/, t('validation.passwordNumber'))
      .regex(/[^A-Za-z0-9]/, t('validation.passwordSymbol')),
    confirmPassword: z.string(),
  })
  .refine((d: Schema) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: t('validation.passwordsMismatch'),
  })
  .refine((d: Schema) => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: t('validation.passwordSameAsCurrent'),
  }))

const state = reactive<Partial<Schema>>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const isSubmitting = ref<boolean>(false)
const apiError = ref<string | null>(null)
const showFields = reactive<{ current: boolean, next: boolean, confirm: boolean }>({
  current: false,
  next: false,
  confirm: false,
})

const onSubmit = async (event: FormSubmitEvent<Schema>): Promise<void> => {
  isSubmitting.value = true
  apiError.value = null
  try {
    toast.add({
      title: t('auth.changePassword.successTitle'),
      description: t('auth.changePassword.successDescription'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    // changePassword limpia la sesión y redirige a /login (el backend invalida los tokens).
    await changePassword({
      currentPassword: event.data.currentPassword,
      newPassword: event.data.newPassword,
    })
  }
  catch (err: unknown) {
    const e = err as { message?: string }
    apiError.value = e?.message || t('auth.changePassword.errorFallback')
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="bg-white rounded-2xl border border-prohealth-100 p-6 md:p-8">
      <div class="mb-6">
        <h1 class="text-xl md:text-2xl font-extrabold text-prohealth-900">
          {{ $t('auth.changePassword.heading') }}
        </h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ $t('auth.changePassword.hint') }}
        </p>
      </div>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-5"
        @submit="onSubmit"
      >
        <UFormField :label="$t('auth.fields.currentPassword')" name="currentPassword" required>
          <UInput
            v-model="state.currentPassword"
            :type="showFields.current ? 'text' : 'password'"
            autocomplete="current-password"
            icon="i-lucide-lock"
            size="lg"
            class="w-full"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showFields.current ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                @click="showFields.current = !showFields.current"
              />
            </template>
          </UInput>
        </UFormField>

        <UFormField :label="$t('auth.fields.newPassword')" name="newPassword" required>
          <UInput
            v-model="state.newPassword"
            :type="showFields.next ? 'text' : 'password'"
            autocomplete="new-password"
            icon="i-lucide-key-round"
            size="lg"
            class="w-full"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showFields.next ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                @click="showFields.next = !showFields.next"
              />
            </template>
          </UInput>
        </UFormField>

        <UFormField :label="$t('auth.fields.confirmNewPassword')" name="confirmPassword" required>
          <UInput
            v-model="state.confirmPassword"
            :type="showFields.confirm ? 'text' : 'password'"
            autocomplete="new-password"
            icon="i-lucide-check"
            size="lg"
            class="w-full"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showFields.confirm ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                @click="showFields.confirm = !showFields.confirm"
              />
            </template>
          </UInput>
        </UFormField>

        <UAlert
          v-if="apiError"
          color="error"
          variant="subtle"
          :title="apiError"
          icon="i-lucide-circle-alert"
        />

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton
            to="/dashboard"
            color="neutral"
            variant="ghost"
            :disabled="isSubmitting"
          >
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            type="submit"
            color="primary"
            :loading="isSubmitting"
            icon="i-lucide-shield-check"
          >
            {{ $t('auth.changePassword.submit') }}
          </UButton>
        </div>
      </UForm>
    </div>
  </div>
</template>
