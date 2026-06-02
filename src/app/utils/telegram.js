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

export function notifyResultsSaved({ championshipName, trackName, round, driversCount }) {
    return sendTelegramNotification(
        `🏁 <b>Resultados guardados</b>\n` +
        `🏆 ${championshipName}\n` +
        `📍 R${round} — ${trackName}\n` +
        `👥 ${driversCount} piloto${driversCount !== 1 ? 's' : ''} registrado${driversCount !== 1 ? 's' : ''}`
    );
}

export function notifyPenaltyApplied({ championshipName, driverName, penaltyName, points, severity, trackName, round }) {
    const sevEmoji = severity === 'major' ? '🔴' : severity === 'moderate' ? '🟠' : '🟡';
    const trackInfo = trackName ? `\n🏁 R${round} — ${trackName}` : '';
    return sendTelegramNotification(
        `⚠️ <b>Sanción aplicada</b>\n` +
        `🏆 ${championshipName}\n` +
        `👤 ${driverName}${trackInfo}\n` +
        `${sevEmoji} ${penaltyName}` +
        (points > 0 ? `\n🔻 -${points} pts` : '')
    );
}

export function notifyClaimResolved({ championshipName, status, reporterName, accusedNames, trackName, round, resolution }) {
    const statusEmoji = status === 'accepted' ? '✅' : '❌';
    const statusLabel = status === 'accepted' ? 'Aceptada' : 'Rechazada';
    const accused = Array.isArray(accusedNames) ? accusedNames.join(', ') : accusedNames;
    const trackInfo = trackName ? ` (R${round} — ${trackName})` : '';
    return sendTelegramNotification(
        `📩 <b>Reclamación ${statusLabel}</b> ${statusEmoji}\n` +
        `🏆 ${championshipName}\n` +
        `👤 ${reporterName} → ${accused}${trackInfo}` +
        (resolution ? `\n💬 ${resolution}` : '')
    );
}

export function notifyRegistrationUpdated({ championshipName, driverName, psnId, status }) {
    const statusEmoji = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⏳';
    const statusLabel = status === 'approved' ? 'Aprobado' : status === 'rejected' ? 'Rechazado' : 'Pendiente';
    const psnInfo = psnId && psnId !== driverName ? ` (PSN: ${psnId})` : '';
    return sendTelegramNotification(
        `👤 <b>Inscripción ${statusLabel}</b> ${statusEmoji}\n` +
        `🏆 ${championshipName}\n` +
        `🎮 ${driverName}${psnInfo}`
    );
}
