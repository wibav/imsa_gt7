// Genera el PDF del reglamento general a partir de src/app/data/reglamento-general.json
//   node scripts/reglamento/pdf-borrador.mjs <salida.pdf>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { buildReglamentoGeneralDoc } from '../../src/app/utils/reglamentoGeneralPdf.js';

const require = createRequire(import.meta.url);
const pdfmake = require('pdfmake');
const vfsModulo = require('pdfmake/build/vfs_fonts');
const vfs = vfsModulo.pdfMake?.vfs || vfsModulo.vfs || vfsModulo.default || vfsModulo;
// Las fuentes van a disco: el texto de los SVG (svg-to-pdfkit) las abre por ruta
const dirFuentes = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfmake-fuentes-'));
for (const [n, b64] of Object.entries(vfs)) fs.writeFileSync(path.join(dirFuentes, n), Buffer.from(b64, 'base64'));
const f = (n) => path.join(dirFuentes, n);
pdfmake.setFonts({ Roboto: { normal: f('Roboto-Regular.ttf'), bold: f('Roboto-Medium.ttf'), italics: f('Roboto-Italic.ttf'), bolditalics: f('Roboto-MediumItalic.ttf') } });

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const datos = JSON.parse(fs.readFileSync(path.join(raiz, 'src/app/data/reglamento-general.json'), 'utf8'));
const svgs = {};
datos.sections.forEach(s => s.content.forEach(b => (b.figuras || []).forEach(f => {
    svgs[f.src] = fs.readFileSync(path.join(raiz, 'public', f.src), 'utf8');
})));
const doc = buildReglamentoGeneralDoc({
    sections: datos.sections, orgName: 'GT7 Championships', version: `${datos.version} (BORRADOR)`,
    fecha: new Date(datos.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
    generadoEl: new Date().toLocaleString('es-ES'), svgs,
    logos: {
        escudo: fs.readFileSync(path.join(raiz, 'public/reglamento/logo-gt7-esp.svg'), 'utf8'),
        insignia: 'data:image/png;base64,' + fs.readFileSync(path.join(raiz, 'public/reglamento/logo-deshbourne.png')).toString('base64'),
    },
});
await pdfmake.createPdf(doc).write(process.argv[2]);
console.log('✓', process.argv[2]);
