# `.ai/` del frontend — mapa de la carpeta

> Se carga solo cuando la IA abre algo dentro de `.ai/`; por eso es corto ([ADR 0040 del hub](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0040-ai-context-token-budget.md)). Reglas y ruteo por tarea: [`CLAUDE.md` raíz](../CLAUDE.md).

| Carpeta / archivo | Contiene | Cuándo abrirlo |
|---|---|---|
| `decisions/README.md` | Índice de ADR locales (`LOC-`) | Antes de proponer un diseño |
| `specs/NN-*.md` | Convenciones por área (índice en `specs/00-overview.md`) | Solo la del área que se toca |
| `playbooks/` | Pasos para página, formulario, tabla, vistas de rol, entorno local | Vía las skills `new-*` |
| `context/current-state.md`, `context/design-tokens.md` | Lo que existe HOY; paleta y tokens | Antes de asumir; al tocar estilos |
| `checklist.md` → `checklists/` (+ `checklist-vertical.md`) | Tabla resumen → tareas por vista | Para elegir o marcar trabajo |
| `notes/`, `scope-additions-*.md`, `dto-shape-mismatches.md` | Auditorías e históricos | Solo si la tarea los nombra |
| `skills.md` | Catálogo de skills y MCP | Al instalar skills |

Al marcar tareas, recalcular totales con `../centro-optico-vicente/scripts/ai/ai_audit.sh checklists .ai`.
