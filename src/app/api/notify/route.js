/**
 * API Route (server-side) para enviar notificaciones vía Telegram Bot.
 * El token nunca se expone al cliente — solo existe en el servidor.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function POST(request) {
    if (!BOT_TOKEN || !CHAT_ID) {
        return Response.json({ ok: false, error: 'Telegram not configured' }, { status: 500 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const { text } = body;
    if (!text || typeof text !== 'string') {
        return Response.json({ ok: false, error: 'Missing or invalid text field' }, { status: 400 });
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
        });

        if (!res.ok) {
            return Response.json({ ok: false, error: 'Telegram API error' }, { status: 502 });
        }

        return Response.json({ ok: true });
    } catch {
        return Response.json({ ok: false, error: 'Failed to reach Telegram' }, { status: 502 });
    }
}
