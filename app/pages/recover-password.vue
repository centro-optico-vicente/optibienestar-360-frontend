<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()

useSeoMeta({ title: () => t('auth.recover.seoTitle') })

const { recoverPassword } = useAuth()

const schema = computed(() => z.object({
  email: z.string().email(t('validation.emailInvalid')),
}))

interface Schema {
  email: string
}

const state = reactive<Partial<Schema>>({ email: '' })
const isSubmitting = ref(false)
const sent = ref(false)
const apiError = ref<string | null>(null)

const onSubmit = async (event: FormSubmitEvent<Schema>): Promise<void> => {
  isSubmitting.value = true
  apiError.value = null
  try {
    await recoverPassword(event.data.email)
    sent.value = true
  }
  catch (err: unknown) {
    apiError.value = (err as ApiError)?.message || t('auth.recover.errorFallback')
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
        {{ $t('auth.recover.heading') }}
      </h2>
      <p class="text-sm text-prohealth-700/70 mt-1">
        {{ $t('auth.recover.subheading') }}
      </p>
    </div>

    <UAlert
      v-if="sent"
      color="success"
      variant="subtle"
      icon="i-lucide-mail-check"
      :title="$t('auth.recover.sentTitle')"
      :description="$t('auth.recover.sentDescription')"
    />

    <UForm
      v-else
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UFormField :label="$t('auth.fields.email')" name="email" required>
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="email"
          :placeholder="$t('auth.fields.emailPlaceholder')"
          icon="i-lucide-mail"
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
        icon="i-lucide-send"
      >
        {{ $t('auth.recover.submit') }}
      </UButton>
    </UForm>

    <p class="text-center text-sm text-prohealth-700/70 pt-6">
      <NuxtLink to="/login" class="text-prohealth-600 hover:text-prohealth-700 font-medium">
        {{ $t('auth.backToLogin') }}
      </NuxtLink>
    </p>
  </div>
</template>
