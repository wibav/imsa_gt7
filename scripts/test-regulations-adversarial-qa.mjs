/**
 * QA ADVERSARIAL independiente para el feature "reglamento WYSIWYG + PDF".
 * Escrito por un QA distinto al programador — NO reutiliza los casos ya
 * cubiertos en scripts/test-regulations-*-qa.mjs, ataca vectores propios.
 *
 * Uso: node scripts/test-regulations-adversarial-qa.mjs
 */
import { JSDOM } from 'jsdom';
import { createRegulationsSanitizer } from '../src/app/utils/regulationsSanitize.js';
import {
    regulationsByteSize,
    plainTextToRegulationsHtml,
    regulationsHtmlToPlainText,
    isRegulationsEmpty,
    normalizeRegulationsForSave,
    regulationsFilename,
    REGULATIONS_MAX_BYTES
} from '../src/app/utils/regulations.js';
import { buildRegulationsDocDefinition } from '../src/app/utils/regulationsPdf.js';
import { Championship } from '../src/app/models/Championship.js';

let passed = 0, failed = 0;
const failures = [];
function check(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`❌ ${name}`);
        console.log(`   ${err.message}`);
        failed++;
        failures.push({ name, error: err.message });
    }
}
function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
}

const dom = new JSDOM('');
const { sanitize } = createRegulationsSanitizer(dom.window);

// ─────────────────────────────────────────────────────────────────────────
// 1. XSS adversarial — vectores propios, mutation-XSS y evasión de regex
// ─────────────────────────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS = [
    /<script/i,
    /\bon[a-z]+\s*=/i,
    /javascript:/i,
    /data:text\/html/i,
    /<iframe/i,
    /<object/i,
    /<svg/i,
    /<math/i,
    /<img/i
];

function assertClean(out, label) {
    for (const re of FORBIDDEN_PATTERNS) {
        assert(!re.test(out), `patrón prohibido ${re} sobrevivió en "${label}": ${out}`);
    }
}

const XSS_PAYLOADS = [
    // mutation-XSS clásicos
    '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
    '<svg><set attributeName=innerHTML to="&lt;img src=x onerror=alert(1)&gt;">',
    '<svg><a xlink:href="javascript:alert(1)"><text x=20 y=20>click</text></a></svg>',
    // atributos evadiendo regex simples (salto de línea / tab dentro del nombre de atributo)
    '<a href="https://x.com" on\nclick="alert(1)">link</a>',
    '<a href="https://x.com" on\tclick="alert(1)">link</a>',
    '<img src=x on\nerror=alert(1)>',
    // entidades HTML dentro de atributos (decodificadas por el parser HTML)
    '<a href="&#106;avascript:alert(1)">click</a>',
    '<a href="&#x6A;avascript:alert(1)">click</a>',
    '<a href="jav&#x09;ascript:alert(1)">click</a>', // tab embebido vía entidad
    // espacios/tabs alrededor del esquema
    '<a href="   javascript:alert(1)">click</a>',
    '<a href="\tjavascript:alert(1)">click</a>',
    '<a href="\njavascript:alert(1)">click</a>',
    // caracteres de control antes del esquema
    '<a href="\x01javascript:alert(1)">click</a>',
    '<a href="\x00javascript:alert(1)">click</a>',
    // combinación de mayúsculas/control
    '<a href="Jav\taScript:alert(1)">click</a>',
    // homoglyphs / unicode en nombre de tag (no deberían ni parsear como tag válido, pero probamos)
    '<ѕcript>alert(1)</ѕcript>', // 'ѕ' cirílico U+0455 en vez de 's' latina
    '<a href="javascript﻿:alert(1)">click</a>', // BOM/zero-width dentro del esquema
    '<a href="java​script:alert(1)">click</a>', // zero-width space
    // input "medio saneado" (alguien ya intentó escapar mal)
    '<a href="j&#97;vascript:alert(1)">click</a>',
    '<<script>script>alert(1)<</script>/script>',
    '<img src="x" onerror  =  "alert(1)">', // espacios extra alrededor de =
    '<svg/onload=alert(1)>',
    '<details open ontoggle=alert(1)>',
    '<style>@import "javascript:alert(1)";</style>',
    // doble encoding de entidad
    '<a href="&amp;#106;avascript:alert(1)">click</a>'
];

for (const payload of XSS_PAYLOADS) {
    check(`XSS adversarial: ${JSON.stringify(payload).slice(0, 60)}...`, () => {
        const out = sanitize(payload);
        assertClean(out, payload);
    });
}

// Vector "polyglot" clásico (usado en muchos cheat-sheets de XSS) SIN ningún
// delimitador de tag ('<'/'>'). Al no contener tags, DOMPurify lo trata como
// texto plano y lo deja pasar TAL CUAL (no hay nada que sanear). Un check
// ingenuo de substring `on[a-z]+=` marca esto como "sospechoso" (falso
// positivo respecto a ejecutabilidad), así que lo verificamos de forma
// estructural: mientras el output no contenga NINGÚN '<' ni '>', es
// imposible que el navegador lo interprete como un tag/atributo real al
// insertarlo via dangerouslySetInnerHTML (que es como se renderiza en
// RegulationsView.js) — permanece como nodo de texto inerte.
check('polyglot "jaVasCript:...onerror=..." SIN tags queda como texto inerte (no forma un tag real)', () => {
    const payload = 'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */onerror=alert(1) )//';
    const out = sanitize(payload);
    assert(!out.includes('<') && !out.includes('>'), `el output ganó delimitadores de tag que no estaban en el input — riesgo real: ${out}`);
    // Documentado: el substring "onerror=alert(1)" SÍ sobrevive como texto
    // literal (DOMPurify no toca contenido de nodos de texto puros), pero
    // sin '<'/'>' nunca se convierte en un atributo HTML ejecutable.
});

// Confirmar postcondición sobre el CONJUNTO completo (no solo individualmente):
// concatenar todos los payloads en un solo documento y sanear de una vez.
check('lote completo de payloads XSS concatenados sale limpio', () => {
    const combined = XSS_PAYLOADS.join('\n');
    const out = sanitize(combined);
    assertClean(out, '[lote combinado]');
});

// Reglamento "legado" con la palabra <script> literal como TEXTO PLANO de un
// usuario (no marcado real). El pipeline 'plain' nunca pasa por DOMPurify —
// se renderiza vía plainTextToRegulationsHtml + React (texto), así que basta
// con confirmar que el escapado deja <script> como entidad inerte y que un
// grep de "forbidden patterns" tras un pase de decodificación NO encuentra
// el tag vivo.
check('texto plano legado con "<script>alert(1)</script>" literal se escapa como texto, no como marcado', () => {
    const userText = 'Prohibido usar <script>alert(1)</script> en el chat de carrera.';
    const html = plainTextToRegulationsHtml(userText);
    // Debe sobrevivir como entidades, nunca como un tag real navegable por el DOM
    assert(html.includes('&lt;script&gt;'), `no se escapó correctamente: ${html}`);
    assert(!/<script/i.test(html), `¡tag <script> real coló en el HTML "plain"!: ${html}`);
    // Si se le vuelve a pasar por el sanitizador de HTML (defensa en profundidad
    // por si algún día el pipeline 'plain' se re-usa como 'html' por error),
    // sigue sin ejecutar nada.
    const doubleSanitized = sanitize(html);
    assertClean(doubleSanitized, '[plain→sanitize defensa en profundidad]');
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Byte-size UTF-8 real vs .length
// ─────────────────────────────────────────────────────────────────────────

check('emoji de familia con ZWJ mide bytes UTF-8 reales, no .length (UTF-16 units)', () => {
    const family = '👨‍👩‍👧‍👦'; // hombre+ZWJ+mujer+ZWJ+niña+ZWJ+niño
    const bytes = regulationsByteSize(family);
    const expected = new TextEncoder().encode(family).length;
    assert(bytes === expected, `esperado ${expected}, obtenido ${bytes}`);
    assert(bytes !== family.length, `bytes (${bytes}) no debería coincidir con .length (${family.length}) — si coincide, sospechoso`);
});

check('bandera de país (2 code points regionales) mide bytes UTF-8 reales', () => {
    const flag = '🇪🇸'; // España: 2 "regional indicator" code points
    const bytes = regulationsByteSize(flag);
    const expected = new TextEncoder().encode(flag).length;
    assert(bytes === expected, `esperado ${expected}, obtenido ${bytes}`);
    assert(bytes === 8, `bandera de 2 regional indicators debería ser 8 bytes UTF-8, fue ${bytes}`);
});

check('carácter combinante (e + acento combinante) mide bytes UTF-8 reales', () => {
    const combining = 'é'; // 'e' + combining acute accent (NO precompuesto é)
    const bytes = regulationsByteSize(combining);
    const expected = new TextEncoder().encode(combining).length;
    assert(bytes === expected, `esperado ${expected}, obtenido ${bytes}`);
    assert(bytes === 3, `'e' (1 byte) + combining acute (2 bytes UTF-8) = 3, fue ${bytes}`);
});

check('límite EXACTO: string de exactamente REGULATIONS_MAX_BYTES bytes NO debe considerarse excedido', () => {
    const s = 'a'.repeat(REGULATIONS_MAX_BYTES);
    const bytes = regulationsByteSize(s);
    assert(bytes === REGULATIONS_MAX_BYTES, `preparación de test inválida: ${bytes} !== ${REGULATIONS_MAX_BYTES}`);
    const champ = new Championship({ name: 'X', shortName: 'X', season: '2026', regulations: s });
    const result = champ.validate();
    const hasSizeError = result.errors.some(e => e.includes('máximo de 100 KB'));
    assert(!hasSizeError, `un reglamento de EXACTAMENTE ${REGULATIONS_MAX_BYTES} bytes fue rechazado — el operador de comparación en Championship.validate() debe ser ">" no ">="`);
});

check('límite EXACTO + 1: string de REGULATIONS_MAX_BYTES + 1 bytes SÍ debe rechazarse', () => {
    const s = 'a'.repeat(REGULATIONS_MAX_BYTES + 1);
    const champ = new Championship({ name: 'X', shortName: 'X', season: '2026', regulations: s });
    const result = champ.validate();
    const hasSizeError = result.errors.some(e => e.includes('máximo de 100 KB'));
    assert(hasSizeError, `un reglamento de ${REGULATIONS_MAX_BYTES + 1} bytes (1 byte sobre el límite) NO fue rechazado`);
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Championship.js — regulationsFormat inference + roundtrip
// ─────────────────────────────────────────────────────────────────────────

check('new Championship({regulations: legacy}) sin regulationsFormat -> toFirestore() incluye la CLAVE regulationsFormat="plain"', () => {
    const champ = new Championship({ regulations: 'texto plano legacy sin formato' });
    const fs = champ.toFirestore();
    assert(Object.prototype.hasOwnProperty.call(fs, 'regulationsFormat'), 'toFirestore() no incluye la clave regulationsFormat en absoluto');
    assert(fs.regulationsFormat === 'plain', `esperado 'plain', obtenido ${JSON.stringify(fs.regulationsFormat)}`);
});

check('roundtrip fromFirestore -> toFirestore preserva regulationsFormat="html" sin degradar a "plain"', () => {
    const stored = { name: 'C', shortName: 'C', season: '2026', regulations: '<p>hola</p>', regulationsFormat: 'html' };
    const champ = Championship.fromFirestore('abc123', stored);
    assert(champ.regulationsFormat === 'html', `tras fromFirestore, esperado 'html', obtenido ${champ.regulationsFormat}`);
    const fs = champ.toFirestore();
    assert(fs.regulationsFormat === 'html', `tras toFirestore, degradó a ${JSON.stringify(fs.regulationsFormat)} en vez de preservar 'html'`);
});

check('roundtrip con regulationsFormat="plain" explícito se preserva (no se re-infiere distinto)', () => {
    const stored = { name: 'C', shortName: 'C', season: '2026', regulations: 'texto', regulationsFormat: 'plain' };
    const champ = Championship.fromFirestore('abc123', stored);
    const fs = champ.toFirestore();
    assert(fs.regulationsFormat === 'plain', `esperado 'plain', obtenido ${fs.regulationsFormat}`);
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Conversión legacy plain<->html — casos borde de reglamentos reales
// ─────────────────────────────────────────────────────────────────────────

check('línea que empieza con "1. Primera regla" no se transforma en sintaxis de lista', () => {
    const text = '1. Primera regla\n2. Segunda regla';
    const html = plainTextToRegulationsHtml(text);
    assert(!/<ol/i.test(html), `generó <ol> inesperadamente: ${html}`);
    assert(!/<li/i.test(html), `generó <li> inesperadamente: ${html}`);
    assert(html.includes('1. Primera regla'), `perdió el texto literal: ${html}`);
});

check('50+ saltos de línea consecutivos no genera explosión de párrafos vacíos ni truena', () => {
    const text = 'inicio' + '\n'.repeat(60) + 'fin';
    const html = plainTextToRegulationsHtml(text);
    // según la implementación: split por \n{2,} colapsa TODO el bloque de 60
    // saltos en un solo separador de párrafo -> exactamente 2 <p>
    const pCount = (html.match(/<p>/g) || []).length;
    assert(pCount <= 2, `esperado a lo sumo 2 <p> para un único separador masivo, obtuvo ${pCount}: ${html.slice(0, 200)}`);
    assert(html.includes('inicio') && html.includes('fin'), 'perdió contenido');
});

check('reglamento de exactamente 1 carácter no truena y produce HTML válido', () => {
    const html = plainTextToRegulationsHtml('x');
    assert(html === '<p>x</p>', `esperado '<p>x</p>', obtenido ${html}`);
});

check('reglamento que es solo emojis se preserva sin corromper', () => {
    const text = '🏁🏎️💨🔥';
    const html = plainTextToRegulationsHtml(text);
    assert(html.includes('🏁') && html.includes('🏎️') && html.includes('🔥'), `perdió emojis: ${html}`);
    const roundtrip = regulationsHtmlToPlainText(html);
    assert(roundtrip.includes('🏁'), `roundtrip perdió emoji: ${roundtrip}`);
});

check('URL pegada sin espacios no rompe el escapado de &', () => {
    const text = 'Consulta https://example.com/path?a=1&b=2&c=3 para más info';
    const html = plainTextToRegulationsHtml(text);
    assert(html.includes('&amp;b=2&amp;c=3'), `el "&" de la URL no se escapó correctamente: ${html}`);
    assert(!html.includes('&b=2') , `quedó un "&" sin escapar suelto: ${html}`);
});

// ─────────────────────────────────────────────────────────────────────────
// 5. regulationsFilename — nombres degenerados y colisiones
// ─────────────────────────────────────────────────────────────────────────

check('nombre de campeonato SOLO caracteres especiales "???" produce fallback razonable, no vacío ni solo guiones', () => {
    const filename = regulationsFilename({ name: '???' });
    assert(filename !== '.pdf', `filename vacío antes de la extensión: ${filename}`);
    assert(!/^reglamento-*\.pdf$/.test(filename) || filename === 'reglamento.pdf', `filename sospechoso: ${filename}`);
    assert(/^[a-z0-9.-]+\.pdf$/.test(filename), `filename con caracteres inesperados: ${filename}`);
});

check('nombre de campeonato SOLO caracteres especiales "///" produce fallback razonable', () => {
    const filename = regulationsFilename({ name: '///' });
    assert(/^[a-z0-9.-]+\.pdf$/.test(filename), `filename con caracteres inesperados: ${filename}`);
    assert(filename !== '.pdf', `filename vacío: ${filename}`);
    assert(!/^reglamento-*\.pdf$/.test(filename) || filename === 'reglamento.pdf', `filename sospechoso (slug vacío deja un guion colgante): ${filename}`);
});

check('colisión de slug: "Campeonato Ñ" vs "Campeonato N" — se documenta el comportamiento (no falla el test)', () => {
    const a = regulationsFilename({ name: 'Campeonato Ñ' });
    const b = regulationsFilename({ name: 'Campeonato N' });
    // No es un bug per se (el plan no garantiza unicidad), solo se registra.
    console.log(`   [info] "Campeonato Ñ" -> ${a} | "Campeonato N" -> ${b} | colisión: ${a === b}`);
    assert(typeof a === 'string' && typeof b === 'string', 'no debería lanzar');
});

// ─────────────────────────────────────────────────────────────────────────
// 6. buildRegulationsDocDefinition con datos hostiles
// ─────────────────────────────────────────────────────────────────────────

check('championship.name con HTML/caracteres de control no truena al construir el docDefinition', () => {
    const championship = { name: '<script>alert(1)</script>\x00\x01hostile', shortName: 'HOS' };
    const doc = buildRegulationsDocDefinition({ championship, bodyContent: [{ text: 'x' }], generatedAt: 'hoy' });
    assert(doc && doc.content, 'no se generó docDefinition');
    // pdfmake trata el texto como texto plano (no HTML), así que el string
    // crudo puede aparecer tal cual dentro del nodo -- lo importante es que
    // no lance excepción y produzca un `content` array.
});

check('startDate=undefined, endDate=undefined (ausentes) no truena ni genera "Invalid Date"', () => {
    const championship = { name: 'C' };
    const doc = buildRegulationsDocDefinition({ championship, bodyContent: [], generatedAt: 'hoy' });
    const serialized = JSON.stringify(doc);
    assert(!/Invalid Date/i.test(serialized), `contiene "Invalid Date": ${serialized.slice(0, 300)}`);
});

check('startDate=null, endDate=null (explícitos) no truena ni genera "Invalid Date" — distinto de undefined', () => {
    const championship = { name: 'C', startDate: null, endDate: null };
    const doc = buildRegulationsDocDefinition({ championship, bodyContent: [], generatedAt: 'hoy' });
    const serialized = JSON.stringify(doc);
    assert(!/Invalid Date/i.test(serialized), `contiene "Invalid Date": ${serialized.slice(0, 300)}`);
});

check('startDate ISO inválido ("not-a-date") no truena, no genera "Invalid Date" en el output', () => {
    const championship = { name: 'C', startDate: 'not-a-date', endDate: '2026-01-01' };
    const doc = buildRegulationsDocDefinition({ championship, bodyContent: [], generatedAt: 'hoy' });
    const serialized = JSON.stringify(doc);
    assert(!/Invalid Date/i.test(serialized), `contiene "Invalid Date": ${serialized.slice(0, 300)}`);
});

check('categories = [] (array vacío) no agrega bullet vacío en metaBits', () => {
    const championship = { name: 'C', categories: [] };
    const doc = buildRegulationsDocDefinition({ championship, bodyContent: [], generatedAt: 'hoy' });
    const serialized = JSON.stringify(doc);
    assert(!serialized.includes('  ·  ·'), `separador vacío sospechoso: ${serialized.slice(0, 300)}`);
});

check('categories = undefined (ausente) no truena', () => {
    const championship = { name: 'C' };
    const doc = buildRegulationsDocDefinition({ championship, bodyContent: [], generatedAt: 'hoy' });
    assert(doc, 'no se generó docDefinition');
});

check('org es objeto SIN la clave branding en absoluto (no branding:null) — no truena con "Cannot read property logoUrl of undefined"', () => {
    const championship = { name: 'C' };
    const org = { name: 'Mi Org' }; // sin `branding` en absoluto
    let threw = null;
    try {
        buildRegulationsDocDefinition({ championship, org, bodyContent: [], generatedAt: 'hoy', logos: { orgLogo: org?.branding?.logoUrl } });
    } catch (err) {
        threw = err;
    }
    assert(!threw, `lanzó excepción: ${threw && threw.message}`);
});

check('org=null y logos vacío (objeto default {}) no truena', () => {
    const championship = { name: 'C' };
    const doc = buildRegulationsDocDefinition({ championship, org: null, bodyContent: [], generatedAt: 'hoy' });
    assert(doc, 'no se generó docDefinition');
});

// ─────────────────────────────────────────────────────────────────────────
// 7. Championship.validate() — mensaje de KB y condicionalidad
// ─────────────────────────────────────────────────────────────────────────

check('validate() con 102401 bytes produce KB correcto (no NaN, no hardcodeado)', () => {
    const s = 'a'.repeat(REGULATIONS_MAX_BYTES + 1);
    const champ = new Championship({ name: 'X', shortName: 'X', season: '2026', regulations: s });
    const result = champ.validate();
    const sizeError = result.errors.find(e => e.includes('máximo de 100 KB'));
    assert(sizeError, 'no se generó el error de tamaño');
    assert(!sizeError.includes('NaN'), `mensaje contiene NaN: ${sizeError}`);
    const match = sizeError.match(/actual:\s*([\d.]+)\s*KB/);
    assert(match, `no se pudo extraer el valor de KB del mensaje: ${sizeError}`);
    const kb = parseFloat(match[1]);
    const expectedKb = parseFloat(((REGULATIONS_MAX_BYTES + 1) / 1024).toFixed(1));
    assert(Math.abs(kb - expectedKb) < 0.05, `KB reportado (${kb}) no coincide con el cálculo real (${expectedKb})`);
});

check('validate() con regulations vacío/null NO dispara validación de tamaño en absoluto', () => {
    const champEmpty = new Championship({ name: 'X', shortName: 'X', season: '2026', regulations: '' });
    const champNull = new Championship({ name: 'X', shortName: 'X', season: '2026', regulations: null });
    for (const champ of [champEmpty, champNull]) {
        const result = champ.validate();
        const hasSizeError = result.errors.some(e => e.includes('KB'));
        assert(!hasSizeError, `un reglamento vacío/null disparó la validación de tamaño: ${JSON.stringify(result.errors)}`);
    }
});

// ─────────────────────────────────────────────────────────────────────────
// Resumen
// ─────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.log('\n--- Fallos ---');
    for (const f of failures) {
        console.log(`❌ ${f.name}\n   ${f.error}`);
    }
    process.exit(1);
}
