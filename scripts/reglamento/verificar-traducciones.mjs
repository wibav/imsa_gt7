/*
 * Comprueba que las traducciones del reglamento general (inglés y portugués)
 * siguen al original en español: misma versión, mismas secciones, el mismo
 * número de bloques, puntos, filas y celdas, y sus figuras localizadas.
 *
 * Ejecutar después de cambiar el reglamento (reglamento-general-v2.py):
 *     node scripts/reglamento/verificar-traducciones.mjs
 *
 * Si la versión no coincide, la web muestra el reglamento en español con un
 * aviso a quien lo vea en otro idioma: no se rompe nada, pero hay que
 * actualizar data/reglamento-general.<idioma>.json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'app', 'data');
const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const leer = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const es = leer('reglamento-general.json');

let errores = 0;
const mal = (lang, msg) => { errores++; console.log(`✗ [${lang}] ${msg}`); };

for (const lang of ['en', 'pt']) {
    const tr = leer(`reglamento-general.${lang}.json`);
    if (tr.version !== es.version) mal(lang, `versión ${tr.version} ≠ original ${es.version}`);
    const ids = (r) => r.sections.map(s => s.id).join(',');
    if (ids(tr) !== ids(es)) { mal(lang, 'las secciones no coinciden'); continue; }
    es.sections.forEach((s, i) => {
        const t = tr.sections[i];
        if (t.content.length !== s.content.length) return mal(lang, `${s.id}: ${t.content.length} bloques ≠ ${s.content.length}`);
        s.content.forEach((b, j) => {
            const c = t.content[j];
            const donde = `${s.id} bloque ${j + 1}`;
            if ((b.items || []).length !== (c.items || []).length) mal(lang, `${donde}: puntos ${(c.items || []).length} ≠ ${(b.items || []).length}`);
            if ((b.headers || []).length !== (c.headers || []).length) mal(lang, `${donde}: cabeceras distintas`);
            if ((b.rows || []).length !== (c.rows || []).length) mal(lang, `${donde}: filas distintas`);
            (b.rows || []).forEach((r, k) => {
                if ((r.cells || r).length !== ((c.rows || [])[k]?.cells || []).length) mal(lang, `${donde}: celdas de la fila ${k + 1}`);
            });
            (b.figuras || []).forEach((f, k) => {
                const esperada = f.src.replace('.svg', `.${lang}.svg`);
                if ((c.figuras || [])[k]?.src !== esperada) mal(lang, `${donde}: figura ${esperada}`);
                else if (!fs.existsSync(path.join(PUBLIC, esperada))) mal(lang, `${esperada} no existe (python3 scripts/reglamento/generar-figuras.py)`);
            });
        });
    });
}
console.log(errores ? `${errores} problema(s)` : `✓ Traducciones al día con la versión ${es.version}`);
process.exit(errores ? 1 : 0);
