/**
 * Análisis estático de ShareButton.js
 * No podemos ejecutar código React sin infraestructura de testing,
 * pero podemos verificar lógica y casos borde
 */

const fs = require('fs');
const path = require('path');

const shareButtonPath = path.join(__dirname, 'src/app/components/ShareButton.js');
const shareButtonCode = fs.readFileSync(shareButtonPath, 'utf-8');

console.log('Análisis estático de ShareButton.js:\n');

const issues = [];

// Issue 1: Verificar que props sean validadas
if (!shareButtonCode.includes('if (!type || !id)')) {
    issues.push({
        severity: 'LOW',
        issue: 'Props no validadas antes de uso',
        line: 'N/A'
    });
} else {
    console.log('✅ Props (type, id) validadas correctamente con early return');
}

// Issue 2: Verificar manejo de navigator.share
if (!shareButtonCode.includes('if (navigator.share)')) {
    issues.push({
        severity: 'MEDIUM',
        issue: 'No usa Web Share API cuando está disponible',
        line: 'N/A'
    });
} else {
    console.log('✅ Web Share API detectada y usada cuando disponible');
}

// Issue 3: Verificar fallback a clipboard
if (!shareButtonCode.includes('navigator.clipboard.writeText')) {
    issues.push({
        severity: 'HIGH',
        issue: 'No hay fallback a clipboard API',
        line: 'N/A'
    });
} else {
    console.log('✅ Fallback a clipboard API implementado');
}

// Issue 4: Verificar manejo de errores
if (!shareButtonCode.includes('try') && !shareButtonCode.includes('catch')) {
    issues.push({
        severity: 'MEDIUM',
        issue: 'No hay try-catch para manejar errores de compartir',
        line: 'N/A'
    });
} else {
    console.log('✅ Try-catch implementado para manejo de errores');
}

// Issue 5: Verificar feedback visual
if (!shareButtonCode.includes('setCopied')) {
    issues.push({
        severity: 'LOW',
        issue: 'No hay feedback visual al usuario',
        line: 'N/A'
    });
} else {
    console.log('✅ Feedback visual implementado (setCopied)');
}

// Issue 6: Verificar timeout para resetear feedback
if (!shareButtonCode.includes('setTimeout')) {
    issues.push({
        severity: 'LOW',
        issue: 'Feedback no se resetea automáticamente',
        line: 'N/A'
    });
} else {
    console.log('✅ Timeout para resetear feedback implementado');
}

// Issue 7: Verificar construcción de URL
const urlPattern = /shareUrl\s*=\s*`\${BASE_URL}\/share\/\${type}\/\${id}\/`/;
if (!urlPattern.test(shareButtonCode)) {
    issues.push({
        severity: 'MEDIUM',
        issue: 'Construcción de URL no coincide con el patrón esperado',
        line: shareButtonCode.split('\n').findIndex(l => l.includes('shareUrl')) + 1
    });
} else {
    console.log('✅ URL de share construida correctamente');
}

// Issue 8: BASE_URL hardcodeada
if (shareButtonCode.includes("const BASE_URL = 'https://imsa.trenkit.com'")) {
    console.log('⚠️  BASE_URL hardcodeada (no issue, pero no configurable para otros ambientes)');
} else {
    issues.push({
        severity: 'LOW',
        issue: 'BASE_URL no encontrada o no hardcodeada',
        line: 'N/A'
    });
}

// Issue 9: Verificar que sea componente cliente
if (!shareButtonCode.includes('"use client"')) {
    issues.push({
        severity: 'HIGH',
        issue: 'Falta directiva "use client" para usar hooks de React',
        line: 1
    });
} else {
    console.log('✅ Directiva "use client" presente');
}

// Issue 10: Verificar imports necesarios
const requiredImports = ['useState'];
requiredImports.forEach(imp => {
    if (!shareButtonCode.includes(imp)) {
        issues.push({
            severity: 'HIGH',
            issue: `Falta import: ${imp}`,
            line: 'imports'
        });
    } else {
        console.log(`✅ Import ${imp} presente`);
    }
});

console.log('\n');

// Casos borde que NO se manejan explícitamente (gaps de cobertura)
console.log('🔍 CASOS BORDE NO VERIFICABLES SIN TESTING FRAMEWORK:');
console.log('  - navigator.clipboard no disponible (HTTP sin HTTPS)');
console.log('  - Permisos de clipboard denegados');
console.log('  - navigator.share disponible pero falla');
console.log('  - Timeout de setState después de unmount del componente');
console.log('  - URL demasiado larga para share API');
console.log('  - type o id contienen caracteres especiales que rompen la URL');

console.log('\n');

if (issues.length > 0) {
    console.log('🐛 ISSUES ENCONTRADOS:');
    issues.forEach(issue => {
        console.log(`  [${issue.severity}] ${issue.issue} (línea: ${issue.line})`);
    });
    process.exit(1);
} else {
    console.log('✅ ShareButton.js pasa análisis estático sin issues críticos');
    process.exit(0);
}
