#!/usr/bin/env node
/**
 * Autoriza a la web a subir vídeos a la cuenta de YouTube de las
 * reclamaciones y guarda la autorización como secreto de Firebase
 * (YOUTUBE_OAUTH), que es lo que usa la función de subida.
 *
 * Uso:
 *   node scripts/youtube/autorizar-youtube.mjs <cliente-oauth.json> [--probar]
 *
 * <cliente-oauth.json> es el archivo que descarga Google Cloud al crear un
 * «ID de cliente de OAuth» de tipo «App de escritorio».
 *
 * Abre el navegador: inicia sesión con la cuenta de YouTube de las
 * reclamaciones (no la de los directos) y acepta. La autorización nunca se
 * muestra en pantalla: va directa a Secret Manager.
 *
 * --probar sube además un vídeo de 3 segundos como «Oculto» y dice cómo lo
 * dejó YouTube. Si sale «private», el proyecto necesita la auditoría de
 * Google antes de poder publicar vídeos ocultos. Bórralo después en
 * YouTube Studio.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, unlinkSync, statSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const ALCANCE = 'https://www.googleapis.com/auth/youtube.upload';
const [rutaCliente, ...opciones] = process.argv.slice(2);
if (!rutaCliente) {
    console.error('Uso: node scripts/youtube/autorizar-youtube.mjs <cliente-oauth.json> [--probar]');
    process.exit(1);
}
const archivo = JSON.parse(readFileSync(rutaCliente, 'utf8'));
const cliente = archivo.installed || archivo.web;
if (!cliente?.client_id) {
    console.error('El archivo no parece un cliente OAuth de Google (falta client_id).');
    process.exit(1);
}

// 1. Consentimiento en el navegador, con respuesta en un puerto local
const estado = randomBytes(16).toString('hex');
const { codigo, redirectUri } = await new Promise((resolve, reject) => {
    const servidor = createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname !== '/') { res.end(); return; }
        const ok = url.searchParams.get('state') === estado && url.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(ok ? '<h2>Listo. Ya puedes cerrar esta pestaña.</h2>' : '<h2>No se autorizó.</h2>');
        servidor.close();
        if (ok) resolve({ codigo: url.searchParams.get('code'), redirectUri: `http://127.0.0.1:${puerto}` });
        else reject(new Error(url.searchParams.get('error') || 'respuesta sin código'));
    });
    let puerto;
    servidor.listen(0, '127.0.0.1', () => {
        puerto = servidor.address().port;
        const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        auth.search = new URLSearchParams({
            client_id: cliente.client_id,
            redirect_uri: `http://127.0.0.1:${puerto}`,
            response_type: 'code',
            scope: ALCANCE,
            access_type: 'offline',
            prompt: 'consent',
            state: estado,
        });
        console.log('Abriendo el navegador para autorizar…');
        console.log('Si no se abre, copia esta dirección:\n' + auth.toString() + '\n');
        try { execFileSync('open', [auth.toString()]); } catch { /* se copia a mano */ }
    });
});

// 2. Código → token de refresco
const token = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
        code: codigo,
        client_id: cliente.client_id,
        client_secret: cliente.client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    }),
})).json();
if (!token.refresh_token) {
    console.error('Google no devolvió un token de refresco:', token.error_description || token.error || 'sin detalle');
    process.exit(1);
}
console.log('✔ Autorización recibida.');

// 3. Secreto en Firebase, a través de un archivo temporal que se borra al momento
const dir = mkdtempSync(join(tmpdir(), 'yt-'));
const tmp = join(dir, 'secreto.json');
writeFileSync(tmp, JSON.stringify({
    client_id: cliente.client_id,
    client_secret: cliente.client_secret,
    refresh_token: token.refresh_token,
}), { mode: 0o600 });
try {
    execFileSync('firebase', ['functions:secrets:set', 'YOUTUBE_OAUTH', '--data-file', tmp, '--project', 'imsa-bd5b6', '--force'], { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log('✔ Guardada como secreto YOUTUBE_OAUTH en Firebase.');
} finally {
    unlinkSync(tmp);
}

// 4. Prueba opcional: ¿respeta YouTube el «Oculto»?
if (opciones.includes('--probar')) {
    const video = join(dir, 'prueba.mp4');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=640x360:rate=30', '-pix_fmt', 'yuv420p', video]);
    const inicio = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': 'video/mp4',
            'X-Upload-Content-Length': String(statSync(video).size),
        },
        body: JSON.stringify({
            snippet: { title: 'Prueba de subida (borrar)', categoryId: '20' },
            status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
        }),
    });
    if (!inicio.ok) {
        console.error('✖ YouTube rechazó la subida:', inicio.status, await inicio.text());
        process.exit(1);
    }
    const subida = await fetch(inicio.headers.get('location'), {
        method: 'PUT',
        headers: { 'Content-Type': 'video/mp4' },
        body: readFileSync(video),
    });
    const resultado = await subida.json();
    unlinkSync(video);
    if (!subida.ok) {
        console.error('✖ Falló la subida:', JSON.stringify(resultado.error || resultado));
        process.exit(1);
    }
    console.log(`✔ Vídeo de prueba subido: https://youtu.be/${resultado.id}`);
    console.log(`  Privacidad pedida: unlisted · devuelta por YouTube: ${resultado.status?.privacyStatus}`);
    console.log('  Mira en YouTube Studio si aparece «Oculto» o «Privado (bloqueado)» y luego bórralo.');
}
