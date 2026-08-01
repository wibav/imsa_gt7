/**
 * Reordenamiento por DESPLAZAMIENTO (no intercambio) para el input de
 * posición de la Sala Única de eventos estándar (Bloque 3).
 *
 * Semántica: mover el resultado en `fromIdx` a la posición final `targetPos`
 * (1-based) desplaza a todos los que quedan en medio, en vez de
 * intercambiarlo con el que ocupaba ese lugar. Esto hace estructuralmente
 * imposible tener dos resultados con la misma `position` o huecos en la
 * secuencia — CA-3.3/CA-3.6 quedan resueltos por construcción, no por
 * validación posterior.
 *
 * Pura: no depende de React ni Firebase, así que es testeable en Node
 * aislado (ver scripts/test-event-results-order-qa.mjs).
 *
 * @param {Array<object>} results - array de resultados (no se muta)
 * @param {number} fromIdx - índice actual (0-based) del resultado a mover
 * @param {number} targetPos - posición destino deseada, 1-based (se clampa a [1, n])
 * @returns {Array<object>} nuevo array con el resultado desplazado y `position` reindexado 1..n
 */
export function reorderByPosition(results, fromIdx, targetPos) {
  const list = Array.isArray(results) ? [...results] : [];
  const n = list.length;
  if (n === 0) return list;
  if (fromIdx < 0 || fromIdx >= n) return list;

  const clampedTargetPos = Math.min(Math.max(1, Math.round(targetPos)), n);
  const targetIdx = clampedTargetPos - 1;

  if (targetIdx === fromIdx) {
    // Sin movimiento — solo reindexar por si acaso venía desalineado.
    return list.map((r, i) => ({ ...r, position: i + 1 }));
  }

  const [moved] = list.splice(fromIdx, 1);
  list.splice(targetIdx, 0, moved);

  return list.map((r, i) => ({ ...r, position: i + 1 }));
}
