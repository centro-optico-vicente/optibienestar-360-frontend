<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()

useSeoMeta({ title: () => t('auth.reset.seoTitle') })

const { resetPassword } = useAuth()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// El token llega como query param desde el enlace del correo.
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const schema = computed(() => z
  .object({
    newPassword: z
      .string()
      .min(10, t('validation.minChars', { n: 10 }))
      .max(128, t('validation.maxChars', { n: 128 }))
      .regex(/[A-Z]/, t('validation.passwordUppercase'))
      .regex(/[a-z]/, t('validation.passwordLowercase'))
      .regex(/[0-9]/, t('validation.passwordNumber'))
      .regex(/[^A-Za-z0-9]/, t('validation.passwordSymbol')),
    confirmPassword: z.string(),
  })
  .refine((d: { newPassword: string, confirmPassword: string }) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: t('validation.passwordsMismatch'),
  }))

interface Schema {
  newPassword: string
  confirmPassword: string
}

const state = reactive<Partial<Schema>>({ newPassword: '', confirmPassword: '' })
const isSubmitting = ref(false)
const apiError = ref<string | null>(null)

const onSubmit = async (event: FormSubmitEvent<Schema>): Promise<void> => {
  isSubmitting.value = true
  apiError.value = null
  try {
    await resetPassword(token.value, event.data.newPassword)
    toast.add({
      title: t('auth.reset.successTitle'),
      description: t('auth.reset.successDescription'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    await router.push('/login')
  }
  catch (err: unknown) {
    apiError.value = (err as ApiError)?.message || t('auth.reset.errorFallback')
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-8">
      <h2 class="text-2xl md:text-3xl font-extrabold text-prohealth-900">
        {{ $t('auth.reset.heading') }}
      </h2>
      <p class="text-sm text-prohealth-700/70 mt-1">
        {{ $t('auth.reset.subheading') }}
      </p>
    </div>

    <UAlert
      v-if="!token"
      color="error"
      variant="subtle"
      icon="i-lucide-link-2-off"
      :title="$t('auth.reset.invalidLinkTitle')"
      :description="$t('auth.reset.invalidLinkDescription')"
    />

    <UForm
      v-else
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UFormField :label="$t('auth.fields.newPassword')" name="newPassword" required>
        <UInput
          v-model="state.newPassword"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
          icon="i-lucide-lock"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="$t('auth.fields.confirmPassword')" name="confirmPassword" required>
        <UInput
          v-model="state.confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
          icon="i-lucide-lock"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UAlert
        v-if="apiError"
        color="error"
        variant="subtle"
        :title="apiError"
        icon="i-lucide-circle-alert"
      />

      <UButton
        type="submit"
        block
        size="lg"
        color="primary"
        :loading="isSubmitting"
        icon="i-lucide-check"
      >
        {{ $t('auth.reset.submit') }}
      </UButton>
    </UForm>

    <p class="text-center text-sm text-prohealth-700/70 pt-6">
      <NuxtLink to="/login" class="text-prohealth-600 hover:text-prohealth-700 font-medium">
        {{ $t('auth.backToLogin') }}
      </NuxtLink>
    </p>
  </div>
</template>
