<script setup lang="ts">
// Birthday greeting card for the signed-in affiliate, beneficiary or advisor
// (GET /v1/me/birthdays → `self.birthdayToday`). The first time the portal opens
// that day it shows a full-screen sealed envelope; opening it reveals the card with
// the organization's logo and name and a message for the person's role. A banner
// stays for the rest of the day to open it again.
//
// Motion: gold-dust canvas, 3D envelope flap, gold-foil title and a letter-by-letter
// name. All of it is skipped under `prefers-reduced-motion`.
import type { BirthdayRole, SelfBirthday } from '~/composables/useBirthdays'

const { t } = useI18n()
const birthdays = useBirthdays()
const auth = useAuthStore()

const self = ref<SelfBirthday | null>(null)
const organizationName = ref<string | null>(null)
const overlayOpen = ref(false)
const envelopeOpened = ref(false)
const cardActive = ref(false)
const replayKey = ref(0)

const reducedMotion = ref(false)

const ROLE_KEY: Record<BirthdayRole, string> = {
  MEMBER: 'member',
  BENEFICIARY: 'beneficiary',
  ADVISOR: 'advisor',
}

const role = computed(() => ROLE_KEY[self.value?.role ?? 'MEMBER'])
const org = computed(() => organizationName.value || t('birthdays.card.defaultOrganization'))
const recipient = computed(() => self.value?.fullName || self.value?.firstName || '')
const recipientChars = computed(() => Array.from(recipient.value))

// Serif display face of the card, loaded only for people who get a card (CSP allows Google Fonts).
useHead(() => (self.value
  ? { link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&display=swap' }] }
  : {}))

const storageKey = (date: string) => `ob360.birthdayGreeting.${auth.user?.uuid ?? 'anon'}.${date}`

onMounted(async () => {
  reducedMotion.value = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const res = await birthdays.fetchMine().catch(() => null)
  if (!res?.self?.birthdayToday) return
  self.value = res.self
  organizationName.value = res.organizationName ?? null
  let seen = false
  try {
    seen = localStorage.getItem(storageKey(res.today)) === '1'
    localStorage.setItem(storageKey(res.today), '1')
  }
  catch {
    // Storage blocked: the card shows on every visit, the banner covers the rest.
  }
  if (!seen) openOverlay()
})

// ---- Overlay lifecycle ----
function openOverlay() {
  envelopeOpened.value = false
  envelopeOpening.value = false
  envelopeHidden.value = false
  cardActive.value = false
  overlayOpen.value = true
  nextTick(() => {
    startDust()
    envelopeEl.value?.focus()
  })
}

function closeOverlay() {
  overlayOpen.value = false
  stopDust()
}

const timers: ReturnType<typeof setTimeout>[] = []
function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, reducedMotion.value ? 0 : ms))
}

const envelopeEl = ref<HTMLElement | null>(null)
const envelopeOpening = ref(false)
const envelopeHidden = ref(false)

function openEnvelope() {
  if (envelopeOpened.value) return
  envelopeOpening.value = true
  const rect = envelopeEl.value?.getBoundingClientRect()
  if (rect) burst(rect.left + rect.width / 2, rect.top + rect.height / 2)
  later(() => { envelopeHidden.value = true }, 680)
  later(() => {
    envelopeOpened.value = true
    cardActive.value = true
    replayKey.value++
  }, 1150)
}

function onKeydown(event: KeyboardEvent) {
  if (!overlayOpen.value) return
  if (event.key === 'Escape') closeOverlay()
}
onMounted(() => window.addEventListener('keydown', onKeydown))

// ---- 3D tilt of the card ----
const cardEl = ref<HTMLElement | null>(null)
function onCardMove(event: MouseEvent) {
  const el = cardEl.value
  if (!el || reducedMotion.value || window.innerWidth < 768) return
  const rect = el.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  el.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`)
  el.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`)
  const rotateY = ((x / rect.width) - 0.5) * 6
  const rotateX = (0.5 - (y / rect.height)) * 6
  el.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`
}
function onCardLeave() {
  if (cardEl.value) cardEl.value.style.transform = 'rotateX(0deg) rotateY(0deg)'
}

// ---- Gold dust canvas ----
const canvasEl = ref<HTMLCanvasElement | null>(null)
let frame = 0
let mouse = { x: -1000, y: -1000 }

interface Dust { x: number, y: number, r: number, vx: number, vy: number, a: number, da: number, c: string }
interface Spark { x: number, y: number, vx: number, vy: number, a: number, decay: number, size: number, rot: number, vr: number, ribbon: boolean, c: string }
let dust: Dust[] = []
let sparks: Spark[] = []

const GOLD = '212, 175, 55'
const GOLD_LIGHT = '243, 229, 171'

function newDust(w: number, h: number, initial: boolean): Dust {
  return {
    x: Math.random() * w,
    y: initial ? Math.random() * h : h + 10,
    r: Math.random() * 2.1 + 0.6,
    vy: -(Math.random() * 0.35 + 0.12),
    vx: (Math.random() - 0.5) * 0.25,
    a: Math.random() * 0.55 + 0.15,
    da: (Math.random() * 0.008 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
    c: Math.random() > 0.35 ? GOLD : GOLD_LIGHT,
  }
}

function burst(x?: number, y?: number) {
  const canvas = canvasEl.value
  if (!canvas || reducedMotion.value) return
  const ox = x ?? canvas.width / 2
  const oy = y ?? canvas.height * 0.42
  for (let i = 0; i < 65; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = Math.random() * 4.2 + 1.2
    sparks.push({
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      a: 1,
      decay: Math.random() * 0.014 + 0.008,
      size: Math.random() * 3.5 + 1.5,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.15,
      ribbon: Math.random() > 0.45,
      c: Math.random() > 0.3 ? GOLD : GOLD_LIGHT,
    })
  }
}

function resize() {
  const canvas = canvasEl.value
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
function onMouseMove(event: MouseEvent) {
  mouse = { x: event.clientX, y: event.clientY }
}

function startDust() {
  const canvas = canvasEl.value
  if (!canvas || reducedMotion.value) return
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('mousemove', onMouseMove)
  const count = Math.min(Math.floor((canvas.width * canvas.height) / 17000), 85)
  dust = Array.from({ length: count }, () => newDust(canvas.width, canvas.height, true))
  sparks = []
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const tick = () => {
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    for (const p of dust) {
      const dx = mouse.x - p.x
      const dy = mouse.y - p.y
      const dist = Math.hypot(dx, dy)
      if (dist < 140 && dist > 0) {
        const force = (140 - dist) / 140
        p.x -= (dx / dist) * force * 0.65
        p.y -= (dy / dist) * force * 0.65
      }
      p.x += p.vx
      p.y += p.vy
      p.a += p.da
      if (p.a <= 0.12 || p.a >= 0.75) p.da *= -1
      if (p.y < -15 || p.x < -15 || p.x > w + 15) Object.assign(p, newDust(w, h, false))
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${p.c}, ${p.a})`
      ctx.shadowBlur = 8
      ctx.shadowColor = `rgba(${GOLD}, ${p.a * 0.85})`
      ctx.fill()
    }
    ctx.shadowBlur = 0
    for (let i = 0; i < dust.length; i++) {
      for (let j = i + 1; j < dust.length; j++) {
        const a = dust[i]!
        const b = dust[j]!
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (dist < 105) {
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(${GOLD}, ${(1 - dist / 105) * 0.14})`
          ctx.lineWidth = 0.6
          ctx.stroke()
        }
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]!
      s.vx *= 0.975
      s.vy = s.vy * 0.975 + 0.055
      s.x += s.vx
      s.y += s.vy
      s.rot += s.vr
      s.a -= s.decay
      if (s.a <= 0) {
        sparks.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rot)
      ctx.fillStyle = `rgba(${s.c}, ${s.a})`
      ctx.shadowBlur = 6
      ctx.shadowColor = `rgba(${GOLD}, ${s.a * 0.6})`
      if (s.ribbon) {
        ctx.fillRect(-s.size, -s.size * 0.35, s.size * 2, s.size * 0.7)
      }
      else {
        ctx.beginPath()
        ctx.arc(0, 0, s.size * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    frame = requestAnimationFrame(tick)
  }
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(tick)
}

function stopDust() {
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousemove', onMouseMove)
  dust = []
  sparks = []
}

onBeforeUnmount(() => {
  stopDust()
  timers.forEach(clearTimeout)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <template v-if="self">
    <!-- Banner for the rest of the day -->
    <div
      class="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white"
      role="status"
    >
      <div class="flex items-center gap-4">
        <span class="bday-seal-mini shrink-0" aria-hidden="true">
          <UIcon name="i-lucide-gift" class="size-5" />
        </span>
        <div class="min-w-0">
          <p class="font-bold text-lg text-amber-100">
            {{ t('birthdays.greeting.title', { name: self.firstName }) }}
          </p>
          <p class="text-sm text-slate-300">{{ t('birthdays.card.banner', { organization: org }) }}</p>
        </div>
        <UButton class="ml-auto shrink-0" color="warning" variant="solid" size="sm" icon="i-lucide-mail-open" @click="openOverlay">
          {{ t('birthdays.greeting.open') }}
        </UButton>
      </div>
    </div>

    <!-- Full-screen card -->
    <Teleport to="body">
      <Transition name="bday-fade">
        <div
          v-if="overlayOpen"
          class="bday-overlay"
          :class="{ 'bday-reduced': reducedMotion }"
          role="dialog"
          aria-modal="true"
          :aria-label="t('birthdays.card.dialogLabel')"
        >
          <canvas ref="canvasEl" class="bday-canvas" aria-hidden="true" />

          <div class="bday-stage">

            <!-- Scene 1: sealed envelope -->
            <section v-if="!envelopeOpened" class="bday-envelope-stage" :class="{ 'is-hidden': envelopeHidden }">
              <p class="bday-eyebrow bday-pill mb-6">{{ t('birthdays.card.envelopeEyebrow') }}</p>
              <div
                ref="envelopeEl"
                class="bday-envelope"
                :class="{ 'is-opening': envelopeOpening }"
                role="button"
                tabindex="0"
                :aria-label="t('birthdays.card.openEnvelope')"
                @click="openEnvelope"
                @keydown.enter.prevent="openEnvelope"
                @keydown.space.prevent="openEnvelope"
              >
                <div class="bday-flap" />
                <div class="bday-card-preview">
                  <span class="bday-preview-eyebrow">{{ t('birthdays.card.eyebrow') }}</span>
                  <p class="bday-serif text-2xl font-semibold text-[#0F172A]">{{ t('birthdays.card.title') }}</p>
                </div>
                <div class="bday-pocket"><div class="bday-pocket-right" /></div>
                <div class="bday-seal" aria-hidden="true">
                  <BrandLogo variant="isotipo" :width="34" />
                </div>
                <p class="bday-envelope-label bday-serif">
                  {{ t('birthdays.card.to', { name: recipient }) }}
                </p>
              </div>
              <button type="button" class="bday-hint bday-pill" @click="openEnvelope">
                {{ t('birthdays.card.tapSeal') }}
                <UIcon name="i-lucide-chevron-down" class="size-4 text-[#B89225]" />
              </button>
              <button type="button" class="bday-close mt-4" @click="closeOverlay">
                <UIcon name="i-lucide-x" class="size-4" />{{ t('birthdays.card.close') }}
              </button>
            </section>

            <!-- Scene 2: the card -->
            <div v-else class="bday-card-wrapper" :class="{ 'card-active': cardActive }">
              <main
                ref="cardEl"
                :key="replayKey"
                class="bday-card"
                @mousemove="onCardMove"
                @mouseleave="onCardLeave"
              >
                <div class="bday-sheen" />

                <div class="reveal-step delay-1 flex flex-col items-center mb-6 relative z-10">
                  <BrandLogo variant="horizontal" :width="170" />
                  <p class="mt-2 text-[11px] uppercase tracking-[0.32em] text-slate-500 font-semibold">
                    {{ org }}
                  </p>
                </div>

                <div class="gold-line mx-auto mb-8 relative z-10" />

                <div class="reveal-step delay-2 mb-3 relative z-10">
                  <p class="text-xs sm:text-sm uppercase tracking-[0.25em] text-[#B89225] font-semibold mb-2">
                    {{ t('birthdays.card.eyebrow') }}
                  </p>
                  <h1 class="bday-serif gold-foil text-4xl sm:text-5xl md:text-[3.5rem] font-bold tracking-tight leading-tight">
                    {{ t('birthdays.card.title') }}
                  </h1>
                </div>

                <div class="reveal-step delay-3 mb-6 relative z-10">
                  <h2 class="bday-serif italic text-2xl sm:text-3xl text-slate-800 font-medium" :aria-label="recipient">
                    <span
                      v-for="(char, i) in recipientChars"
                      :key="i"
                      class="char-reveal"
                      :style="{ animationDelay: `${0.55 + i * 0.028}s` }"
                      aria-hidden="true"
                    >{{ char === ' ' ? ' ' : char }}</span>
                  </h2>
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400 mt-1.5 font-medium">
                    {{ t(`birthdays.card.role.${role}`) }}
                  </p>
                  <div class="gold-divider mx-auto mt-4" />
                </div>

                <div class="reveal-step delay-4 max-w-lg mx-auto mb-10 relative z-10">
                  <p class="text-slate-600 text-sm sm:text-base leading-relaxed">
                    {{ t(`birthdays.card.message.${role}`, { organization: org, name: self.firstName }) }}
                  </p>
                </div>

                <div class="gold-line mx-auto mb-8 relative z-10" />

                <footer class="reveal-step delay-5 flex flex-col items-center relative z-10">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400 mb-1">
                    {{ t('birthdays.card.closing') }}
                  </p>
                  <p class="bday-serif text-xl sm:text-2xl font-semibold text-[#0F172A]">
                    {{ t('birthdays.card.signature') }}
                  </p>
                  <p class="text-xs text-[#B89225] font-medium tracking-wider uppercase mt-1">
                    {{ org }}
                  </p>
                </footer>
              </main>
              <div class="flex justify-center mt-5">
                <button type="button" class="bday-close" @click="closeOverlay">
                  <UIcon name="i-lucide-x" class="size-4" />{{ t('birthdays.card.close') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </template>
</template>

<style scoped>
.bday-overlay {
  --navy-deep: #0F172A;
  --gold: #D4AF37;
  --gold-light: #F3E5AB;
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow-y: auto;
  /* No backdrop: the portal stays visible behind the envelope and the card. */
  background: transparent;
}
.bday-canvas { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
.bday-stage {
  position: relative;
  z-index: 2;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.bday-serif { font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; }
.bday-eyebrow { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.25em; color: #B89225; font-weight: 600; }
.bday-pulse { animation: bdayPulse 2.4s ease-in-out infinite; }
/* Labels around the envelope sit over the portal: a frosted pill keeps them readable. */
.bday-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(6px);
  box-shadow: 0 6px 18px -8px rgba(15, 23, 42, 0.35);
}
@keyframes bdayPulse { 50% { opacity: 0.55; } }

.bday-close {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--navy-deep);
  background: var(--gold);
  padding: 0.5rem 1.25rem;
  border-radius: 9999px;
  box-shadow: 0 8px 20px -6px rgba(15, 23, 42, 0.45);
  cursor: pointer;
  transition: background 0.2s;
}
.bday-close:hover { background: #c5a028; }

/* Envelope */
.bday-envelope-stage {
  perspective: 1400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 0;
  transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.bday-envelope-stage.is-hidden { opacity: 0; transform: scale(0.92) translateY(30px); pointer-events: none; }
.bday-envelope {
  position: relative;
  width: min(92vw, 480px);
  height: min(62vw, 310px);
  background: linear-gradient(145deg, #162238 0%, #0B1120 100%);
  border-radius: 10px;
  box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(212, 175, 55, 0.45), inset 0 0 35px rgba(212, 175, 55, 0.08);
  transform-style: preserve-3d;
  cursor: pointer;
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.5s ease;
  outline: none;
}
.bday-envelope:hover, .bday-envelope:focus-visible {
  transform: translateY(-6px) rotateX(4deg);
  box-shadow: 0 38px 70px -15px rgba(0, 0, 0, 0.85), 0 0 25px rgba(212, 175, 55, 0.25), 0 0 0 1px rgba(212, 175, 55, 0.75);
}
.bday-envelope::after { content: ''; position: absolute; inset: 10px; border: 1px solid rgba(212, 175, 55, 0.28); border-radius: 6px; pointer-events: none; z-index: 4; }
.bday-pocket { position: absolute; inset: 0; overflow: hidden; border-radius: 10px; z-index: 3; pointer-events: none; }
.bday-pocket::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.92) 0%, #0F172A 100%);
  clip-path: polygon(0 100%, 50% 48%, 100% 100%);
}
/* Side flaps: one triangle each (a single self-crossing polygon would leave the card showing). */
.bday-pocket::after, .bday-pocket-right {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, #131D31 0%, #0D1526 100%);
}
.bday-pocket::after { clip-path: polygon(0 0, 50.5% 52%, 0 100%); }
.bday-pocket-right {
  background: linear-gradient(270deg, #131D31 0%, #0D1526 100%);
  clip-path: polygon(100% 0, 49.5% 52%, 100% 100%);
}
.bday-flap {
  position: absolute; top: 0; left: 0; width: 100%; height: 58%;
  background: linear-gradient(180deg, #1E293B 0%, #0F172A 100%);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  transform-origin: top center;
  transition: transform 0.95s cubic-bezier(0.4, 0, 0.2, 1), z-index 0.3s step-end;
  z-index: 5;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45));
}
.bday-flap::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(212, 175, 55, 0.35), transparent 60%); clip-path: polygon(0 0, 100% 0, 50% 100%); }
.bday-envelope.is-opening .bday-flap { transform: rotateX(180deg); z-index: 1; }
.bday-card-preview {
  position: absolute; left: 7%; right: 7%; bottom: 12%; height: 76%;
  background: linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%);
  border-radius: 6px; border: 1px solid rgba(212, 175, 55, 0.6);
  z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1rem;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  transition: transform 0.95s cubic-bezier(0.22, 1, 0.36, 1) 0.35s;
}
.bday-preview-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.25em; color: #B89225; font-weight: 600; margin-bottom: 0.25rem; }
.bday-envelope.is-opening .bday-card-preview { transform: translateY(-65%) scale(1.04); }
.bday-seal {
  position: absolute; top: 52%; left: 50%; transform: translate(-50%, -50%);
  width: 68px; height: 68px; border-radius: 9999px;
  background: radial-gradient(circle at 30% 30%, #F3E5AB 0%, #D4AF37 45%, #997A15 100%);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.65), inset 0 2px 4px rgba(255, 255, 255, 0.65), inset 0 -3px 6px rgba(92, 70, 8, 0.85), 0 0 0 3px rgba(212, 175, 55, 0.35);
  z-index: 6; display: flex; align-items: center; justify-content: center;
  transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease;
  animation: sealPulse 2.8s infinite ease-in-out;
}
.bday-seal :deep(img) { padding: 0 !important; }
.bday-envelope:hover .bday-seal { transform: translate(-50%, -50%) scale(1.08); }
.bday-envelope.is-opening .bday-seal { transform: translate(-50%, -50%) scale(1.35); opacity: 0; }
@keyframes sealPulse {
  0%, 100% { box-shadow: 0 8px 20px rgba(0, 0, 0, 0.65), inset 0 2px 4px rgba(255, 255, 255, 0.65), 0 0 0 2px rgba(212, 175, 55, 0.3); }
  50% { box-shadow: 0 10px 26px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.8), 0 0 0 8px rgba(212, 175, 55, 0.12); }
}
.bday-envelope-label {
  position: absolute; bottom: 1rem; left: 0; right: 0; text-align: center; z-index: 10; pointer-events: none;
  font-style: italic; font-size: 1.05rem; color: var(--gold-light); letter-spacing: 0.02em; padding: 0 1.5rem;
}
.bday-hint {
  margin-top: 1.75rem; display: inline-flex; align-items: center; gap: 0.5rem;
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.25em; color: #334155; font-weight: 600; cursor: pointer;
}
.bday-hint:hover { color: #B89225; }
.bday-seal-mini {
  display: inline-flex; align-items: center; justify-content: center; width: 2.5rem; height: 2.5rem; border-radius: 9999px;
  color: #0F172A; background: radial-gradient(circle at 30% 30%, #F3E5AB 0%, #D4AF37 45%, #997A15 100%);
}

/* Card */
.bday-card-wrapper { width: 100%; max-width: 42rem; perspective: 1200px; }
.bday-card {
  position: relative; overflow: hidden; text-align: center;
  border-radius: 0.5rem; padding: 3rem 2rem;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
  color: var(--navy-deep);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(212, 175, 55, 0.3);
  transform-style: preserve-3d;
  transition: transform 0.25s ease-out;
}
@media (min-width: 640px) { .bday-card { padding: 4rem 3.5rem; } }
.bday-card::before { content: ''; position: absolute; inset: 12px; border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 6px; pointer-events: none; z-index: 3; }
.bday-sheen {
  position: absolute; inset: 0; pointer-events: none; z-index: 2; opacity: 0; transition: opacity 0.4s ease;
  background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(212, 175, 55, 0.12) 0%, transparent 55%);
}
.bday-card:hover .bday-sheen { opacity: 1; }

.reveal-step { opacity: 0; transform: translateY(20px); }
.card-active .reveal-step { animation: executiveReveal 0.95s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.delay-1 { animation-delay: 0.15s !important; }
.delay-2 { animation-delay: 0.35s !important; }
.delay-3 { animation-delay: 0.55s !important; }
.delay-4 { animation-delay: 0.8s !important; }
.delay-5 { animation-delay: 1.05s !important; }
@keyframes executiveReveal { to { opacity: 1; transform: translateY(0); } }

.gold-foil {
  background: linear-gradient(110deg, #0F172A 0%, #0F172A 38%, #B89225 47%, #E5C158 50%, #B89225 53%, #0F172A 62%, #0F172A 100%);
  background-size: 240% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: foilSweep 5.5s ease-in-out infinite;
}
@keyframes foilSweep { 0%, 25% { background-position: 100% 0; } 65%, 100% { background-position: -100% 0; } }

.char-reveal { display: inline-block; opacity: 0; transform: translateY(10px) scale(0.96); filter: blur(3px); }
.card-active .char-reveal { animation: charFadeIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
@keyframes charFadeIn { to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }

.gold-line { width: 0; height: 1px; background: linear-gradient(90deg, transparent, #D4AF37, transparent); }
.card-active .gold-line { animation: drawLine 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.4s forwards; }
.gold-divider { width: 0; height: 1.5px; background-color: #D4AF37; }
.card-active .gold-divider { animation: drawShort 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.7s forwards; }
@keyframes drawLine { to { width: 100%; } }
@keyframes drawShort { to { width: 64px; } }

.bday-fade-enter-active, .bday-fade-leave-active { transition: opacity 0.35s ease; }
.bday-fade-enter-from, .bday-fade-leave-to { opacity: 0; }

/* Reduced motion: everything visible at once, no movement. */
.bday-reduced .reveal-step, .bday-reduced .char-reveal { opacity: 1; transform: none; filter: none; animation: none !important; }
.bday-reduced .gold-line { width: 100%; animation: none !important; }
.bday-reduced .gold-divider { width: 64px; animation: none !important; }
.bday-reduced .gold-foil, .bday-reduced .bday-seal, .bday-reduced .bday-pulse { animation: none; }
.bday-reduced .bday-flap, .bday-reduced .bday-card-preview, .bday-reduced .bday-envelope-stage { transition: none; }
</style>
