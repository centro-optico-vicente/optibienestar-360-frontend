// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-01',
  future: {
    compatibilityVersion: 4,
  },

  devtools: { enabled: true },

  ssr: false,

  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    '@vee-validate/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  // Portal light-only: fijamos el tema claro para que los tokens de Nuxt UI
  // (p. ej. --ui-text-highlighted, que usa el texto de los inputs) no se inviertan
  // a blanco cuando el SO está en modo oscuro. Sin esto, el texto del input queda
  // blanco sobre el fondo blanco forzado en main.css.
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },

  app: {
    head: {
      title: 'OptiSalud Plus',
      htmlAttrs: { lang: 'es' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Programa de salud y bienestar OptiSalud Plus' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      apiBaseUrl: '',
    },
  },

  i18n: {
    defaultLocale: 'es',
    strategy: 'no_prefix',
    locales: [
      { code: 'es', name: 'Español', file: 'es.json' },
    ],
    lazy: true,
  },

  veeValidate: {
    autoImports: true,
    componentNames: {
      Form: 'VeeForm',
      Field: 'VeeField',
      ErrorMessage: 'VeeErrorMessage',
    },
  },

  pinia: {
    storesDirs: ['./app/stores/**'],
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
