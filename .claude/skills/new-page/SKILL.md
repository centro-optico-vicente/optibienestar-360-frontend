---
name: new-page
description: Crear una página o pantalla nueva del panel o de un portal (ruta, permisos, menú, i18n, vistas por rol). Usar al agregar una vista en app/pages.
---
# Nueva página

1. Copiar la estructura de la página vecina más parecida en `app/pages/` (misma área/rol) en vez de partir de cero.
2. Seguir [`.ai/playbooks/new-page.md`](../../../.ai/playbooks/new-page.md); si es para un rol nuevo o vistas por rol, [`.ai/playbooks/new-role-views.md`](../../../.ai/playbooks/new-role-views.md).
3. Ruta, permisos y redirecciones: `.claude/rules/pages-routing.md` (se carga sola al tocar `app/pages/`).
4. Entrada de menú: el menú es data-driven (`useNav` + permisos del backend); si requiere un permiso nuevo, coordinarlo con el backend.
5. Textos con `node scripts/i18n-tool.mjs set …` (es + en). Al final `pnpm i18n:check`.
