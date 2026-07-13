<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'
import heroImg from '~/assets/img/260c06e4612a1bcca2ebc97cbe1ef392.jpg'
import aboutImg from '~/assets/img/c08baae430a8d168d93847b175f3d6ec.jpg'

definePageMeta({ layout: 'default' })

const { t } = useI18n()

useSeoMeta({
  title: () => t('landing.seoTitle'),
  description: () => t('landing.seoDescription'),
})

// ---- Formulario de contacto (POST /v1/public/contact) ----
const { send } = useContact()
const toast = useToast()

const contactSchema = computed(() => z.object({
  name: z.string().min(1, t('validation.required')).max(150),
  email: z.string().email(t('validation.emailInvalid')).max(254),
  phone: z.string().max(30).optional().or(z.literal('')),
  subject: z.string().min(1, t('validation.required')).max(200),
  message: z.string().min(1, t('validation.required')).max(2000),
}))

interface ContactSchema {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
}

const contact = reactive<Partial<ContactSchema>>({
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
})
const contactSubmitting = ref(false)
const contactSent = ref(false)

async function onContactSubmit(event: FormSubmitEvent<ContactSchema>): Promise<void> {
  contactSubmitting.value = true
  try {
    await send({
      name: event.data.name,
      email: event.data.email,
      phone: event.data.phone || undefined,
      subject: event.data.subject,
      message: event.data.message,
    })
    contactSent.value = true
    toast.add({ title: t('landing.contact.toast.sentTitle'), description: t('landing.contact.toast.sentDescription'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch (err: unknown) {
    toast.add({
      title: t('landing.contact.toast.errorTitle'),
      description: (err as ApiError)?.message || t('landing.contact.toast.errorFallback'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  }
  finally {
    contactSubmitting.value = false
  }
}

interface Stat {
  value: string
  labelKey: string
}

const stats: Stat[] = [
  { value: '20+', labelKey: 'landing.stats.years' },
  { value: '95%', labelKey: 'landing.stats.satisfaction' },
  { value: '5000+', labelKey: 'landing.stats.careCount' },
  { value: '10+', labelKey: 'landing.stats.specialties' },
]

interface Department {
  icon: string
  titleKey: string
  descriptionKey: string
}

const departments: Department[] = [
  { icon: 'i-lucide-siren', titleKey: 'landing.departments.items.emergencies.title', descriptionKey: 'landing.departments.items.emergencies.description' },
  { icon: 'i-lucide-baby', titleKey: 'landing.departments.items.pediatrics.title', descriptionKey: 'landing.departments.items.pediatrics.description' },
  { icon: 'i-lucide-stethoscope', titleKey: 'landing.departments.items.gynecology.title', descriptionKey: 'landing.departments.items.gynecology.description' },
  { icon: 'i-lucide-heart-pulse', titleKey: 'landing.departments.items.cardiology.title', descriptionKey: 'landing.departments.items.cardiology.description' },
  { icon: 'i-lucide-brain', titleKey: 'landing.departments.items.neurology.title', descriptionKey: 'landing.departments.items.neurology.description' },
  { icon: 'i-lucide-glasses', titleKey: 'landing.departments.items.ophthalmology.title', descriptionKey: 'landing.departments.items.ophthalmology.description' },
]
</script>

<template>
  <!-- HERO -->
  <section class="relative overflow-hidden bg-hero-prohealth text-white -mt-16 pt-16">
    <div class="absolute inset-0 opacity-30 pointer-events-none">
      <div class="absolute -top-20 -right-20 w-[28rem] h-[28rem] rounded-full bg-cyan-400/40 blur-3xl" />
      <div class="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-lime-400/20 blur-3xl" />
    </div>

    <div class="relative max-w-7xl mx-auto px-6 lg:px-10 pt-12 lg:pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium mb-5">
          <UIcon name="i-lucide-shield-check" class="w-4 h-4 text-lime-300" />
          {{ $t('landing.hero.badge') }}
        </div>
        <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
          {{ $t('landing.hero.titleLine1') }}
          <span class="block text-lime-300">{{ $t('landing.hero.titleLine2') }}</span>
        </h1>
        <p class="mt-6 text-prohealth-100/90 max-w-xl text-lg">
          {{ $t('landing.hero.lead') }}
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <UButton
            to="/login"
            color="secondary"
            variant="solid"
            size="xl"
            icon="i-lucide-log-in"
            class="bg-lime-500 hover:bg-lime-600 text-prohealth-950 font-semibold"
          >
            {{ $t('landing.hero.ctaLogin') }}
          </UButton>
          <UButton
            to="#about"
            color="neutral"
            variant="ghost"
            size="xl"
            icon="i-lucide-play-circle"
            class="text-white hover:bg-white/10"
          >
            {{ $t('landing.hero.ctaHow') }}
          </UButton>
        </div>

        <div class="mt-10 inline-flex items-center gap-3 bg-white/10 backdrop-blur rounded-2xl pl-2 pr-5 py-2">
          <div class="flex -space-x-2">
            <span class="w-9 h-9 rounded-full bg-lime-400 border-2 border-white/40" />
            <span class="w-9 h-9 rounded-full bg-cyan-400 border-2 border-white/40" />
            <span class="w-9 h-9 rounded-full bg-prohealth-300 border-2 border-white/40" />
          </div>
          <div>
            <div class="text-lg font-bold leading-tight">150K +</div>
            <div class="text-xs opacity-80">{{ $t('landing.hero.activeAffiliatesLabel') }}</div>
          </div>
          <span class="ml-2 w-7 h-7 rounded-full bg-lime-400 grid place-items-center">
            <UIcon name="i-lucide-check" class="w-4 h-4 text-prohealth-950" />
          </span>
        </div>
      </div>

      <div class="relative">
        <div class="relative aspect-[4/5] rounded-3xl bg-white/10 backdrop-blur border border-white/20 overflow-hidden">
          <img
            :src="heroImg"
            :alt="$t('landing.hero.imageAlt')"
            class="h-full w-full object-cover"
          >
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-prohealth-950/80 via-prohealth-950/20 to-transparent p-6">
            <p class="text-prohealth-100/90 text-sm uppercase tracking-widest">
              {{ $t('landing.hero.imageCaption') }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats overlay -->
    <div class="relative max-w-7xl mx-auto px-6 lg:px-10 -mb-12 z-20">
      <div class="bg-white rounded-2xl shadow-xl border border-prohealth-100 grid grid-cols-2 md:grid-cols-4 divide-x divide-prohealth-100">
        <div
          v-for="s in stats"
          :key="s.labelKey"
          class="px-6 py-6 text-center"
        >
          <div class="text-3xl md:text-4xl font-extrabold text-prohealth-700">{{ s.value }}</div>
          <div class="mt-1 text-xs md:text-sm text-prohealth-500">{{ $t(s.labelKey) }}</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ABOUT -->
  <section id="about" class="bg-white pt-28 pb-16">
    <div class="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <p class="text-sm font-semibold uppercase tracking-widest text-cyan-600 mb-3">
          {{ $t('landing.about.eyebrow') }}
        </p>
        <h2 class="text-3xl md:text-4xl font-extrabold text-prohealth-900 leading-tight">
          {{ $t('landing.about.title') }}
        </h2>
        <p class="mt-5 text-prohealth-700/80 max-w-lg">
          {{ $t('landing.about.body') }}
        </p>
      </div>
      <div class="aspect-[5/4] rounded-3xl overflow-hidden border border-prohealth-100">
        <img
          :src="aboutImg"
          :alt="$t('landing.about.imageAlt')"
          class="h-full w-full object-cover"
        >
      </div>
    </div>
  </section>

  <!-- DEPARTMENTS -->
  <section id="departments" class="bg-prohealth-50/40 py-20">
    <div class="max-w-7xl mx-auto px-6 lg:px-10">
      <p class="text-sm font-semibold uppercase tracking-widest text-cyan-600 mb-3">
        {{ $t('landing.departments.eyebrow') }}
      </p>
      <h2 class="text-3xl md:text-4xl font-extrabold text-prohealth-900">
        {{ $t('landing.departments.title') }}
      </h2>

      <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="d in departments"
          :key="d.titleKey"
          class="group bg-white rounded-2xl border border-prohealth-100 p-6 hover:border-cyan-300 hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <div class="w-12 h-12 rounded-xl bg-prohealth-50 border border-prohealth-100 grid place-items-center group-hover:bg-cyan-50 group-hover:border-cyan-200 transition-colors">
            <UIcon :name="d.icon" class="w-6 h-6 text-prohealth-600 group-hover:text-cyan-600" />
          </div>
          <h3 class="mt-4 font-semibold text-prohealth-900">{{ $t(d.titleKey) }}</h3>
          <p class="mt-1 text-sm text-prohealth-700/70">{{ $t(d.descriptionKey) }}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- CONTACTO -->
  <section id="contact" class="bg-prohealth-50/40 py-20">
    <div class="max-w-5xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-10 items-start">
      <div>
        <p class="text-sm font-semibold uppercase tracking-widest text-cyan-600 mb-3">
          {{ $t('landing.contact.eyebrow') }}
        </p>
        <h2 class="text-3xl md:text-4xl font-extrabold text-prohealth-900 leading-tight">
          {{ $t('landing.contact.title') }}
        </h2>
        <p class="mt-5 text-prohealth-700/80 max-w-md">
          {{ $t('landing.contact.lead') }}
        </p>
        <ul class="mt-6 space-y-3 text-sm text-prohealth-700">
          <li class="flex items-center gap-2">
            <UIcon name="i-lucide-mail" class="w-4 h-4 text-prohealth-500" /> info@optibienestar360.com
          </li>
          <li class="flex items-center gap-2">
            <UIcon name="i-lucide-phone" class="w-4 h-4 text-prohealth-500" /> +58 412 000 0000
          </li>
        </ul>
      </div>

      <div class="bg-white rounded-3xl border border-prohealth-100 p-6 md:p-8">
        <UAlert
          v-if="contactSent"
          color="success"
          variant="subtle"
          icon="i-lucide-mail-check"
          :title="$t('landing.contact.sentTitle')"
          :description="$t('landing.contact.sentDescription')"
        />
        <UForm
          v-else
          :schema="contactSchema"
          :state="contact"
          class="space-y-4"
          @submit="onContactSubmit"
        >
          <div class="grid sm:grid-cols-2 gap-4">
            <UFormField :label="$t('landing.contact.form.name')" name="name" required>
              <UInput v-model="contact.name" class="w-full" />
            </UFormField>
            <UFormField :label="$t('landing.contact.form.email')" name="email" required>
              <UInput v-model="contact.email" type="email" class="w-full" />
            </UFormField>
          </div>
          <UFormField :label="$t('landing.contact.form.phone')" name="phone">
            <UInput v-model="contact.phone" class="w-full" />
          </UFormField>
          <UFormField :label="$t('landing.contact.form.subject')" name="subject" required>
            <UInput v-model="contact.subject" class="w-full" />
          </UFormField>
          <UFormField :label="$t('landing.contact.form.message')" name="message" required>
            <UTextarea v-model="contact.message" :rows="4" :maxlength="2000" class="w-full" />
          </UFormField>
          <UButton
            type="submit"
            block
            size="lg"
            color="primary"
            :loading="contactSubmitting"
            icon="i-lucide-send"
          >
            {{ $t('landing.contact.form.submit') }}
          </UButton>
        </UForm>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section id="cta" class="bg-white py-20">
    <div class="max-w-5xl mx-auto px-6 lg:px-10">
      <div class="bg-hero-prohealth text-white rounded-3xl p-10 md:p-14 grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <h2 class="text-2xl md:text-3xl font-extrabold">
            {{ $t('landing.cta.title') }}
          </h2>
          <p class="mt-2 text-prohealth-100/90 max-w-xl">
            {{ $t('landing.cta.body') }}
          </p>
        </div>
        <UButton
          to="/login"
          size="xl"
          class="bg-lime-500 hover:bg-lime-600 text-prohealth-950 font-semibold"
          icon="i-lucide-arrow-right"
          trailing
        >
          {{ $t('landing.cta.button') }}
        </UButton>
      </div>
    </div>
  </section>
</template>
