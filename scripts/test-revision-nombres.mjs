// node scripts/test-revision-nombres.mjs — revisión de nombres de inscritos
import assert from 'node:assert/strict';
import { nombreSinFallosDeTecleo, revisarNombreInscrito } from '../src/app/utils/pilotIdentityMatcher.js';

const casos = [
    ['ERG_JonySport.', 'ERG_JonySport'],
    ['SFRT_ Merenguay', 'SFRT_Merenguay'],
    ['D4r_ EL POLEMAN', 'D4r_EL POLEMAN'],
    ['@InmensaMinoria', 'InmensaMinoria'],
    ['  Aam   Chak ', 'Aam Chak'],
    ['Jimmy_-81-_', 'Jimmy_-81-_'],
    ['J.Roiz', 'J.Roiz'],
    ['LTR - elGallu', 'LTR-elGallu'],
];
for (const [entrada, esperado] of casos) assert.equal(nombreSinFallosDeTecleo(entrada), esperado, entrada);

const conocidos = ['HPR_FRANCIS125', 'Lokoracing', 'LTR_Urzais', 'Erik'];
let r = revisarNombreInscrito({ gt7Id: 'Francis 125' }, conocidos);
assert.equal(r.length, 1); assert.deepEqual(r[0].parecidos, ['HPR_FRANCIS125']); assert.equal(r[0].limpio, null);
// Solo cambian mayúsculas: ya se resuelve sin distinguirlas, no se avisa
assert.deepEqual(revisarNombreInscrito({ gt7Id: 'LTR_urzais' }, conocidos), []);
// Nombre limpio y nuevo: nada que revisar
assert.deepEqual(revisarNombreInscrito({ gt7Id: 'patarace', psnId: 'patarace' }, conocidos), []);
// Fallo de tecleo en el PSN
r = revisarNombreInscrito({ gt7Id: 'ERG_JonySport', psnId: 'ERG_JonySport.' }, conocidos);
assert.equal(r.length, 1); assert.equal(r[0].campo, 'psnId'); assert.equal(r[0].limpio, 'ERG_JonySport');
// «Erik» no salta con «Perikolo94»
assert.deepEqual(revisarNombreInscrito({ gt7Id: 'Perikolo94' }, conocidos), []);
// Se parece a su propio PSN: no es otro piloto
assert.deepEqual(revisarNombreInscrito({ gt7Id: 'MGR-LOKORACING', psnId: 'lokoracing' }, conocidos), []);
console.log('✅ revisión de nombres: todo OK');
