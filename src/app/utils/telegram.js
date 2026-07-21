/**
 * Utilidad para enviar notificaciones vía Telegram Bot.
 * Las notificaciones se envían al chat ID configurado (el admin).
 * El token se gestiona en el servidor (/api/notify) — nunca se expone al cliente.
 */

/**
 * Envía un mensaje de texto al chat del admin.
 * @param {string} text - Texto en formato HTML de Telegram.
 */
export async function sendTelegramNotification(text) {
    try {
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
    } catch {
        // Las notificaciones son best-effort — no bloquear la operación principal
    }
}

// ─── Helpers por evento ────────────────────────────────────────────────
//
// Todas aceptan un `orgName` opcional — con varias organizaciones activas en
// la plataforma, todas las notificaciones llegan al mismo chat del
// Administrador de Plataforma, así que sin esta etiqueta no habría forma de
// saber a simple vista de qué liga es cada una.

const orgTag = (orgName) => (orgName ? `🏢 ${orgName}\n` : '');

export function notifyResultsSaved({ championshipName, trackName, round, driversCount, orgName }) {
    return sendTelegramNotification(
        `🏁 <b>Resultados guardados</b>\n` +
        orgTag(orgName) +
        `🏆 ${championshipName}\n` +
        `📍 R${round} — ${trackName}\n` +
        `👥 ${driversCount} piloto${driversCount !== 1 ? 's' : ''} registrado${driversCount !== 1 ? 's' : ''}`
    );
}

export function notifyPenaltyApplied({ championshipName, driverName, penaltyName, points, severity, trackName, round, orgName }) {
    const sevEmoji = severity === 'major' ? '🔴' : severity === 'moderate' ? '🟠' : '🟡';
    const trackInfo = trackName ? `\n🏁 R${round} — ${trackName}` : '';
    return sendTelegramNotification(
        `⚠️ <b>Sanción aplicada</b>\n` +
        orgTag(orgName) +
        `🏆 ${championshipName}\n` +
        `👤 ${driverName}${trackInfo}\n` +
        `${sevEmoji} ${penaltyName}` +
        (points > 0 ? `\n🔻 -${points} pts` : '')
    );
}

export function notifyClaimCreated({ championshipName, reporterName, accusedNames, trackName, round, description, orgName }) {
    const accused = Array.isArray(accusedNames) ? accusedNames.join(', ') : accusedNames;
    const trackInfo = trackName ? ` (R${round} — ${trackName})` : '';
    return sendTelegramNotification(
        `📩 <b>Nueva reclamación</b>\n` +
        orgTag(orgName) +
        `🏆 ${championshipName}\n` +
        `👤 ${reporterName} → ${accused}${trackInfo}\n` +
        `📝 ${description}`
    );
}

export function notifyClaimResolved({ championshipName, status, reporterName, accusedNames, trackName, round, resolution, orgName }) {
    const statusEmoji = status === 'accepted' ? '✅' : '❌';
    const statusLabel = status === 'accepted' ? 'Aceptada' : 'Rechazada';
    const accused = Array.isArray(accusedNames) ? accusedNames.join(', ') : accusedNames;
    const trackInfo = trackName ? ` (R${round} — ${trackName})` : '';
    return sendTelegramNotification(
        `📩 <b>Reclamación ${statusLabel}</b> ${statusEmoji}\n` +
        orgTag(orgName) +
        `🏆 ${championshipName}\n` +
        `👤 ${reporterName} → ${accused}${trackInfo}` +
        (resolution ? `\n💬 ${resolution}` : '')
    );
}

export function notifyEventRegistration({ eventTitle, gt7Id, psnId, name, waitlisted, position, orgName }) {
    const driver = gt7Id || name || psnId || 'Piloto';
    const psnInfo = psnId && psnId !== driver ? ` (PSN: ${psnId})` : '';
    const header = waitlisted
        ? `⏳ <b>Reserva en evento</b> (lista de espera #${position})`
        : `🎉 <b>Nueva inscripción a evento</b>`;
    return sendTelegramNotification(
        `${header}\n` +
        orgTag(orgName) +
        `📅 ${eventTitle}\n` +
        `🎮 ${driver}${psnInfo}`
    );
}

export function notifyRegistrationUpdated({ championshipName, driverName, psnId, status, orgName }) {
    const statusEmoji = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : status === 'withdrawn' ? '🚪' : '⏳';
    const statusLabel = status === 'approved' ? 'Aprobado' : status === 'rejected' ? 'Rechazado' : status === 'withdrawn' ? 'Baja' : 'Pendiente';
    const psnInfo = psnId && psnId !== driverName ? ` (PSN: ${psnId})` : '';
    return sendTelegramNotification(
        `👤 <b>Inscripción ${statusLabel}</b> ${statusEmoji}\n` +
        orgTag(orgName) +
        `🏆 ${championshipName}\n` +
        `🎮 ${driverName}${psnInfo}`
    );
}
