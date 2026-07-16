/**
 * Test de las Firestore Security Rules (firestore.rules) contra el emulador.
 *
 * Uso: firebase emulators:exec --only firestore "node scripts/test-firestore-rules.mjs"
 *
 * No requiere credenciales de producción — corre 100% contra el emulador local.
 * Ver: Notas/Proyectos/GT7 Championships/03-PLAN-PRUEBAS-REGRESION.md (F)
 */
import { readFileSync } from 'fs';
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
} from '@firebase/rules-unit-testing';

const PROJECT_ID = 'demo-rules-test';

let passed = 0;
let failed = 0;

async function check(name, fn) {
    try {
        await fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`❌ ${name}`);
        console.log(`   ${err.message}`);
        failed++;
    }
}

async function main() {
    const testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: readFileSync('firestore.rules', 'utf8'),
            host: '127.0.0.1',
            port: 8080,
        },
    });

    // Sembrar datos base (sin pasar por rules, como admin) para tener algo que leer/actualizar
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('championships/champ1').set({
            name: 'Test Championship',
            categories: ['Gr1'],
            settings: { pointsSystem: {} },
            drivers: [],
            registrations: [],
        });
        await db.doc('events/event1').set({
            title: 'Test Event',
            waitlistCount: 0,
            updatedAt: 'x',
            maxParticipants: 2,
        });
        await db.doc('userRoles/admin__at__test_com').set({ email: 'admin@test.com', role: 'admin' });
        await db.doc('organizations/gt7-esp').set({
            name: 'GT7 ESP',
            slug: 'gt7-esp',
            reglamento: { sections: [{ id: 'conducta', title: 'Conducta' }] },
        });
    });

    const anon = testEnv.unauthenticatedContext().firestore();
    const noClaim = testEnv.authenticatedContext('user1').firestore();
    const admin = testEnv.authenticatedContext('adminUser', { admin: true }).firestore();
    const comisario = testEnv.authenticatedContext('comisarioUser', { comisario: true }).firestore();

    // ── championships ──
    await check('Anónimo puede LEER championships', () =>
        assertSucceeds(anon.doc('championships/champ1').get()));

    await check('Anónimo NO puede crear un championship', () =>
        assertFails(anon.doc('championships/champ2').set({ name: 'Hack' })));

    await check('Anónimo puede actualizar SOLO el campo registrations (inscripción pública)', () =>
        assertSucceeds(anon.doc('championships/champ1').update({ registrations: [{ gt7Id: 'x' }] })));

    await check('Anónimo NO puede tocar registrations + otro campo a la vez', () =>
        assertFails(anon.doc('championships/champ1').update({
            registrations: [{ gt7Id: 'y' }],
            drivers: [{ name: 'hack' }],
        })));

    await check('Admin puede actualizar cualquier campo de championships', () =>
        assertSucceeds(admin.doc('championships/champ1').update({ name: 'Actualizado por admin' })));

    await check('Comisario (sin admin) NO puede editar campos generales del championship', () =>
        assertFails(comisario.doc('championships/champ1').update({ name: 'Hack comisario' })));

    await check('Usuario sin claim NO puede editar championships', () =>
        assertFails(noClaim.doc('championships/champ1').update({ name: 'Hack user' })));

    // ── penalties / claims (subcolecciones) ──
    await check('Comisario puede crear una sanción (penalties)', () =>
        assertSucceeds(comisario.doc('championships/champ1/penalties/p1').set({ driver: 'x', points: 5 })));

    await check('Admin puede crear una reclamación (claims)', () =>
        assertSucceeds(admin.doc('championships/champ1/claims/c1').set({ status: 'pending' })));

    await check('Usuario sin claim NO puede crear una sanción', () =>
        assertFails(noClaim.doc('championships/champ1/penalties/p2').set({ driver: 'y' })));

    // ── teams / tracks subcolecciones ──
    await check('Anónimo NO puede escribir en championships/{id}/teams', () =>
        assertFails(anon.doc('championships/champ1/teams/t1').set({ name: 'Equipo Hack' })));

    await check('Admin puede escribir en championships/{id}/teams', () =>
        assertSucceeds(admin.doc('championships/champ1/teams/t1').set({ name: 'Equipo OK' })));

    // ── events ──
    await check('Anónimo puede LEER events', () =>
        assertSucceeds(anon.doc('events/event1').get()));

    await check('Anónimo puede crear un participante (inscripción pública a evento)', () =>
        assertSucceeds(anon.doc('events/event1/participants/part1').set({ gt7Id: 'piloto1' })));

    await check('Anónimo puede actualizar SOLO waitlistCount/updatedAt en el evento', () =>
        assertSucceeds(anon.doc('events/event1').update({ waitlistCount: 1, updatedAt: 'y' })));

    await check('Anónimo NO puede tocar otro campo del evento junto a waitlistCount', () =>
        assertFails(anon.doc('events/event1').update({ waitlistCount: 2, maxParticipants: 999 })));

    await check('Anónimo NO puede eliminar un evento', () =>
        assertFails(anon.doc('events/event1').delete()));

    // ── teams / tracks (catálogos globales raíz) ──
    await check('Anónimo puede LEER el catálogo global de tracks', () =>
        assertSucceeds(anon.doc('tracks/t1').get()));

    await check('Anónimo NO puede escribir en el catálogo global de tracks', () =>
        assertFails(anon.doc('tracks/t1').set({ name: 'Hack' })));

    await check('Admin puede escribir en el catálogo global de tracks', () =>
        assertSucceeds(admin.doc('tracks/t1').set({ name: 'Spa' })));

    // ── userRoles ──
    await check('Admin puede LEER userRoles', () =>
        assertSucceeds(admin.doc('userRoles/admin__at__test_com').get()));

    await check('Usuario sin claim NO puede LEER userRoles', () =>
        assertFails(noClaim.doc('userRoles/admin__at__test_com').get()));

    await check('NADIE puede escribir userRoles desde el cliente (ni admin)', () =>
        assertFails(admin.doc('userRoles/otro').set({ role: 'admin' })));

    // ── organizations (reglamento/branding por org, Fase 1) ──
    await check('Anónimo puede LEER una organización (branding/reglamento públicos)', () =>
        assertSucceeds(anon.doc('organizations/gt7-esp').get()));

    await check('Anónimo NO puede escribir el reglamento de una organización', () =>
        assertFails(anon.doc('organizations/gt7-esp').update({ reglamento: { sections: [] } })));

    await check('Admin puede escribir el reglamento de una organización', () =>
        assertSucceeds(admin.doc('organizations/gt7-esp').update({ reglamento: { sections: [] } })));

    // ── catch-all ──
    await check('Colección no declarada: lectura denegada por defecto', () =>
        assertFails(anon.doc('coleccionInventada/x').get()));

    await testEnv.cleanup();

    console.log(`\n${passed} pasaron, ${failed} fallaron`);
    if (failed > 0) process.exit(1);
}

main().catch(err => {
    console.error('Error ejecutando tests:', err);
    process.exit(1);
});
