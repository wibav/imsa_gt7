/*
 * Un piloto con identidad fusionada debe salir en la clasificación de su
 * sala aunque sus puntos estén con un GT7 ID que la identidad no conoce
 * (Desafío del Asfalto, nov. 2026: «PRN_LimonetiMlg» con ele frente a
 * «PRN_LimonetiMIg» con i mayúscula).
 *
 *   node scripts/test-identidad-inscripcion.mjs
 */
import assert from 'node:assert/strict';
import { applyPilotIdentities } from '../src/app/utils/championshipUtils.js';
import {
    ampliarConInscripciones,
    aplicarIdentidadesACampeonato,
    aplicarIdentidadesAPistas,
    aplicarIdentidadesADivisiones,
} from '../src/app/utils/pilotIdentityApply.js';
import { calculateAdvancedStandings } from '../src/app/utils/standingsCalculator.js';

const identidades = [{ canonical: 'PRN_LimonetiMIg', aliases: ['Limoneti32mlg', 'Limoneti'] }];
const championship = {
    id: 'c1',
    registrations: [
        { id: 'r1', gt7Id: 'PRN_LimonetiMlg', psnId: 'Limoneti32mlg', status: 'approved' },
        { id: 'r2', gt7Id: 'Erik', psnId: 'ErikErikjaki', status: 'approved' },
    ],
};
const tracks = [{ id: 't1', round: 1, name: 'Montmeló', points: { PRN_LimonetiMlg: 16, Erik: 20 } }];
const divisions = [{ id: 'd1', name: 'Gladiadores', drivers: ['Limoneti32mlg', 'ErikErikjaki'] }];

const clasificacion = (mapa) => {
    const c = aplicarIdentidadesACampeonato(championship, mapa);
    const t = aplicarIdentidadesAPistas(tracks, mapa);
    const [d] = aplicarIdentidadesADivisiones(divisions, mapa);
    return calculateAdvancedStandings(c, [], t, [], { divisionDrivers: d.drivers }).driverStandings
        .map(s => `${s.name}:${s.totalPoints}`);
};

const base = applyPilotIdentities({}, identidades);
assert.ok(!clasificacion(base).includes('PRN_LimonetiMIg:16'), 'el caso de partida debe reproducir el fallo');

const ampliado = ampliarConInscripciones(base, championship.registrations);
const filas = clasificacion(ampliado);
assert.ok(filas.includes('PRN_LimonetiMIg:16'), `falta el piloto fusionado: ${filas.join(', ')}`);
assert.ok(filas.includes('Erik:20'));
assert.equal(filas.length, 2, `filas duplicadas: ${filas.join(', ')}`);

// Sin identidad que cubra la inscripción, el mapa no cambia
assert.equal(ampliarConInscripciones(base, [{ gt7Id: 'A', psnId: 'B' }]), base);

// Inscripción cuyos nombres llevan a identidades distintas: no se toca
const dos = applyPilotIdentities({}, [{ canonical: 'X', aliases: ['a'] }, { canonical: 'Y', aliases: ['b'] }]);
assert.equal(ampliarConInscripciones(dos, [{ gt7Id: 'a', psnId: 'b', name: 'c' }]), dos);

console.log('✅ identidad + inscripción: todo OK');
