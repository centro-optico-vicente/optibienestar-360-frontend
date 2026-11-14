---
name: new-form
description: Crear o modificar un formulario (crear/editar) con vee-validate + zod, selects desde catálogo y errores del backend. Usar al construir modales o páginas de alta/edición.
---
# Nuevo formulario

1. Seguir [`.ai/playbooks/new-form.md`](../../../.ai/playbooks/new-form.md) y copiar un formulario vecino parecido (`grep -rl 'useForm' app/components | head`).
2. Editar = cargar el detalle con `GET /{uuid}` al abrir, nunca la fila del listado.
3. Selects desde catálogo / `/options` con búsqueda `?q=` debounced ([`.ai/specs/14-list-search-debounce.md`](../../../.ai/specs/14-list-search-debounce.md)).
4. Zod valida formato; reglas de negocio las responde el backend (mostrar su mensaje RFC 7807).
5. Etiquetas y mensajes por i18n (`node scripts/i18n-tool.mjs set`). Spec completa solo si hace falta: `.ai/specs/07-forms.md` (grande; buscar la sección con `grep -n '^#'`).
