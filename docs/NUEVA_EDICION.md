# Nueva edición de un campeonato

Crear la siguiente edición de un campeonato con divisiones: los pilotos que
continúan, sus ascensos y descensos, sus tiempos de Pre-Qualy, y los nuevos
inscritos haciendo la Pre-Qualy en las mismas condiciones.

## Decisiones (2026-09-19)

| Pregunta | Decisión |
|---|---|
| Colocación de los nuevos | Rellenan los huecos por tiempo de Pre-Qualy, desde la división más alta con plazas |
| Confirmación del piloto | Desde la web, eligiéndose de la lista (sin cuentas); el admin puede corregir |
| Sin confirmar al vencer el plazo | Baja automática; su plaza queda libre |
| Tiempos de Pre-Qualy | Se conservan solo los de quienes continúan |
| Pre-Qualy de la nueva edición | Igual que la anterior (circuito, autos, duración, sala); solo cambia la fecha |

## Flujo

1. **Asistente** — admin del campeonato → «🔁 Nueva edición»
   (`/championshipsAdmin/nuevaEdicion?id=`). Datos, pilotos que continúan con
   su movimiento (editable) y resumen. Crea un campeonato `draft` con
   `edition.previousChampionshipId`, las divisiones vacías y los veteranos como
   inscripciones `pending` con `carryover`.
2. **Confirmación** — página pública → «🔁 ¿Continúas?» (`ContinuityModal`).
   Respuesta en `championships/{id}/continuations/{regId}`.
3. **Seguimiento** — admin → pestaña «🔁 Continuidad» (`ContinuityTab`): plazo,
   estado de cada veterano, corrección a mano, mensaje para WhatsApp,
   «Aplicar respuestas ahora» y «Cerrar plazo ahora».
4. **Cierre** — `close_edition_continuity` (cada 15 min, hora de España): al
   vencer el plazo vuelca las respuestas en las inscripciones (confirmó →
   `approved`; no continúa o sin respuesta → `withdrawn`) y avisa por Telegram.
5. **Reparto** — admin → Divisiones → «🔁 Repartir nueva edición»: veteranos
   confirmados a su división según el movimiento; nuevos por tiempo en los
   huecos; vista previa editable antes de aplicar.

## Datos

```
championships/{id}
  edition: { previousChampionshipId, previousName, continuityDeadline,
             continuityClosedFor, continuityClosedAt, createdAt }
  registrations[].carryover: { fromChampionshipId, fromRegistrationId,
             divisionName, divisionIndex, position, movement: up|down|stay,
             continuity: pending|confirmed|declined|expired, resolvedAt }
  preQualy.results[].fromPreviousEdition: true   // tiempo heredado
championships/{id}/continuations/{regId}: { status, by: piloto|admin, updatedAt }
```

`inscripcionCuenta()` (utils/championshipUtils.js) decide quién cuenta como
participante: excluye bajas y veteranos sin confirmar.

Lógica pura y tests: `src/app/utils/newEdition.js`,
`node scripts/test-new-edition.mjs`.
