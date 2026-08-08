/**
 * QA de saneo XSS para el reglamento de campeonato (RQ editor WYSIWYG).
 * Usa la CONFIGURACIÓN REAL de `src/app/utils/regulationsSanitize.js`
 * instanciada sobre `new JSDOM('').window` — no una réplica de la config.
 *
 * Uso: node scripts/test-regulations-sanitize-qa.mjs
 */
import { JSDOM } from 'jsdom';
import { createRegulationsSanitizer } from '../src/app/utils/regulationsSanitize.js';

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

const dom = new JSDOM('');
const { sanitize } = createRegulationsSanitizer(dom.window);

// ── Scripts y estilos ──
check('<script>alert(1)</script> eliminado', () => {
    const out = sanitize('<p>hola</p><script>alert(1)</script>');
    assert(!/<script/i.test(out), `sobrevivió script: ${out}`);
    assert(!/alert\(1\)/.test(out), `contenido del script sobrevivió: ${out}`);
});
check('<script src=...> eliminado', () => {
    const out = sanitize('<script src="https://evil.com/x.js"></script>');
    assert(!/<script/i.test(out), out);
});
check('<style> eliminado', () => {
    const out = sanitize('<style>body{display:none}</style><p>ok</p>');
    assert(!/<style/i.test(out), out);
});

// ── Atributos de evento ──
check('onclick eliminado', () => {
    const out = sanitize('<p onclick="alert(1)">hola</p>');
    assert(!/onclick/i.test(out), out);
});
check('onerror eliminado', () => {
    const out = sanitize('<p onerror="alert(1)">hola</p>');
    assert(!/onerror/i.test(out), out);
});
check('ONCLICK mayúsculas eliminado', () => {
    const out = sanitize('<p ONCLICK="alert(1)">hola</p>');
    assert(!/onclick/i.test(out), out);
});
check('<img src=x onerror=alert(1)> eliminado por completo (sin <img> en whitelist)', () => {
    const out = sanitize('<img src=x onerror=alert(1)>');
    assert(!/<img/i.test(out), out);
    assert(!/onerror/i.test(out), out);
});

// ── href peligrosos ──
check('href="javascript:alert(1)" no sobrevive', () => {
    const out = sanitize('<a href="javascript:alert(1)">click</a>');
    assert(!/javascript:/i.test(out), out);
});
check('href="JAVASCRIPT:alert(1)" (mayúsculas) no sobrevive', () => {
    const out = sanitize('<a href="JAVASCRIPT:alert(1)">click</a>');
    assert(!/javascript:/i.test(out), out);
});
check('href=" javascript:alert(1)" (espacio inicial) no sobrevive', () => {
    const out = sanitize('<a href=" javascript:alert(1)">click</a>');
    assert(!/javascript:/i.test(out), out);
});
check('href="data:text/html;base64,..." no sobrevive', () => {
    const out = sanitize('<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">click</a>');
    assert(!/data:/i.test(out), out);
});
check('href="vbscript:msgbox(1)" no sobrevive', () => {
    const out = sanitize('<a href="vbscript:msgbox(1)">click</a>');
    assert(!/vbscript:/i.test(out), out);
});

// ── Tags peligrosos completos ──
['iframe', 'object', 'embed', 'form', 'input', 'base', 'meta'].forEach(tag => {
    check(`<${tag}> eliminado`, () => {
        const out = sanitize(`<p>a</p><${tag} src="x"></${tag}><p>b</p>`);
        assert(!new RegExp(`<${tag}`, 'i').test(out), out);
    });
});

// ── mutation-XSS vía foreign content ──
check('<svg><script> eliminado', () => {
    const out = sanitize('<svg><script>alert(1)</script></svg>');
    assert(!/<script/i.test(out), out);
    assert(!/<svg/i.test(out), out);
});
check('<math><mtext><script> eliminado', () => {
    const out = sanitize('<math><mtext><script>alert(1)</script></mtext></math>');
    assert(!/<script/i.test(out), out);
    assert(!/<math/i.test(out), out);
});
check('marcado malformado noscript/title no produce onerror ejecutable', () => {
    const out = sanitize('<noscript><p title="</noscript><img src=x onerror=alert(1)>">x</p></noscript>');
    assert(!/onerror/i.test(out), out);
    assert(!/<img/i.test(out), out);
});

// ── Sin imágenes ni tablas ──
check('<img> eliminado', () => {
    const out = sanitize('<img src="https://example.com/a.png" alt="x">');
    assert(!/<img/i.test(out), out);
});
check('<table> eliminado', () => {
    const out = sanitize('<table><tr><td>x</td></tr></table>');
    assert(!/<table/i.test(out), out);
    assert(!/<td/i.test(out), out);
});

// ── style/class/id/data-* ──
check('style eliminado', () => {
    const out = sanitize('<p style="color:red">hola</p>');
    assert(!/style=/i.test(out), out);
});
check('class eliminado', () => {
    const out = sanitize('<p class="foo">hola</p>');
    assert(!/class=/i.test(out), out);
});
check('id eliminado', () => {
    const out = sanitize('<p id="foo">hola</p>');
    assert(!/id=/i.test(out), out);
});
check('data-* eliminado', () => {
    const out = sanitize('<p data-foo="bar">hola</p>');
    assert(!/data-foo/i.test(out), out);
});

// ── Positivos: no sobre-sanear ──
check('negrita/cursiva/subrayado sobreviven íntegros', () => {
    const out = sanitize('<p><strong>x</strong><em>y</em><u>z</u></p>');
    assert(out.includes('<strong>x</strong>'), out);
    assert(out.includes('<em>y</em>'), out);
    assert(out.includes('<u>z</u>'), out);
});
check('h3/h4 sobreviven', () => {
    const out = sanitize('<h3>Título</h3><h4>Subtítulo</h4>');
    assert(out.includes('<h3>Título</h3>'), out);
    assert(out.includes('<h4>Subtítulo</h4>'), out);
});
check('ul/li sobreviven', () => {
    const out = sanitize('<ul><li>uno</li><li>dos</li></ul>');
    assert(out.includes('<ul>') && out.includes('<li>uno</li>'), out);
});
check('ol/li sobreviven', () => {
    const out = sanitize('<ol><li>uno</li></ol>');
    assert(out.includes('<ol>') && out.includes('<li>uno</li>'), out);
});
check('<a href="https://..."> sobrevive', () => {
    const out = sanitize('<a href="https://example.com">click</a>');
    assert(/href="https:\/\/example\.com"/.test(out), out);
});

// ── Idempotencia ──
check('sanitize(sanitize(x)) === sanitize(x)', () => {
    const x = '<p onclick="a()"><strong>x</strong></p><script>a()</script><a href="https://ok.com">l</a>';
    const once = sanitize(x);
    const twice = sanitize(once);
    assert(once === twice, `once=${once}\ntwice=${twice}`);
});

// ── Postcondición sobre <a> ──
check('todo <a> de salida tiene target="_blank" y rel con noopener/noreferrer', () => {
    const out = sanitize('<a href="https://example.com">click</a>');
    assert(/target="_blank"/.test(out), out);
    assert(/rel="[^"]*noopener[^"]*"/.test(out), out);
    assert(/rel="[^"]*noreferrer[^"]*"/.test(out), out);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
