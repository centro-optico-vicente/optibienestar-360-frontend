# Checklist operacional — OptiBienestar 360 Frontend

> Subset del [checklist maestro](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/checklist.md) (tag `[F]`).
>
> **Propósito:** dashboard de progreso global. Los checkboxes canónicos viven en los archivos de fase y vista en [`checklists/`](checklists/).
>
> **Orden de ejecución por vista:** [`checklist-vertical.md`](checklist-vertical.md).
>
> **Mantener sincronizado:** al completar una tarea, marcar `- [x]` en el archivo correspondiente y actualizar la tabla de resumen aquí.

---

## Cómo leer las etiquetas `[P/C]`

### Prioridad (P)

| Tag | Significado | Usar cuando… |
|---|---|---|
| **P0** | Blocker / crítico | El resto de la vista depende de esto |
| **P1** | Alta | Desbloquea múltiples tareas o resuelve riesgo importante |
| **P2** | Estándar | Trabajo normal del roadmap |
| **P3** | Nice-to-have | Mejora pero no urgente |

### Complejidad (C)

| Tag | Esfuerzo aprox. | Ejemplo |
|---|---|---|
| **C1** | < 30 min | Config, línea única, agregar dependencia |
| **C2** | 30 min – 2 h | Una página/componente, patrón conocido, sin research |
| **C3** | 2 h – 1 día | Multi-archivo, algo de investigación |
| **C4** | 1–3 días | Cross-cutting, varios subsistemas |
| **C5** | 3+ días | Arquitectural, decisiones importantes |

---

## Fases de bootstrap

| Fase | Archivo | Tareas | Hechas | Pendientes | Estado |
|---|---|---|---|---|---|
| FASE 0 — Bootstrap | [fase-0-bootstrap.md](checklists/fase-0-bootstrap.md) | 3 | 1 | 2 | 🟡 En curso |
| FASE 1 — Bootstrap Nuxt | [fase-1-bootstrap-frontend-nuxt.md](checklists/fase-1-bootstrap-frontend-nuxt.md) | 19 | 2 | 17 | 🟡 Docker/CI hechos |

---

## FASE 5 — Vistas por vertical

> Fuente de verdad: archivos `vertical-N-*.md`. Numeración alineada con el backend (ver [`checklist-vertical.md`](checklist-vertical.md)).
>
> **Adicionales v2** (PDF mesas técnicas + flyer): vistas 3/4/5/8 tienen sección `[v2]` y la vista-12 es nueva. Mapa de trazabilidad UI: [`scope-additions-v2.md`](scope-additions-v2.md). Vista-11 (i18n bilingüe) entró en paralelo para sincronizar con el backend.

| # | Vista | Archivo | Tareas | Hechas | Pendientes | Estado |
|---|---|---|---|---|---|---|
| 1 | Seguridad y Autenticación | [vertical-1](checklists/vertical-1-seguridad-y-autenticacion.md) | 6 | 6 | 0 | ✅ Completa |
| 2 | Catálogos | [vertical-2](checklists/vertical-2-catalogos.md) | 3 | 3 | 0 | ✅ Completa |
| 3 | Aliados | [vertical-3](checklists/vertical-3-aliados.md) | 11 | 0 | 11 | 🔲 (incl. v2) |
| 4 | Afiliados y Familia | [vertical-4](checklists/vertical-4-afiliados-y-familia.md) | 10 | 0 | 10 | 🔲 (incl. v2) |
| 5 | Planes y Membresías | [vertical-5](checklists/vertical-5-planes-y-membresias.md) | 11 | 0 | 11 | 🔲 (incl. v2) |
| 6 | Pagos manuales | [vertical-6](checklists/vertical-6-pagos-manuales.md) | 4 | 0 | 4 | 🔲 |
| 7 | Validador | [vertical-7](checklists/vertical-7-validador.md) | 4 | 0 | 4 | 🔲 |
| 8 | Promotores, Comisiones y Referidos | [vertical-8](checklists/vertical-8-promotores-comisiones-referidos.md) | 14 | 0 | 14 | 🔲 (incl. v2) |
| 9 | Portal afiliado y Carnet digital | [vertical-9](checklists/vertical-9-notificaciones-y-carnet.md) | 5 | 0 | 5 | 🔲 |
| 10 | Optimización, Reportes, QA, Deps y Rendering SSR | [vertical-10](checklists/vertical-10-optimizacion-reportes-hardening.md) | 9 | 0 | 9 | 🔲 |
| 11 | Internacionalización (i18n) — `es` + `en`, sync locale con JWT | [vertical-11](checklists/vertical-11-i18n.md) | 16 | 0 | 16 | 🔲 |
| 12 | **[v2]** Subsidios y Exoneraciones | [vertical-12](checklists/vertical-12-subsidios-y-exoneraciones.md) | 10 | 0 | 10 | 🔲 |
| **TOTAL FASE 5** | | | **103** | **9** | **94** | 🟡 9% |

---

## Notas operativas

- **Fuente de verdad de checkboxes:** archivos `checklists/` (fases y vistas).
- **Al completar una tarea:** marcar `- [x]` en el archivo + actualizar la fila de la tabla arriba.
- **Al agregar tareas nuevas:** añadir en el archivo de la vista + sumar al conteo.
- **Conteo rápido:** `grep -c "^\- \[x\]" .ai/checklists/vertical-N-*.md`
- **Sincronizar con hub:** actualizar [`context/current-state.md`](context/current-state.md) al cierre de cada sesión.

---

## Referencias

- [`checklist-vertical.md`](checklist-vertical.md) — dependencias entre vistas
- [`context/current-state.md`](context/current-state.md) — estado real del código hoy
- [Hub maestro checklist](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/checklist.md) — tag `[F]`
