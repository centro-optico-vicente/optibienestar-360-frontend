<script setup lang="ts">
definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'OptiSalud Plus — Cuidamos lo que más amas',
  description:
    'Plan integral de salud con red de aliados, atención preferencial, carnet digital y cobertura familiar.',
})

interface Stat {
  value: string
  label: string
}

const stats: Stat[] = [
  { value: '20+', label: 'Años en el sector' },
  { value: '95%', label: 'Satisfacción de afiliados' },
  { value: '5000+', label: 'Atenciones al año' },
  { value: '10+', label: 'Especialidades cubiertas' },
]

interface Department {
  icon: string
  title: string
  description: string
}

const departments: Department[] = [
  { icon: 'i-lucide-siren', title: 'Emergencias', description: 'Atención 24/7 en aliados certificados.' },
  { icon: 'i-lucide-baby', title: 'Pediatría', description: 'Consultas y controles infantiles preferenciales.' },
  { icon: 'i-lucide-stethoscope', title: 'Ginecología', description: 'Salud integral de la mujer y maternidad.' },
  { icon: 'i-lucide-heart-pulse', title: 'Cardiología', description: 'Cribado, ECG y seguimiento de riesgo.' },
  { icon: 'i-lucide-brain', title: 'Neurología', description: 'Evaluaciones y planes de seguimiento.' },
  { icon: 'i-lucide-glasses', title: 'Oftalmología', description: 'Consultas, lentes y descuentos en óptica.' },
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
          Programa de salud confiable
        </div>
        <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
          Cuidado integral,
          <span class="block text-lime-300">resultados excepcionales.</span>
        </h1>
        <p class="mt-6 text-prohealth-100/90 max-w-xl text-lg">
          Nuestro equipo de profesionales y red de aliados está comprometido con brindar
          atención de calidad y acompañamiento personalizado a cada uno de nuestros afiliados.
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
            Ingresar a mi cuenta
          </UButton>
          <UButton
            to="#about"
            color="neutral"
            variant="ghost"
            size="xl"
            icon="i-lucide-play-circle"
            class="text-white hover:bg-white/10"
          >
            Cómo funciona
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
            <div class="text-xs opacity-80">Afiliados activos</div>
          </div>
          <span class="ml-2 w-7 h-7 rounded-full bg-lime-400 grid place-items-center">
            <UIcon name="i-lucide-check" class="w-4 h-4 text-prohealth-950" />
          </span>
        </div>
      </div>

      <div class="relative">
        <div class="aspect-[4/5] rounded-3xl bg-white/10 backdrop-blur border border-white/20 overflow-hidden grid place-items-center">
          <div class="text-center p-10">
            <UIcon name="i-lucide-heart-pulse" class="w-32 h-32 text-lime-300 mx-auto" />
            <p class="mt-6 text-prohealth-100/80 text-sm uppercase tracking-widest">
              Salud · Familia · Bienestar
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
          :key="s.label"
          class="px-6 py-6 text-center"
        >
          <div class="text-3xl md:text-4xl font-extrabold text-prohealth-700">{{ s.value }}</div>
          <div class="mt-1 text-xs md:text-sm text-prohealth-500">{{ s.label }}</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ABOUT -->
  <section id="about" class="bg-white pt-28 pb-16">
    <div class="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <p class="text-sm font-semibold uppercase tracking-widest text-cyan-600 mb-3">
          Sobre nosotros
        </p>
        <h2 class="text-3xl md:text-4xl font-extrabold text-prohealth-900 leading-tight">
          OptiSalud Plus es un equipo
          de profesionales de la salud comprometidos.
        </h2>
        <p class="mt-5 text-prohealth-700/80 max-w-lg">
          Trabajamos bajo un enfoque integral que se concentra en la persona como un todo,
          no solo en el síntoma. Nuestros aliados, planes y promotores forman una red diseñada
          para que cuidarse sea simple.
        </p>
      </div>
      <div class="aspect-[5/4] rounded-3xl bg-prohealth-50 grid place-items-center border border-prohealth-100">
        <UIcon name="i-lucide-users" class="w-32 h-32 text-prohealth-300" />
      </div>
    </div>
  </section>

  <!-- DEPARTMENTS -->
  <section id="departments" class="bg-prohealth-50/40 py-20">
    <div class="max-w-7xl mx-auto px-6 lg:px-10">
      <p class="text-sm font-semibold uppercase tracking-widest text-cyan-600 mb-3">
        Nuestros departamentos
      </p>
      <h2 class="text-3xl md:text-4xl font-extrabold text-prohealth-900">
        Para tu salud.
      </h2>

      <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="d in departments"
          :key="d.title"
          class="group bg-white rounded-2xl border border-prohealth-100 p-6 hover:border-cyan-300 hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <div class="w-12 h-12 rounded-xl bg-prohealth-50 border border-prohealth-100 grid place-items-center group-hover:bg-cyan-50 group-hover:border-cyan-200 transition-colors">
            <UIcon :name="d.icon" class="w-6 h-6 text-prohealth-600 group-hover:text-cyan-600" />
          </div>
          <h3 class="mt-4 font-semibold text-prohealth-900">{{ d.title }}</h3>
          <p class="mt-1 text-sm text-prohealth-700/70">{{ d.description }}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section id="contact" class="bg-white py-20">
    <div class="max-w-5xl mx-auto px-6 lg:px-10">
      <div class="bg-hero-prohealth text-white rounded-3xl p-10 md:p-14 grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <h2 class="text-2xl md:text-3xl font-extrabold">
            ¿Listo para gestionar tu plan en línea?
          </h2>
          <p class="mt-2 text-prohealth-100/90 max-w-xl">
            Ingresa al portal para ver tu carnet, agregar afiliados familiares y consultar tu historial.
          </p>
        </div>
        <UButton
          to="/login"
          size="xl"
          class="bg-lime-500 hover:bg-lime-600 text-prohealth-950 font-semibold"
          icon="i-lucide-arrow-right"
          trailing
        >
          Ingresar ahora
        </UButton>
      </div>
    </div>
  </section>
</template>
