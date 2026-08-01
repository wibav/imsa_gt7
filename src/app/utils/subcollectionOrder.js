/**
 * Ordenamiento fiel de documentos de subcolecciones de eventos
 * (events/{id}/participants|waitlist|results|rounds).
 *
 * Bug que esto arregla: los documentos se guardan con IDs tipo `r0`, `r1`,
 * `r2`… `r10`, `r11`… y el código viejo los recuperaba con
 * `snapshot.docs.sort((a,b) => a.id.localeCompare(b.id))`, es decir,
 * ORDEN LEXICOGRÁFICO DE STRING. Con 10 documentos o menos eso coincide por
 * casualidad con el orden numérico ("r0".."r9" ya es orden alfabético
 * correcto). Desde el documento 11 ("r10") dejan de coincidir: "r10" ordena
 * ANTES que "r2" porque '1' < '2' como carácter. El resultado real
 * observado para 16 resultados era
 * r0,r1,r10,r11,r12,r13,r14,r15,r2,r3,r4,r5,r6,r7,r8,r9 — el podio quedaba
 * destruido en cualquier evento con 11+ resultados.
 *
 * Esta función ordena por el SUFIJO NUMÉRICO del ID del documento (p.ej.
 * "r10" -> 10), que es la fuente de verdad real de "en qué orden se guardó
 * esto" — manda por encima de `orderField` (p.ej. `position`) porque el
 * propio bug pudo haber dejado `position` desalineado en datos ya
 * corrompidos por guardados anteriores hechos con la vista desordenada.
 * Si el ID no tiene sufijo numérico con el prefijo esperado (p.ej. las
 * inscripciones públicas `p{timestamp}_{rand}` de
 * `addEventParticipant`), se usa `orderField` como respaldo, y si tampoco
 * existe, `localeCompare` del ID completo como desempate final estable —
 * así los documentos sin sufijo numérico (inscripciones públicas) quedan
 * después de los `p0..pN` administrativos, que es el orden correcto: se
 * inscribieron más tarde.
 *
 * Robustez: no depende de padding de longitud fija (`r09` vs `r10`), así
 * que sigue siendo correcto sin importar cuántos documentos haya (16, 64,
 * 100, 101...).
 *
 * @param {Array<{id: string, data: () => object}>} docs - snapshot.docs de Firestore
 * @param {{prefix: string, orderField?: string}} options
 * @returns {Array<{id: string, data: () => object}>} docs ordenados (no muta el array de entrada)
 */
export function sortSubcollectionDocs(docs, { prefix, orderField } = {}) {
  const numericSuffix = (id) => {
    if (typeof id !== 'string' || !prefix || !id.startsWith(prefix)) return null;
    const suffix = id.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) return null;
    return parseInt(suffix, 10);
  };

  return [...docs].sort((a, b) => {
    const nA = numericSuffix(a.id);
    const nB = numericSuffix(b.id);

    // Ambos con sufijo numérico del prefijo esperado: orden numérico real.
    if (nA !== null && nB !== null) return nA - nB;

    // Solo uno tiene sufijo numérico del prefijo esperado: ese va primero
    // (documentos administrativos p0..pN antes que inscripciones públicas
    // p{timestamp}_{rand}).
    if (nA !== null && nB === null) return -1;
    if (nA === null && nB !== null) return 1;

    // Ninguno tiene sufijo numérico reconocible: usar orderField como
    // respaldo si está disponible en los datos del documento.
    if (orderField) {
      const dataA = a.data();
      const dataB = b.data();
      const fA = dataA?.[orderField];
      const fB = dataB?.[orderField];
      if (typeof fA === 'number' && typeof fB === 'number' && fA !== fB) {
        return fA - fB;
      }
    }

    // Desempate final estable.
    return a.id.localeCompare(b.id);
  });
}
