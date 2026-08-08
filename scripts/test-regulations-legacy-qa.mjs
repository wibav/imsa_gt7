/**
 * QA de las utilidades legacy↔editor del reglamento de campeonato
 * (src/app/utils/regulations.js) y su integración en el modelo Championship.
 *
 * Uso: node scripts/test-regulations-legacy-qa.mjs
 */
import {
    plainTextToRegulationsHtml,
    regulationsHtmlToPlainText,
    isRegulationsEmpty,
    normalizeRegulationsForSave,
    regulationsByteSize,
    regulationsFilename,
    REGULATIONS_MAX_BYTES
} from '../src/app/utils/regulations.js';
import { Championship } from '../src/app/models/Championship.js';

let passed = 0, failed = 0;
function check(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`❌ ${name}`);
        console.log(`   ${err.message}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
}
function assertEqual(actual, expected, msg) {
    if (actual !== expected) throw new Error(`${msg || 'assertEqual'}: esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`);
}

// ── plainTextToRegulationsHtml ──
check('salto simple \\n → <br>', () => {
    const out = plainTextToRegulationsHtml('línea 1\nlínea 2');
    assert(out.includes('línea 1<br>línea 2'), out);
});
check('doble salto \\n\\n → párrafos separados', () => {
    const out = plainTextToRegulationsHtml('párrafo 1\n\npárrafo 2');
    assert(out === '<p>párrafo 1</p><p>párrafo 2</p>', out);
});
check('sin duplicar saltos (\\n\\n\\n no genera párrafo vacío extra visible como <br><br>)', () => {
    const out = plainTextToRegulationsHtml('a\n\n\nb');
    assert(out.split('<p>').length === 3, out); // 2 párrafos → 2 aperturas <p> (split produce 3 con el prefijo vacío)
});
check('texto con <, >, &, " sale escapado UNA sola vez (nunca &amp;lt; ni &lt; visible en output final legible)', () => {
    const out = plainTextToRegulationsHtml('1 < 2 & "cita" > 0');
    assert(out.includes('&lt;'), out);
    assert(out.includes('&gt;'), out);
    assert(out.includes('&amp;'), out);
    assert(out.includes('&quot;'), out);
    assert(!out.includes('&amp;lt;'), `doble-escapado: ${out}`);
    assert(!out.includes('&amp;amp;'), `doble-escapado: ${out}`);
});

// ── Round-trip aproximado ──
check('regulationsHtmlToPlainText(plainTextToRegulationsHtml(t)) ≈ t', () => {
    const t = 'línea uno\nlínea dos\n\npárrafo dos';
    const roundTrip = regulationsHtmlToPlainText(plainTextToRegulationsHtml(t));
    assertEqual(roundTrip, t);
});

// ── isRegulationsEmpty ──
check('null → true', () => assert(isRegulationsEmpty(null, 'html') === true));
check("'' → true", () => assert(isRegulationsEmpty('', 'html') === true));
check("'   ' → true", () => assert(isRegulationsEmpty('   ', 'plain') === true));
check("'<p></p>' → true", () => assert(isRegulationsEmpty('<p></p>', 'html') === true));
check("'<p><br></p>' → true", () => assert(isRegulationsEmpty('<p><br></p>', 'html') === true));
check("'<p>&nbsp;</p>' → true", () => assert(isRegulationsEmpty('<p>&nbsp;</p>', 'html') === true));
check("'<p>a</p>' → false", () => assert(isRegulationsEmpty('<p>a</p>', 'html') === false));

// ── normalizeRegulationsForSave ──
check('vacío → {regulations:null, regulationsFormat:null}', () => {
    const out = normalizeRegulationsForSave({ html: '<p></p>', format: 'html' });
    assertEqual(out.regulations, null);
    assertEqual(out.regulationsFormat, null);
});
check('no vacío conserva html y format', () => {
    const out = normalizeRegulationsForSave({ html: '<p>hola</p>', format: 'html' });
    assertEqual(out.regulations, '<p>hola</p>');
    assertEqual(out.regulationsFormat, 'html');
});

// ── regulationsByteSize ──
check("'ñ' → 2 bytes", () => assertEqual(regulationsByteSize('ñ'), 2));
check("'€' → 3 bytes", () => assertEqual(regulationsByteSize('€'), 3));
check('un emoji → 4 bytes (demuestra que NO es String.length)', () => {
    const emoji = '🏁';
    assertEqual(regulationsByteSize(emoji), 4);
    assert(emoji.length !== 4, 'String.length de un emoji de 4 bytes UTF-8 no es 4 (es 2, surrogate pair)');
});

// ── regulationsFilename ──
check('acentos y caracteres inválidos de filesystem se normalizan', () => {
    const name = regulationsFilename({ name: 'Cañón / Gran Turismo: Élite?', season: '2026' });
    assert(!/[/\\:*?"<>|]/.test(name), name);
    assert(name.endsWith('.pdf'), name);
    assert(name === name.toLowerCase(), name);
});
check('emojis no aparecen en el filename', () => {
    const name = regulationsFilename({ name: '🏁 Copa GT7 🏆', season: '2026' });
    assert(!/[\u{1F300}-\u{1FAFF}]/u.test(name), name);
});
check('nombre de 300 chars produce salida ≤ 80 chars (incluye ".pdf")', () => {
    const longName = 'a'.repeat(300);
    const name = regulationsFilename({ name: longName, season: '2026' });
    assert(name.length <= 80, `length=${name.length}: ${name}`);
});
check('determinista (misma entrada → misma salida)', () => {
    const champ = { name: 'IMSA GT7', shortName: 'IMSA', season: '2026' };
    assertEqual(regulationsFilename(champ), regulationsFilename(champ));
});

// ── Championship model ──
check("new Championship({regulations:'texto'}) → regulationsFormat === 'plain'", () => {
    const c = new Championship({ regulations: 'texto plano legacy' });
    assertEqual(c.regulationsFormat, 'plain');
});
check("new Championship({regulations:'<p>x</p>', regulationsFormat:'html'}) → 'html'", () => {
    const c = new Championship({ regulations: '<p>x</p>', regulationsFormat: 'html' });
    assertEqual(c.regulationsFormat, 'html');
});
check('new Championship({}) sin regulations → regulationsFormat null', () => {
    const c = new Championship({});
    assertEqual(c.regulationsFormat, null);
});
check("toFirestore() incluye la clave 'regulationsFormat' (regresión silenciosa más probable)", () => {
    const c = new Championship({ name: 'X', shortName: 'X', season: '2026', regulations: 'texto' });
    const data = c.toFirestore();
    assert(Object.prototype.hasOwnProperty.call(data, 'regulationsFormat'), JSON.stringify(Object.keys(data)));
    assertEqual(data.regulationsFormat, 'plain');
});

// ── Championship.validate() límite de tamaño ──
check('validate() rechaza 101KB con mensaje legible', () => {
    const bigHtml = '<p>' + 'a'.repeat(101 * 1024) + '</p>';
    const c = new Championship({ name: 'X', shortName: 'X', season: '2026', regulations: bigHtml, regulationsFormat: 'html' });
    const { isValid, errors } = c.validate();
    assert(isValid === false, 'debería ser inválido');
    assert(errors.some(e => /100 KB/.test(e)), JSON.stringify(errors));
});
check('validate() acepta 99KB', () => {
    const okHtml = '<p>' + 'a'.repeat(99 * 1024) + '</p>';
    assert(regulationsByteSize(okHtml) < REGULATIONS_MAX_BYTES, 'fixture debe estar bajo el límite');
    const c = new Championship({ name: 'X', shortName: 'X', season: '2026', regulations: okHtml, regulationsFormat: 'html' });
    const { isValid, errors } = c.validate();
    assert(isValid === true, JSON.stringify(errors));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
