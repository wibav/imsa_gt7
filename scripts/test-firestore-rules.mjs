/**
 * Test de las Firestore Security Rules (firestore.rules) contra el emulador.
 * Fase 2: roles org-scoped ({ orgs: { [orgId]: role } }, platformOwner).
 *
 * Uso: firebase emulators:exec --only firestore "node scripts/test-firestore-rules.mjs"
 *
 * No requiere credenciales de producción — corre 100% contra el emulador local.
 * Ver: Notas/Proyectos/GT7 Championships/03-PLAN-PRUEBAS-REGRESION.md (F, G)
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

    // Sembrar datos base (sin pasar por rules, como admin) — dos
    // organizaciones distintas para probar aislamiento real.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('championships/champ1').set({
            orgId: 'gt7-esp',
            name: 'Test Championship GT7 ESP',
            categories: ['Gr1'],
            settings: { pointsSystem: {} },
            drivers: [],
            registrations: [],
        });
        await db.doc('championships/champOtraOrg').set({
            orgId: 'otra-org',
            name: 'Test Championship Otra Org',
            categories: ['Gr3'],
            settings: { pointsSystem: {} },
            drivers: [],
            registrations: [],
        });
        await db.doc('championships/champWithDrivers').set({
            orgId: 'gt7-esp',
            name: 'Test Championship con drivers',
            categories: ['Gr1'],
            settings: { pointsSystem: {} },
            drivers: [{ name: 'piloto-existente' }],
            registrations: [{ gt7Id: 'existente' }],
        });
        await db.doc('events/event1').set({
            orgId: 'gt7-esp',
            title: 'Test Event',
            waitlistCount: 0,
            updatedAt: 'x',
            maxParticipants: 2,
        });
        await db.doc('teams/team1').set({ orgId: 'gt7-esp', name: 'Equipo Semilla' });
        await db.doc('organizations/gt7-esp').set({
            name: 'GT7 ESP',
            slug: 'gt7-esp',
            billingExempt: true,
            reglamento: { sections: [{ id: 'conducta', title: 'Conducta' }] },
        });
        await db.doc('organizations/otra-org').set({ name: 'Otra Org', slug: 'otra-org' });
        await db.doc('memberships/uidComisario_gt7-esp').set({
            uid: 'uidComisario', orgId: 'gt7-esp', role: 'comisario', email: 'c@test.com',
        });

        // Fixtures para asignación de comisarios por campeonato (ADR-009).
        // champ1 se deja SIN el campo comisarioUids a propósito — es el
        // fixture legacy que prueba que "campo ausente" sigue permitiendo a
        // cualquier comisario de la org (comportamiento pre-ADR-009).
        await db.doc('championships/champAsignado').set({
            orgId: 'gt7-esp', name: 'Champ con comisario asignado', categories: ['Gr1'],
            settings: { pointsSystem: {} }, drivers: [], registrations: [],
            // uidComisarioOtraOrg está en la lista a propósito — prueba que
            // la asignación NO basta por sí sola, sigue exigiendo
            // isOrgComisario(org) (ver test de aislamiento cross-org).
            comisarioUids: ['uidComisario', 'uidComisarioOtraOrg'],
        });
        await db.doc('championships/champSinComisarios').set({
            orgId: 'gt7-esp', name: 'Champ sin comisarios (lista vacía)', categories: ['Gr1'],
            settings: { pointsSystem: {} }, drivers: [], registrations: [],
            comisarioUids: [],
        });
        await db.doc('championships/champAsignado/claims/claimAsignado').set({ status: 'pending' });
        await db.doc('championships/champSinComisarios/claims/claimSinComisarios').set({ status: 'pending' });

        // Orgs para probar límites de plan (SPEC-6 / ADR-007 — lotes prepagados).
        await db.doc('organizations/free-org-used').set({ name: 'Free Usado', slug: 'free-org-used', plan: 'free', championshipCredits: 0 });
        await db.doc('organizations/free-org-fresh').set({ name: 'Free Sin Usar', slug: 'free-org-fresh', plan: 'free', championshipCredits: 1 });
        await db.doc('organizations/limited-org').set({ name: 'Org Limitada', slug: 'limited-org', plan: 'pro', limits: { maxDrivers: 2 } });
        await db.doc('championships/champLimited').set({
            orgId: 'limited-org', name: 'Champ Limitado', categories: ['Gr1'],
            settings: { pointsSystem: {} }, drivers: [], registrations: [],
        });
        await db.doc('events/eventLimited').set({
            orgId: 'limited-org', title: 'Evento Limitado', waitlistCount: 0, updatedAt: 'x', participantsCount: 2,
        });

        // Fixtures para alegaciones (appeals, incidencia 3 / CA-3.18).
        // champAppeals tiene allowAppeals:true; champ1 (arriba) no tiene
        // penaltiesConfig en absoluto → allowAppeals por defecto false, se
        // reutiliza para probar el gate de la feature apagada.
        await db.doc('championships/champAppeals').set({
            orgId: 'gt7-esp', name: 'Champ con alegaciones activas', categories: ['Gr1'],
            settings: { pointsSystem: {} }, drivers: [], registrations: [],
            penaltiesConfig: { enabled: true, allowAppeals: true, appealWindowHours: 48 },
        });
        await db.doc('championships/champAppeals/appeals/appealPending').set({
            status: 'pending', claimId: 'claim1', appellantName: 'Piloto X', reason: 'Motivo de prueba suficientemente largo',
        });
    });

    const anon = testEnv.unauthenticatedContext().firestore();
    const noClaim = testEnv.authenticatedContext('user1').firestore();
    // Roles org-scoped para GT7 ESP:
    const dirLiga = testEnv.authenticatedContext('dirLigaUser', { orgs: { 'gt7-esp': 'director_liga' } }).firestore();
    const organizador = testEnv.authenticatedContext('organizadorUser', { orgs: { 'gt7-esp': 'organizador' } }).firestore();
    const comisario = testEnv.authenticatedContext('uidComisario', { orgs: { 'gt7-esp': 'comisario' } }).firestore();
    // Segundo comisario de la MISMA org, pero no asignado a champAsignado —
    // para probar que la asignación por campeonato (ADR-009) sí discrimina
    // entre comisarios de una misma organización.
    const comisario2 = testEnv.authenticatedContext('uidComisario2', { orgs: { 'gt7-esp': 'comisario' } }).firestore();
    // Comisario de OTRA organización cuyo uid se cuela (a mano, maliciosamente)
    // dentro de comisarioUids de un campeonato de gt7-esp — la asignación NO
    // debe ser capaz de saltarse el aislamiento entre organizaciones.
    const comisarioOtraOrgColado = testEnv.authenticatedContext('uidComisarioOtraOrg', { orgs: { 'otra-org': 'comisario' } }).firestore();
    // Un admin de OTRA organización — no debe poder tocar nada de gt7-esp.
    const dirLigaOtraOrg = testEnv.authenticatedContext('dirLigaOtraOrgUser', { orgs: { 'otra-org': 'director_liga' } }).firestore();
    // Roles para probar límites de plan (SPEC-6).
    const dirLigaFreeUsed = testEnv.authenticatedContext('dirLigaFreeUsedUser', { orgs: { 'free-org-used': 'director_liga' } }).firestore();
    const dirLigaFreeFresh = testEnv.authenticatedContext('dirLigaFreeFreshUser', { orgs: { 'free-org-fresh': 'director_liga' } }).firestore();
    const dirLigaLimited = testEnv.authenticatedContext('dirLigaLimitedUser', { orgs: { 'limited-org': 'director_liga' } }).firestore();
    const platformOwner = testEnv.authenticatedContext('platformOwnerUser', { platformOwner: true }).firestore();

    // ── championships (org-scoped) ──
    await check('Anónimo puede LEER championships', () =>
        assertSucceeds(anon.doc('championships/champ1').get()));

    await check('Anónimo NO puede crear un championship', () =>
        assertFails(anon.doc('championships/champ2').set({ orgId: 'gt7-esp', name: 'Hack' })));

    await check('Anónimo puede actualizar SOLO el campo registrations (inscripción pública)', () =>
        assertSucceeds(anon.doc('championships/champ1').update({ registrations: [{ gt7Id: 'x' }] })));

    await check('Anónimo puede actualizar registrations + drivers juntos (auto-aprobación)', () =>
        assertSucceeds(anon.doc('championships/champ1').update({
            registrations: [{ gt7Id: 'y' }],
            drivers: [{ name: 'piloto-nuevo' }],
        })));

    await check('Anónimo NO puede reducir el tamaño de drivers (no puede vaciar el roster)', () =>
        assertFails(anon.doc('championships/champWithDrivers').update({
            registrations: [],
            drivers: [],
        })));

    await check('Anónimo NO puede tocar registrations + un campo no permitido a la vez', () =>
        assertFails(anon.doc('championships/champ1').update({
            registrations: [{ gt7Id: 'z' }],
            name: 'Hack',
        })));

    await check('director_liga de GT7 ESP puede actualizar campeonatos de GT7 ESP', () =>
        assertSucceeds(dirLiga.doc('championships/champ1').update({ name: 'Actualizado' })));

    await check('organizador de GT7 ESP puede actualizar campeonatos de GT7 ESP', () =>
        assertSucceeds(organizador.doc('championships/champ1').update({ name: 'Actualizado 2' })));

    await check('comisario (sin director_liga/organizador) NO puede editar campos generales', () =>
        assertFails(comisario.doc('championships/champ1').update({ name: 'Hack comisario' })));

    await check('Usuario sin claim NO puede editar championships', () =>
        assertFails(noClaim.doc('championships/champ1').update({ name: 'Hack user' })));

    await check('director_liga NO puede crear un championship con orgId de otra organización', () =>
        assertFails(dirLiga.doc('championships/champWrongOrg').set({ orgId: 'otra-org', name: 'X' })));

    await check('director_liga NO puede reasignar el orgId de un championship existente', () =>
        assertFails(dirLiga.doc('championships/champ1').update({ orgId: 'otra-org' })));

    // ── AISLAMIENTO REAL ENTRE ORGANIZACIONES (el caso que motivó Fase 2) ──
    await check('director_liga de OTRA organización NO puede editar campeonatos de GT7 ESP', () =>
        assertFails(dirLigaOtraOrg.doc('championships/champ1').update({ name: 'Hack cross-org' })));

    await check('director_liga de GT7 ESP NO puede editar campeonatos de OTRA organización', () =>
        assertFails(dirLiga.doc('championships/champOtraOrg').update({ name: 'Hack cross-org 2' })));

    await check('director_liga de OTRA organización SÍ puede editar sus propios campeonatos', () =>
        assertSucceeds(dirLigaOtraOrg.doc('championships/champOtraOrg').update({ name: 'Editado por su dueño' })));

    // ── penalties / claims (subcolecciones, heredan orgId del padre) ──
    await check('comisario de GT7 ESP puede crear una sanción en un campeonato de GT7 ESP', () =>
        assertSucceeds(comisario.doc('championships/champ1/penalties/p1').set({ driver: 'x', points: 5 })));

    await check('director_liga de GT7 ESP puede crear una reclamación en GT7 ESP', () =>
        assertSucceeds(dirLiga.doc('championships/champ1/claims/c1').set({ status: 'pending' })));

    await check('Anónimo puede crear una reclamación (payload real de ClaimForm/Claim.toFirestore, con resolvedBy/resolution/penaltyId presentes pero vacíos)', () =>
        assertSucceeds(anon.doc('championships/champ1/claims/c2').set({
            reporterName: 'x', reporterPsnId: '', accusedNames: ['y'], trackId: 't1', trackName: 'Spa',
            round: 1, lap: '', minute: '', description: 'toque en curva 3', evidence: [],
            status: 'pending', resolution: '', penaltyId: null, resolvedBy: '', resolvedAt: null,
        })));

    await check('Anónimo NO puede crear una reclamación ya marcada como resuelta', () =>
        assertFails(anon.doc('championships/champ1/claims/c3').set({
            reporterName: 'x', accusedNames: ['y'], description: 'z', status: 'resolved',
        })));

    await check('Anónimo NO puede crear una reclamación con penaltyId ya asignado', () =>
        assertFails(anon.doc('championships/champ1/claims/c4').set({
            reporterName: 'x', accusedNames: ['y'], description: 'z', status: 'pending', penaltyId: 'p1',
        })));

    await check('Anónimo NO puede editar/resolver una reclamación ajena', () =>
        assertFails(anon.doc('championships/champ1/claims/c1').update({ status: 'resolved' })));

    await check('comisario de GT7 ESP puede resolver una reclamación', () =>
        assertSucceeds(comisario.doc('championships/champ1/claims/c1').update({ status: 'resolved', resolvedBy: 'uidComisario' })));

    await check('Usuario sin claim NO puede crear una sanción', () =>
        assertFails(noClaim.doc('championships/champ1/penalties/p2').set({ driver: 'y' })));

    await check('comisario de OTRA organización NO puede crear sanción en GT7 ESP (herencia de orgId del padre)', () =>
        assertFails(dirLigaOtraOrg.doc('championships/champ1/penalties/p3').set({ driver: 'z' })));

    // ── Asignación de comisarios por campeonato (ADR-009) ──
    await check('comisario ASIGNADO puede resolver una reclamación de su campeonato', () =>
        assertSucceeds(comisario.doc('championships/champAsignado/claims/claimAsignado').update({ status: 'resolved', resolvedBy: 'uidComisario' })));

    await check('comisario ASIGNADO puede crear una sanción en su campeonato', () =>
        assertSucceeds(comisario.doc('championships/champAsignado/penalties/pAsignado').set({ driver: 'x', points: 5 })));

    await check('comisario NO ASIGNADO (misma org) NO puede resolver una reclamación de ese campeonato', () =>
        assertFails(comisario2.doc('championships/champAsignado/claims/claimAsignado').update({ status: 'resolved', resolvedBy: 'uidComisario2' })));

    await check('comisario NO ASIGNADO (misma org) NO puede crear una sanción en ese campeonato', () =>
        assertFails(comisario2.doc('championships/champAsignado/penalties/pNoAsignado').set({ driver: 'y' })));

    await check('comisario NO ASIGNADO NO puede borrar una reclamación de ese campeonato', () =>
        assertFails(comisario2.doc('championships/champAsignado/claims/claimAsignado').delete()));

    await check('director_liga de GT7 ESP puede resolver reclamaciones aunque no esté en comisarioUids', () =>
        assertSucceeds(dirLiga.doc('championships/champAsignado/claims/claimAsignado').update({ status: 'resolved', resolvedBy: 'dirLigaUser' })));

    await check('organizador de GT7 ESP puede crear sanciones aunque no esté en comisarioUids', () =>
        assertSucceeds(organizador.doc('championships/champAsignado/penalties/pOrganizador').set({ driver: 'z' })));

    await check('LEGACY: cualquier comisario de la org puede resolver reclamaciones si comisarioUids está ausente (champ1)', () =>
        assertSucceeds(comisario.doc('championships/champ1/claims/c1').update({ status: 'resolved', resolvedBy: 'uidComisario' })));

    await check('LEGACY: un SEGUNDO comisario de la org también puede, si comisarioUids está ausente (champ1)', () =>
        assertSucceeds(comisario2.doc('championships/champ1/penalties/pLegacy').set({ driver: 'x' })));

    await check('comisarioUids=[] bloquea a TODOS los comisarios de la org (no es "todos", es "ninguno")', () =>
        assertFails(comisario.doc('championships/champSinComisarios/claims/claimSinComisarios').update({ status: 'resolved' })));

    await check('comisarioUids=[] NO bloquea a un admin (director_liga/organizador)', () =>
        assertSucceeds(dirLiga.doc('championships/champSinComisarios/claims/claimSinComisarios').update({ status: 'resolved', resolvedBy: 'dirLigaUser' })));

    await check('CROSS-ORG: estar en comisarioUids NO basta si no se es comisario de ESA organización', () =>
        assertFails(comisarioOtraOrgColado.doc('championships/champAsignado/claims/claimAsignado').update({ status: 'resolved' })));

    await check('un comisario NO puede auto-asignarse editando comisarioUids', () =>
        assertFails(comisario.doc('championships/champAsignado').update({ comisarioUids: ['uidComisario', 'uidComisario2'] })));

    await check('el flujo público de inscripción NO puede tocar comisarioUids junto con registrations', () =>
        assertFails(anon.doc('championships/champAsignado').update({
            registrations: [{ gt7Id: 'x' }],
            comisarioUids: ['uidComisario2'],
        })));

    // ── teams / tracks subcolecciones (heredan orgId del padre) ──
    await check('Anónimo NO puede escribir en championships/{id}/teams', () =>
        assertFails(anon.doc('championships/champ1/teams/t1').set({ name: 'Equipo Hack' })));

    await check('director_liga de GT7 ESP puede escribir en championships/{id}/teams de GT7 ESP', () =>
        assertSucceeds(dirLiga.doc('championships/champ1/teams/t1').set({ name: 'Equipo OK' })));

    await check('director_liga de OTRA organización NO puede escribir en teams de GT7 ESP', () =>
        assertFails(dirLigaOtraOrg.doc('championships/champ1/teams/t2').set({ name: 'Hack team' })));

    // ── events (org-scoped) ──
    await check('Anónimo puede LEER events', () =>
        assertSucceeds(anon.doc('events/event1').get()));

    await check('Anónimo puede crear un participante (inscripción pública a evento)', () =>
        assertSucceeds(anon.doc('events/event1/participants/part1').set({ gt7Id: 'piloto1' })));

    await check('Anónimo puede actualizar SOLO waitlistCount/updatedAt en el evento', () =>
        assertSucceeds(anon.doc('events/event1').update({ waitlistCount: 1, updatedAt: 'y' })));

    await check('Anónimo puede actualizar participantCount al inscribirse (addEventParticipant)', () =>
        assertSucceeds(anon.doc('events/event1').update({ participantCount: 1, updatedAt: 'y' })));

    await check('Anónimo NO puede tocar otro campo del evento junto a waitlistCount', () =>
        assertFails(anon.doc('events/event1').update({ waitlistCount: 2, maxParticipants: 999 })));

    await check('Anónimo NO puede eliminar un evento', () =>
        assertFails(anon.doc('events/event1').delete()));

    await check('director_liga NO puede crear un evento con orgId de otra organización', () =>
        assertFails(dirLiga.doc('events/eventWrongOrg').set({ orgId: 'otra-org', title: 'X' })));

    await check('director_liga NO puede reasignar el orgId de un evento existente', () =>
        assertFails(dirLiga.doc('events/event1').update({ orgId: 'otra-org' })));

    await check('director_liga de OTRA organización NO puede editar eventos de GT7 ESP', () =>
        assertFails(dirLigaOtraOrg.doc('events/event1').update({ title: 'Hack cross-org' })));

    // ── teams (catálogo raíz, scopeado por orgId) / tracks (catálogo global compartido) ──
    await check('Anónimo puede LEER el catálogo de teams', () =>
        assertSucceeds(anon.doc('teams/team1').get()));

    await check('Anónimo NO puede escribir en el catálogo de teams', () =>
        assertFails(anon.doc('teams/team1').set({ orgId: 'gt7-esp', name: 'Hack' })));

    await check('director_liga NO puede crear un team con orgId de otra organización', () =>
        assertFails(dirLiga.doc('teams/teamWrongOrg').set({ orgId: 'otra-org', name: 'X' })));

    await check('director_liga puede crear un team con el orgId correcto', () =>
        assertSucceeds(dirLiga.doc('teams/team2').set({ orgId: 'gt7-esp', name: 'Equipo Nuevo' })));

    await check('Anónimo puede LEER el catálogo global de tracks', () =>
        assertSucceeds(anon.doc('tracks/t1').get()));

    await check('Anónimo NO puede escribir en el catálogo global de tracks', () =>
        assertFails(anon.doc('tracks/t1').set({ name: 'Hack' })));

    await check('director_liga de GT7 ESP NO puede escribir en el catálogo global de tracks (solo platformOwner)', () =>
        assertFails(dirLiga.doc('tracks/t1').set({ name: 'Spa' })));

    await check('organizador de GT7 ESP NO puede escribir en el catálogo global de tracks (solo platformOwner)', () =>
        assertFails(organizador.doc('tracks/t1').set({ name: 'Spa' })));

    await check('Platform Owner puede escribir en el catálogo global de tracks', () =>
        assertSucceeds(platformOwner.doc('tracks/t1').set({ name: 'Spa' })));

    // ── equipment (catálogo global, solo editable por platformOwner) ──
    await check('Anónimo puede LEER el catálogo de equipment', () =>
        assertSucceeds(anon.doc('equipment/e1').get()));

    await check('Anónimo NO puede escribir en equipment', () =>
        assertFails(anon.doc('equipment/e1').set({ title: 'Hack' })));

    await check('director_liga (organizador de GT7 ESP) NO puede escribir en equipment', () =>
        assertFails(organizador.doc('equipment/e1').set({ title: 'Hack' })));

    await check('Platform Owner puede escribir en equipment', () =>
        assertSucceeds(platformOwner.doc('equipment/e1').set({ title: 'Volante X', order: 0 })));

    // ── organizations ──
    await check('Anónimo puede LEER una organización (branding/reglamento públicos)', () =>
        assertSucceeds(anon.doc('organizations/gt7-esp').get()));

    await check('Anónimo NO puede escribir el reglamento de una organización', () =>
        assertFails(anon.doc('organizations/gt7-esp').update({ reglamento: { sections: [] } })));

    await check('director_liga (sin organizador ni platformOwner) NO puede escribir organizations', () =>
        assertFails(dirLiga.doc('organizations/gt7-esp').update({ reglamento: { sections: [] } })));

    await check('Platform Owner puede escribir el reglamento de cualquier organización', () =>
        assertSucceeds(platformOwner.doc('organizations/gt7-esp').update({ reglamento: { sections: [] } })));

    await check('organizador de GT7 ESP puede editar el branding/reglamento de SU organización', () =>
        assertSucceeds(organizador.doc('organizations/gt7-esp').update({ reglamento: { sections: [{ id: 'x' }] } })));

    await check('organizador de GT7 ESP NO puede editar plan/billing (fuera de branding/reglamento)', () =>
        assertFails(organizador.doc('organizations/gt7-esp').update({ plan: 'pro' })));

    await check('organizador de OTRA organización NO puede editar organizations/gt7-esp', () =>
        assertFails(dirLigaOtraOrg.doc('organizations/gt7-esp').update({ reglamento: { sections: [] } })));

    // ── memberships ──
    await check('Platform Owner puede LEER memberships', () =>
        assertSucceeds(platformOwner.doc('memberships/uidComisario_gt7-esp').get()));

    await check('director_liga de GT7 ESP puede LEER memberships de su organización', () =>
        assertSucceeds(dirLiga.doc('memberships/uidComisario_gt7-esp').get()));

    await check('El propio usuario puede LEER su membership', () =>
        assertSucceeds(comisario.doc('memberships/uidComisario_gt7-esp').get()));

    await check('director_liga de OTRA organización NO puede LEER memberships de GT7 ESP', () =>
        assertFails(dirLigaOtraOrg.doc('memberships/uidComisario_gt7-esp').get()));

    await check('NADIE puede escribir memberships desde el cliente (ni platformOwner)', () =>
        assertFails(platformOwner.doc('memberships/otro_gt7-esp').set({ role: 'comisario' })));

    // ── límites de plan — lotes prepagados (ADR-007) ──
    await check('Org con championshipCredits=0 NO puede crear un campeonato', () =>
        assertFails(dirLigaFreeUsed.doc('championships/champFreeUsed').set({
            orgId: 'free-org-used', name: 'X', categories: [], settings: { pointsSystem: {} }, drivers: [], registrations: [],
        })));

    await check('Org con championshipCredits=1 SÍ puede crear un campeonato', () =>
        assertSucceeds(dirLigaFreeFresh.doc('championships/champFreeFresh').set({
            orgId: 'free-org-fresh', name: 'X', categories: [], settings: { pointsSystem: {} }, drivers: [], registrations: [],
        })));

    await check('Org con championshipCredits=0 NO puede crear un evento', () =>
        assertFails(dirLigaFreeUsed.doc('events/eventFreeUsed').set({
            orgId: 'free-org-used', title: 'X', waitlistCount: 0, updatedAt: 'x',
        })));

    await check('Org billingExempt puede crear un campeonato aunque championshipCredits=0', () =>
        assertSucceeds(dirLiga.doc('championships/champExempt').set({
            orgId: 'gt7-esp', name: 'X', categories: [], settings: { pointsSystem: {} }, drivers: [], registrations: [],
        })));

    await check('Inscripción pública respeta el límite de pilotos (maxDrivers=2): dentro del límite', () =>
        assertSucceeds(anon.doc('championships/champLimited').set({
            orgId: 'limited-org', name: 'Champ Limitado', categories: ['Gr1'],
            settings: { pointsSystem: {} }, drivers: [], registrations: ['p1', 'p2'],
        })));

    await check('Inscripción pública respeta el límite de pilotos (maxDrivers=2): excede el límite', () =>
        assertFails(anon.doc('championships/champLimited').set({
            orgId: 'limited-org', name: 'Champ Limitado', categories: ['Gr1'],
            settings: { pointsSystem: {} }, drivers: [], registrations: ['p1', 'p2', 'p3'],
        })));

    await check('Inscripción a evento respeta participantsCount vs. maxDrivers (ya en el límite)', () =>
        assertFails(anon.doc('events/eventLimited/participants/p3').set({ name: 'Piloto 3' })));

    await check('director_liga de org limitada puede editar el evento sin tocar participantsCount (sin límite de admin)', () =>
        assertSucceeds(dirLigaLimited.doc('events/eventLimited').set({
            orgId: 'limited-org', title: 'Evento Limitado editado', waitlistCount: 0, updatedAt: 'x', participantsCount: 2,
        })));

    // ── appeals (alegaciones sobre reclamaciones — incidencia 3, 3b.4) ──
    // Caso 1: anónimo crea alegación 'pending' válida en champ con allowAppeals:true → permitido
    await check('Anónimo crea una alegación pending válida en un champ con allowAppeals:true', () =>
        assertSucceeds(anon.doc('championships/champAppeals/appeals/a1').set({
            status: 'pending', claimId: 'claim1', appellantName: 'Piloto X',
            reason: 'Motivo de prueba suficientemente largo para pasar el mínimo',
        })));

    // Caso 2: anónimo crea alegación con status:'upheld' → denegado
    await check('Anónimo NO puede crear una alegación que ya llegue "upheld"', () =>
        assertFails(anon.doc('championships/champAppeals/appeals/a2').set({
            status: 'upheld', claimId: 'claim1', appellantName: 'Piloto X',
            reason: 'Motivo de prueba suficientemente largo para pasar el mínimo',
        })));

    // Caso 3: anónimo crea alegación con resolvedBy → denegado
    await check('Anónimo NO puede crear una alegación con resolvedBy ya puesto', () =>
        assertFails(anon.doc('championships/champAppeals/appeals/a3').set({
            status: 'pending', resolvedBy: 'alguien', claimId: 'claim1', appellantName: 'Piloto X',
            reason: 'Motivo de prueba suficientemente largo para pasar el mínimo',
        })));

    // Caso 4: anónimo crea alegación en champ con allowAppeals:false → denegado
    await check('Anónimo NO puede crear una alegación en un champ con allowAppeals:false (o ausente)', () =>
        assertFails(anon.doc('championships/champ1/appeals/a4').set({
            status: 'pending', claimId: 'claim1', appellantName: 'Piloto X',
            reason: 'Motivo de prueba suficientemente largo para pasar el mínimo',
        })));

    // Caso 5: anónimo crea alegación con reason sobredimensionado → denegado
    await check('Anónimo NO puede crear una alegación con "reason" fuera de los límites de tamaño', () =>
        assertFails(anon.doc('championships/champAppeals/appeals/a5').set({
            status: 'pending', claimId: 'claim1', appellantName: 'Piloto X',
            reason: 'x'.repeat(5000),
        })));

    // Caso 6: comisario asignado intenta resolver una alegación → denegado
    // (el test que protege ADR-009 — un comisario no debe poder revocar sus propias sanciones)
    await check('Un comisario NO puede resolver (update) una alegación, aunque esté asignado al campeonato', () =>
        assertFails(comisario.doc('championships/champAppeals/appeals/appealPending').update({
            status: 'upheld', resolvedBy: 'uidComisario', resolvedAt: new Date().toISOString(),
        })));

    // Caso 7: director_liga resuelve → permitido
    await check('Un director_liga de la misma org SÍ puede resolver una alegación', () =>
        assertSucceeds(dirLiga.doc('championships/champAppeals/appeals/appealPending').update({
            status: 'upheld', resolvedBy: 'dirLigaUser', resolvedAt: new Date().toISOString(),
        })));

    // Caso 8: director_liga de otra org → denegado
    await check('Un director_liga de OTRA organización NO puede resolver una alegación de GT7 ESP', () =>
        assertFails(dirLigaOtraOrg.doc('championships/champAppeals/appeals/appealPending').update({
            status: 'overturned', resolvedBy: 'dirLigaOtraOrgUser', resolvedAt: new Date().toISOString(),
        })));

    // Caso 9: anónimo intenta update sobre una alegación → denegado
    await check('Anónimo NO puede hacer update sobre una alegación existente', () =>
        assertFails(anon.doc('championships/champAppeals/appeals/appealPending').update({
            status: 'dismissed',
        })));

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
