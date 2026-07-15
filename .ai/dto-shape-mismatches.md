# Desfases de forma DTO — frontend vs. backend

> **Auditoría:** 2026-07-15. Se compararon **todos** los tipos `*Dto` de `app/types/` contra su
> record de Java, su mapper MapStruct y el tipo de retorno declarado por el controller.
> **6 hallazgos reales** (1 ya corregido, 5 pendientes). Los pendientes viven como tareas en
> [`checklists/vertical-3-aliados.md`](checklists/vertical-3-aliados.md) y
> [`checklists/vertical-4-afiliados-y-familia.md`](checklists/vertical-4-afiliados-y-familia.md).
> Este archivo documenta **el patrón**, no los casos.

## El patrón

Los seis hallazgos tienen exactamente la misma forma:

> **El backend tiene dos proyecciones por recurso. El frontend tiene un solo tipo escrito a mano.**

| Recurso | Backend: listar | Backend: detalle | Frontend |
|---|---|---|---|
| Aliado admin | `AllyListItemDto` (plano: `allyTypeName`) | `AllyDetailDto` (anidado: `allyType{}`) | un solo `AllyDto` (anidado) |
| Aliado público | `PublicAllyListItemDto` (plano, sin especialidades) | `PublicAllyDetailDto` (`specialtyNames: String[]`) | un solo `PublicAllyDto` (anidado, `specialties: CatalogRef[]`) |
| Personal de aliado | `AllyUserDto` (plano: `userUuid`) | — | `AllyUserDto` con `user{}` anidado ✅ corregido |
| Afiliado | `MemberListItemDto` | `MemberDetailDto` (`activeBeneficiariesCount`) | `MemberDto` con `beneficiaries[]` inexistente |

El tipo del frontend describe **la forma que el desarrollador esperaba**, no la que viaja por el cable.
Como el listado usa la proyección compacta, la mitad de los campos leídos llegan `undefined` — y
`?.` los convierte silenciosamente en `—`, un badge que no renderiza, o un estado vacío.

## Por qué TypeScript no ayuda acá

Este es el punto que hay que interiorizar antes de tocar cualquiera de estos tipos:

```ts
// El tipo dice esto...
interface AllyUserDto { user?: { fullName?: string } }

// ...así que esto compila perfecto. Y siempre imprime '—'.
{{ s.user?.fullName || '—' }}
```

**TypeScript valida el código contra el tipo. No valida el tipo contra la realidad.** Un tipo escrito
a mano es una *afirmación*, y el compilador la toma como axioma. Por eso estos seis bugs pasaron
typecheck, build, CI y code review: no hay ninguna etapa que compare el tipo con el JSON real.

Corolario práctico: **`pnpm typecheck` verde no es evidencia de que un DTO esté bien.** La única
evidencia es leer el record + el mapper del backend, o ver la respuesta real.

## Síntoma característico

Todos se manifiestan igual, y por eso son fáciles de pasar por alto en QA:

- **Nunca crashean.** El optional chaining los degrada a un vacío plausible.
- **Se ven como "sin datos"**, no como un error. Un `—` parece un registro incompleto, no un bug.
- **A veces se auto-reparan** (el detalle admin de afiliado carga los beneficiarios al editar), lo que
  hace que el reporte del usuario no reproduzca.

Regla al revisar: si un campo se ve vacío en la UI **para todos los registros**, sospechar del tipo
antes que de los datos.

## El fix durable

Los cinco pendientes se pueden corregir a mano, pero eso **no mata la clase** — el próximo tipo escrito
a mano vuelve a mentir. Opciones, de menos a más ambiciosa:

1. **Espejar el cable en los tipos** (táctico): dividir `AllyDto` → `AllyListItemDto` + `AllyDetailDto`
   y `PublicAllyDto` → `PublicAllyListItemDto` + `PublicAllyDetailDto`. Barato y elimina los 5 síntomas,
   pero sigue dependiendo de que alguien mantenga la copia a mano.
2. **Generar los tipos desde el OpenAPI** (durable): el backend ya tiene `springdoc-openapi` y los
   controllers declaran su tipo de retorno exacto, así que `/v3/api-docs` es fiel. Generar
   `app/types/api.d.ts` con `openapi-typescript` y consumir esos tipos convierte cada desfase futuro en
   un error de compilación. Requiere decidir si se genera en CI (contra un backend levantado) o se
   commitea el esquema — es un cambio de tooling, merece su propio ADR.

**Recomendación:** (1) ahora para parar el sangrado, (2) como tarea de hardening en
[`checklists/vertical-10-optimizacion-reportes-hardening.md`](checklists/vertical-10-optimizacion-reportes-hardening.md).

## Cómo re-auditar

Cuando se agregue un `*Dto` nuevo al frontend, verificar contra estas tres fuentes (en este orden):

1. El **tipo de retorno del controller** — distingue `Page<XListItemDto>` de `XDetailDto`.
2. El **record** — sus componentes son las claves JSON (no hay `@JsonProperty` ni estrategia de
   nombres global en este backend; camelCase tal cual).
3. El **mapper** — las líneas `@Mapping(target=..., source=...)` son las que aplanan
   (`userFullName ← user.person.fullName`).
