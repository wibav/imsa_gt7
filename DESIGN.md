# Patrones de diseño (canónico)

Este proyecto no usa una librería de componentes de UI: todo es Tailwind aplicado
directamente en cada archivo. No hay enforcement automático de estas reglas —
este documento existe para que las próximas features copien el patrón que ya
domina el código, en vez de inventar uno nuevo con paddings/radios/colores
ligeramente distintos.

Origen: auditoría de consistencia visual (`design-auditor`, agosto 2026).
Puntuación inicial: 6.5/10. Los valores "canónicos" abajo son los que ya
ganaban por uso mayoritario en el código real, no un ideal inventado desde cero.

## Colores

- **Fondo de página**: `bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800`.
- **CTA primario**: `bg-gradient-to-r from-orange-600 to-red-600`, hover
  `hover:from-orange-700 hover:to-red-700` (oscurece, no aclara).
- **Texto secundario**: `text-gray-*` es el estándar (868 usos). No mezclar con
  `text-slate-*` (27 usos, remanente) dentro del mismo archivo.
- Los tokens `--color-hgt-*` / `--color-gt7-*` que existían en `globals.css`
  **fueron eliminados** (agosto 2026) — tenían 0 usos reales en todo el repo.
  Si en el futuro se necesita una paleta de marca reutilizable, definirla de
  nuevo pero verificar que se consuma desde el primer commit que la agregue.
- Colores hardcodeados en hex están permitidos únicamente donde Tailwind no
  aplica: exportación a canvas/imagen (`RaceBriefing.js`, `ExportableEventResults.js`,
  `ExportableStandings.js`). Si agregas un cuarto archivo así, considera mover
  los valores compartidos a una constante única en vez de repetir los hex.

## Botón CTA primario

```jsx
<button className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all">
  Texto
</button>
```

- Siempre con estado `hover:` — un CTA público sin hover se lee como roto.
- `px-6 py-3` es el tamaño estándar para CTAs de página completa. Variantes
  más pequeñas (`px-4 py-2`, dentro de tarjetas/toolbars) son válidas pero no
  mezclarlas para el mismo botón en el mismo contexto.
- Si vas a tocar un tercer archivo con este mismo patrón, es la señal de
  extraerlo a `src/app/components/ui/Button.js` en vez de copiarlo de nuevo
  (ver "Deuda pendiente" abajo — ya hay 38 copias).

## Tarjetas / paneles

Patrón dominante:

```jsx
<div className="bg-white/5 border border-white/10 rounded-xl p-4">
```

- Fondo: `bg-white/5` (translúcido sobre el gradiente de página).
- Borde: `border border-white/10` (sutil) o `border-white/20` si necesita
  destacar más (ej. tarjetas interactivas/seleccionables).
- Radio: `rounded-xl` para tarjetas de contenido; `rounded-lg` para elementos
  más pequeños (inputs, badges, botones). `rounded-2xl` reservar para
  contenedores de página completa (modales, secciones hero), no para tarjetas
  individuales dentro de una lista.

## Modales

```jsx
<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div className="bg-slate-800 border border-white/30 rounded-lg p-6 w-full max-w-md">
    ...
  </div>
</div>
```

- Backdrop: **`bg-black/70 backdrop-blur-sm`** — es el patrón usado en 25+
  modales del repo. `bg-black/50` quedaba como excepción en 3 lugares
  (`AdminLayout.js` drawer móvil, `RegistrationModal.js`,
  `championshipsAdmin/page.js` modal de agregar piloto) — corregidos a `/70`
  en agosto 2026 para que el contraste del backdrop sea uniforme.
- `bg-black/50` sigue siendo válido para overlays que NO son modales (ej.
  overlay de imagen dentro de una card, como en `EventCard.js`/`ChampionshipCard.js`) —
  ahí el propósito es oscurecer una foto, no un backdrop de diálogo.

## Inputs de formulario

```jsx
<input className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />
```

- Tamaño estándar: `px-4 py-2`, sin `text-sm` (texto a tamaño normal del form).
- Variante compacta permitida **solo** dentro de bloques anidados/repetidos
  (ej. filas de piloto dentro de un formulario de equipo): `px-3 py-2 text-sm`.
  La diferencia de tamaño ahí es intencional — jerarquía visual entre el campo
  principal y sus sub-campos — no una inconsistencia a corregir.
- Focus state: siempre `focus:outline-none focus:ring-2 focus:ring-orange-500`
  (91 usos). No usar solo `focus:border-*` sin `ring` — el feedback visual es
  más débil y rompe la consistencia con el resto del formulario.

## Tipografía (encabezados)

No hay una escala formal todavía — la auditoría encontró el mismo nivel
semántico (`h2`/`h3`) renderizado entre `text-lg` y `text-3xl` según el
archivo. Hasta que se defina una escala real, usar como referencia:

- Título de página (`h1`): `text-3xl sm:text-4xl font-extrabold text-white`
- Título de sección (`h2`): `text-xl font-bold` (ver `terminos/privacidad/reembolsos`)
- Subtítulo de tarjeta (`h3`/`h4`): `text-sm font-bold uppercase tracking-wide`
  para etiquetas de sección dentro de una tarjeta (ver `RegistrationForm.js`)

## Deuda de diseño pendiente (no resuelta en esta pasada)

Corregido en agosto 2026 (bajo riesgo, mecánico):
- ✅ Tokens de color muertos eliminados de `globals.css`.
- ✅ Hover faltante en 2 CTAs públicos (`pilots/page.js`, `championships/page.js`).
- ✅ Backdrop de modal unificado a `bg-black/70` en los 3 outliers.

Pendiente, requiere refactor más amplio (no se tocó, para no arriesgar
regresiones sin QA dedicado):
- Extraer `<Button variant="primary">` — 38 copias del mismo CTA en 24 archivos.
- Extraer `<Card>`/`<Panel>` — 8+ variantes de tarjeta con combinaciones
  distintas de opacidad/borde/radio/padding.
- Definir una escala tipográfica real y aplicarla (actualmente ad-hoc por archivo).
- Unificar badges/pills (`EventCard.js` solo tiene 4 variantes de padding).
- Centralizar los hex de exportación a imagen (`RaceBriefing.js` y las 2
  `Exportable*.js`) en un único archivo de constantes de color.

Si se quiere abordar alguno de estos, mejor como tarea dedicada (afecta muchos
archivos a la vez) en vez de mezclado con features funcionales.
