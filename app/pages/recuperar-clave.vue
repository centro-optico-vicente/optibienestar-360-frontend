<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'

// English pair of this public screen (hub URL convention): same page, rendered
// in English by middleware/public-locale.global.ts. The fixed `key` keeps the
// component (and any typed input) when the switcher jumps between the two URLs.
definePageMeta({ layout: 'auth', alias: ['/en/forgot-password'], key: 'public-forgot-password' })

const { t } = useI18n()
const publicPath = usePublicPath()

useSeoMeta({ title: () => t('auth.recover.seoTitle') })

const { recoverPassword } = useAuth()

// Accepts the email or the national ID (cédula), hub ADR 0037 §3.
const schema = computed(() => z.object({
  identifier: z.string().trim().min(3, t('validation.minChars', { n: 3 })),
}))

interface Schema {
  identifier: string
}

const state = reactive<Partial<Schema>>({ identifier: '' })
const isSubmitting = ref(false)
const sent = ref(false)
const apiError = ref<string | null>(null)

const onSubmit = async (event: FormSubmitEvent<Schema>): Promise<void> => {
  isSubmitting.value = true
  apiError.value = null
  try {
    await recoverPassword(event.data.identifier.trim())
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
      <UFormField
        :label="$t('auth.fields.identifier')"
        :help="$t('auth.fields.identifierHelp')"
        name="identifier"
        required
      >
        <UInput
          v-model="state.identifier"
          type="text"
          autocomplete="username"
          autocapitalize="off"
          :placeholder="$t('auth.fields.identifierPlaceholder')"
          icon="i-lucide-user"
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
      <NuxtLink :to="publicPath('/')" class="text-prohealth-600 hover:text-prohealth-700 font-medium">
        {{ $t('auth.backToLogin') }}
      </NuxtLink>
    </p>
  </div>
</template>
