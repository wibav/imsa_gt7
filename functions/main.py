from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import time
import traceback as tb
import urllib.error
import urllib.request
from io import BytesIO

from firebase_functions import firestore_fn, https_fn
from PIL import Image, ImageEnhance, ImageFilter, UnidentifiedImageError
import vtracer

import firebase_admin
from firebase_admin import auth as fb_auth, firestore as fb_firestore

if not firebase_admin._apps:
    firebase_admin.initialize_app()


SVG_SIZE_LIMIT_BYTES = 15 * 1024
MAX_UPLOAD_BYTES = 10 * 1024 * 1024   # Guard anti-abuso: rechaza subidas > 10 MB
MAX_INPUT_DIM = 512                   # GT7 no aprovecha detalle > 512px; capear acelera todo
DEFAULT_OPTIONS = {
    'colormode': 'color',
    'hierarchical': 'stacked',
    'mode': 'spline',
    'filter_speckle': 4,
    'color_precision': 6,
    'layer_difference': 16,
    'corner_threshold': 60,
    'length_threshold': 4.0,
    'max_iterations': 10,
    'splice_threshold': 45,
    'path_precision': 2,
}


def _parse_int(form, key, default):
    raw_value = form.get(key)
    if raw_value in (None, ''):
        return default

    try:
        return int(float(raw_value))
    except (TypeError, ValueError):
        return default


def _parse_float(form, key, default):
    raw_value = form.get(key)
    if raw_value in (None, ''):
        return default

    try:
        return float(raw_value)
    except (TypeError, ValueError):
        return default


def _minify_svg(svg_text: str) -> str:
    svg_text = re.sub(r'<\?xml[^>]*\?>', '', svg_text, flags=re.IGNORECASE)
    svg_text = re.sub(r'<!--[\s\S]*?-->', '', svg_text, flags=re.DOTALL)
    svg_text = svg_text.replace('\r', '').replace('\n', '')
    svg_text = re.sub(r'>\s+<', '><', svg_text)
    svg_text = re.sub(r'\s{2,}', ' ', svg_text)
    return svg_text.strip()


def _ensure_viewbox(svg_text: str) -> str:
    """Garantiza un viewBox en el <svg>. GT7 lo necesita para escalar el vinilo
    correctamente en el editor; algunas salidas de vtracer solo traen width/height."""
    if re.search(r'viewBox\s*=', svg_text, flags=re.IGNORECASE):
        return svg_text

    tag_match = re.search(r'<svg\b[^>]*>', svg_text, flags=re.IGNORECASE)
    if not tag_match:
        return svg_text

    svg_tag = tag_match.group(0)
    width_match = re.search(r'width\s*=\s*"?(\d+(?:\.\d+)?)', svg_tag, flags=re.IGNORECASE)
    height_match = re.search(r'height\s*=\s*"?(\d+(?:\.\d+)?)', svg_tag, flags=re.IGNORECASE)
    if not (width_match and height_match):
        return svg_text

    viewbox = f'viewBox="0 0 {width_match.group(1)} {height_match.group(1)}"'
    new_tag = svg_tag[:-1] + f' {viewbox}>'
    return svg_text.replace(svg_tag, new_tag, 1)


def _preprocess_for_tracing(image: Image.Image, quantize_colors, denoise_size: int) -> Image.Image:
    """Reduce la complejidad del raster ANTES de vectorizar, preservando la transparencia.

    - denoise_size: tamaño del filtro de mediana (0 = off, 3 = ligero, 5 = fuerte)
      que funde el ruido/textura fotográfica.
    - quantize_colors: colapsa la imagen a una paleta pequeña (colores planos),
      lo que reduce drásticamente el nº de paths sin perder resolución espacial.
      Antes de cuantizar se realza saturación/contraste para separar los colores
      del logo (ej. amarillo) de fondos apagados/oscuros y evitar que se fundan.

    Es la palanca clave para logos con textura/degradados: permite mantener 256-384px
    en vez de bajar a 128px (que es lo que arruina la nitidez).
    """
    if not denoise_size and not quantize_colors:
        return image

    alpha = image.getchannel('A')
    rgb = image.convert('RGB')

    if denoise_size:
        rgb = rgb.filter(ImageFilter.MedianFilter(size=denoise_size))

    if quantize_colors:
        rgb = ImageEnhance.Color(rgb).enhance(1.3)      # +saturación: el color del logo "salta"
        rgb = ImageEnhance.Contrast(rgb).enhance(1.12)  # +contraste: separa del fondo apagado
        rgb = rgb.quantize(colors=quantize_colors, method=Image.FASTOCTREE).convert('RGB')

    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def _build_attempt_ladder(base_speckle: int, base_color: int, requested_precision: int, forced_quantize=None):
    """Escalera de intentos ordenada de MENOR a MAYOR agresividad.

    Estrategia: priorizar la REDUCCIÓN DE COLOR (cuantización + denoise) sobre el
    downscaling espacial, porque para logos con textura fotográfica/degradados la
    cuantización colapsa el ruido en regiones planas y permite mantener resolución
    (256-384px), mientras que bajar a 128px destruye la legibilidad.

    Cada tupla: (path_precision, filter_speckle, color_precision, max_dim,
                 quantize_colors, denoise_size).
    max_dim None = imagen tal cual (ya capeada a MAX_INPUT_DIM).
    quantize_colors None = sin cuantización (logos limpios entran en el 1er intento).

    forced_quantize: si el usuario fija una paleta manual, se intenta primero a
    resolución completa (con fallback al resto de la escalera si no entra en 15 KB).
    """
    p = requested_precision
    s = base_speckle
    c = base_color
    s_hi = min(base_speckle + 4, 16)
    c_lo = max(base_color - 1, 4)

    ladder = [
        # 1) Limpio: un logo vectorial nítido entra aquí sin tocar nada
        (p, s,    c,    None, None, 0),
        # 2-3) Cuantizar color manteniendo resolución completa
        (p, s,    c,    None, 16,   3),
        (p, s_hi, c,    None, 12,   3),
        # 4-6) Reducir resolución gradualmente + paleta más chica (denoise fuerte)
        (p, s_hi, c,    384,  8,    3),
        (p, s_hi, c_lo, 320,  6,    5),
        (1, 16,   4,    320,  4,    5),
        (1, 16,   4,    256,  4,    5),
        # 7-8) Último recurso: downscale agresivo (logos extremadamente densos)
        (1, 16,   4,    192,  4,    5),
        (1, 16,   4,    128,  4,    5),
    ]

    if forced_quantize:
        # La preferencia manual se prueba primero, a resolución completa
        ladder.insert(0, (p, s, c, None, forced_quantize, 3))

    # Deduplicar manteniendo orden
    seen = set()
    unique = []
    for attempt in ladder:
        if attempt not in seen:
            seen.add(attempt)
            unique.append(attempt)
    return unique


def _json_response(payload: dict, status_code: int = 200) -> https_fn.Response:
    return https_fn.Response(
        json.dumps(payload),
        status=status_code,
        mimetype='application/json',
        headers={
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
        },
    )


def _build_svg_payload(image_bytes: bytes, requested_precision: int, form) -> dict:
    options = DEFAULT_OPTIONS.copy()
    options['filter_speckle'] = _parse_int(form, 'filterSpeckle', options['filter_speckle'])
    options['color_precision'] = _parse_int(form, 'colorPrecision', options['color_precision'])
    options['layer_difference'] = _parse_int(form, 'layerDifference', options['layer_difference'])
    options['corner_threshold'] = _parse_int(form, 'cornerThreshold', options['corner_threshold'])
    options['length_threshold'] = _parse_float(form, 'lengthThreshold', options['length_threshold'])
    options['max_iterations'] = _parse_int(form, 'maxIterations', options['max_iterations'])
    options['splice_threshold'] = _parse_int(form, 'spliceThreshold', options['splice_threshold'])

    base_speckle = options['filter_speckle']
    base_color   = options['color_precision']

    # Paleta manual opcional (0/None = automático). Se exige un mínimo razonable de 2.
    forced_quantize = _parse_int(form, 'quantizeColors', 0)
    forced_quantize = forced_quantize if forced_quantize >= 2 else None

    # Escalera curada: prioriza cuantización de color sobre downscaling espacial
    unique_attempts = _build_attempt_ladder(base_speckle, base_color, requested_precision, forced_quantize)

    svg_text        = ''
    used_precision  = requested_precision
    used_speckle    = base_speckle
    used_color      = base_color
    used_dim        = None
    used_quantize   = None

    original_image = Image.open(BytesIO(image_bytes))

    for precision, speckle, color, dim, quantize_colors, denoise in unique_attempts:
        if dim is not None:
            img = original_image.copy()
            img.thumbnail((dim, dim), Image.LANCZOS)
        else:
            img = original_image

        img = _preprocess_for_tracing(img, quantize_colors, denoise)

        buf = BytesIO()
        img.save(buf, format='PNG', optimize=True)

        svg_candidate = vtracer.convert_raw_image_to_svg(
            buf.getvalue(),
            img_format='png',
            colormode=options['colormode'],
            hierarchical=options['hierarchical'],
            mode=options['mode'],
            filter_speckle=speckle,
            color_precision=color,
            layer_difference=options['layer_difference'],
            corner_threshold=options['corner_threshold'],
            length_threshold=options['length_threshold'],
            max_iterations=options['max_iterations'],
            splice_threshold=options['splice_threshold'],
            path_precision=precision,
        )
        svg_text       = _ensure_viewbox(_minify_svg(svg_candidate))
        used_precision = precision
        used_speckle   = speckle
        used_color     = color
        used_dim       = dim
        used_quantize  = quantize_colors
        if len(svg_text.encode('utf-8')) <= SVG_SIZE_LIMIT_BYTES:
            break

    svg_size = len(svg_text.encode('utf-8'))
    warning_parts = []
    if used_precision != requested_precision:
        warning_parts.append(f'Path precision reducida a {used_precision}.')
    if used_speckle != base_speckle:
        warning_parts.append(f'Filter speckle aumentado a {used_speckle}.')
    if used_color != base_color:
        warning_parts.append(f'Color precision reducida a {used_color}.')
    if used_quantize is not None:
        warning_parts.append(f'Colores reducidos a {used_quantize} para limpiar la textura.')
    if used_dim is not None:
        warning_parts.append(f'Imagen reducida a {used_dim}px para compactar el SVG.')
    if svg_size > SVG_SIZE_LIMIT_BYTES:
        warning_parts.append(f'El SVG supera el objetivo de 15 KB ({svg_size / 1024:.2f} KB).')

    return {
        'svg': svg_text,
        'sizeBytes': svg_size,
        'pathCount': len(re.findall(r'<path\b', svg_text, flags=re.IGNORECASE)),
        'pathPrecisionUsed': used_precision,
        'underLimit': svg_size <= SVG_SIZE_LIMIT_BYTES,
        'warning': ' '.join(warning_parts) if warning_parts else '',
    }


@https_fn.on_request(region='us-central1', timeout_sec=300)
def convert_to_gt_svg(req: https_fn.Request) -> https_fn.Response:
    try:
        return _handle_request(req)
    except Exception as exc:
        return _json_response(
            {'error': f'Unhandled exception: {exc}', 'traceback': tb.format_exc()},
            status_code=500,
        )


# ─── Notificaciones de Telegram ──────────────────────────────────────────────
# El token vive como secreto del servidor (Secret Manager) y NUNCA se expone al
# cliente ni al bundle estático. El sitio (export estático) llama a /api/notify,
# que Firebase Hosting reescribe a esta función.

_TELEGRAM_API = 'https://api.telegram.org'
_DEFAULT_CHAT_ID = '49018768'   # destino no sensible; el token es lo secreto

_NOTIFY_CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def _notify_json(payload: dict, status_code: int = 200) -> https_fn.Response:
    return https_fn.Response(
        json.dumps(payload),
        status=status_code,
        headers={**_NOTIFY_CORS, 'Content-Type': 'application/json'},
    )


@https_fn.on_request(region='us-central1', secrets=['TELEGRAM_BOT_TOKEN'])
def notify(req: https_fn.Request) -> https_fn.Response:
    if req.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers=_NOTIFY_CORS)

    if req.method != 'POST':
        return _notify_json({'ok': False, 'error': 'Method not allowed'}, 405)

    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_CHAT_ID', _DEFAULT_CHAT_ID)
    if not token:
        return _notify_json({'ok': False, 'error': 'Telegram not configured'}, 500)

    body = req.get_json(silent=True) or {}
    text = body.get('text')
    if not text or not isinstance(text, str):
        return _notify_json({'ok': False, 'error': 'Missing or invalid text field'}, 400)

    payload = json.dumps({
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True,
    }).encode('utf-8')

    tg_req = urllib.request.Request(
        f'{_TELEGRAM_API}/bot{token}/sendMessage',
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(tg_req, timeout=10) as resp:
            ok = 200 <= resp.status < 300
        return _notify_json({'ok': ok}, 200 if ok else 502)
    except urllib.error.HTTPError as exc:
        # Telegram respondió con un error (p.ej. 400 "chat not found", 401 token inválido)
        try:
            detail = json.loads(exc.read().decode('utf-8')).get('description', str(exc))
        except Exception:
            detail = str(exc)
        return _notify_json({'ok': False, 'error': f'Telegram: {detail}'}, 502)
    except urllib.error.URLError:
        return _notify_json({'ok': False, 'error': 'Failed to reach Telegram'}, 502)


def _handle_request(req: https_fn.Request) -> https_fn.Response:
    if req.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        })

    if req.method != 'POST':
        return _json_response({'error': 'Method not allowed. Use POST with multipart/form-data.'}, status_code=405)

    uploaded_file = req.files.get('file')
    if uploaded_file is None:
        return _json_response({'error': "Missing multipart field 'file'."}, status_code=400)

    file_bytes = uploaded_file.read()
    if not file_bytes:
        return _json_response({'error': 'The uploaded file is empty.'}, status_code=400)

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        return _json_response(
            {'error': f'El archivo supera el límite de {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.'},
            status_code=413,
        )

    try:
        image = Image.open(BytesIO(file_bytes))
        image.load()
    except UnidentifiedImageError:
        return _json_response({'error': 'The uploaded file is not a valid image.'}, status_code=400)

    if image.mode != 'RGBA':
        image = image.convert('RGBA')

    # Recortar bordes transparentes (según canal alfa): mejora encuadre,
    # reduce paths innecesarios y centra el viewBox en el logo real.
    alpha_bbox = image.getchannel('A').getbbox()
    if alpha_bbox:
        image = image.crop(alpha_bbox)

    # Capear dimensión de entrada — GT7 no aprovecha detalle > MAX_INPUT_DIM
    # y procesar a tamaño completo dispara el tiempo de vectorización.
    if max(image.width, image.height) > MAX_INPUT_DIM:
        image.thumbnail((MAX_INPUT_DIM, MAX_INPUT_DIM), Image.LANCZOS)

    normalized_png = BytesIO()
    image.save(normalized_png, format='PNG', optimize=True)

    requested_precision = _parse_int(req.form, 'pathPrecision', DEFAULT_OPTIONS['path_precision'])

    try:
        payload = _build_svg_payload(normalized_png.getvalue(), requested_precision, req.form)
    except Exception as exc:
        return _json_response({'error': f'Vectorization failed: {exc}', 'traceback': tb.format_exc()}, status_code=500)

    payload.update({
        'width': image.width,
        'height': image.height,
        'message': 'SVG listo',
    })

    return _json_response(payload)


# ─── Gestión de roles (Custom Claims) — Fase 0/2, org-scoped ────────────────
# Reemplaza ADMIN_EMAILS hardcodeado en el cliente. La única forma de otorgar
# o revocar un rol por-organización es esta función (Admin SDK), nunca el
# cliente directamente contra Firestore/Auth.
#
# Claims: { platformOwner?: true, orgs?: { [orgId]: role } }
# role ∈ 'organizador' | 'director_liga' | 'comisario'. Jerarquía:
# organizador > director_liga > comisario (un rol superior implica los
# permisos de los inferiores dentro de su misma organización).
#
# Ver: Notas/Proyectos/GT7 Championships/ADR/ADR-003-roles-permisos.md
#      Notas/Proyectos/GT7 Championships/ADR/ADR-006-diferir-claims-por-organizacion.md

_ROLE_CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

_VALID_ROLES = {'organizador', 'director_liga', 'comisario'}
_ROLE_RANK = {'comisario': 1, 'director_liga': 2, 'organizador': 3}
_MIN_RANK_TO_MANAGE_ROLES = _ROLE_RANK['director_liga']  # director_liga+ puede gestionar roles de su org


def _role_json(payload: dict, status_code: int = 200) -> https_fn.Response:
    return https_fn.Response(
        json.dumps(payload),
        status=status_code,
        headers={**_ROLE_CORS, 'Content-Type': 'application/json'},
    )


@https_fn.on_request(region='us-central1')
def manage_user_role(req: https_fn.Request) -> https_fn.Response:
    if req.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers=_ROLE_CORS)

    if req.method != 'POST':
        return _role_json({'ok': False, 'error': 'Method not allowed'}, 405)

    # ── Verificar que quien llama está autenticado ──
    auth_header = req.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return _role_json({'ok': False, 'error': 'Falta token de autorización'}, 401)

    id_token = auth_header.split(' ', 1)[1]
    try:
        caller_claims = fb_auth.verify_id_token(id_token)
    except Exception:
        return _role_json({'ok': False, 'error': 'Token inválido o expirado'}, 401)

    # ── Validar body ──
    body = req.get_json(silent=True) or {}
    target_email = (body.get('targetEmail') or '').strip().lower()
    org_id = (body.get('orgId') or '').strip()
    role = body.get('role')  # 'organizador' | 'director_liga' | 'comisario' | None (limpiar)
    display_name = (body.get('displayName') or '').strip()

    if not target_email or '@' not in target_email:
        return _role_json({'ok': False, 'error': 'Email inválido'}, 400)
    if not org_id:
        return _role_json({'ok': False, 'error': 'Falta orgId'}, 400)
    if role is not None and role not in _VALID_ROLES:
        return _role_json({'ok': False, 'error': f'Rol inválido: {role}'}, 400)

    # ── Verificar que quien llama puede gestionar roles de ESTA organización ──
    caller_org_role = (caller_claims.get('orgs') or {}).get(org_id)
    caller_rank = _ROLE_RANK.get(caller_org_role, 0)
    if not caller_claims.get('platformOwner') and caller_rank < _MIN_RANK_TO_MANAGE_ROLES:
        return _role_json({'ok': False, 'error': 'Requiere rol de Director de liga u Organizador en esta organización'}, 403)

    # ── Buscar el usuario en Firebase Auth ──
    try:
        target_user = fb_auth.get_user_by_email(target_email)
    except fb_auth.UserNotFoundError:
        return _role_json({
            'ok': False,
            'error': 'No existe una cuenta con ese email. El usuario debe haber iniciado sesión al menos una vez.',
        }, 404)

    # ── Asignar o limpiar el rol dentro del mapa orgs, preservando el resto ──
    existing_claims = target_user.custom_claims or {}
    existing_orgs = dict(existing_claims.get('orgs') or {})
    if role:
        existing_orgs[org_id] = role
    else:
        existing_orgs.pop(org_id, None)

    new_claims = {**existing_claims, 'orgs': existing_orgs}
    fb_auth.set_custom_user_claims(target_user.uid, new_claims)

    # ── Espejo en Firestore para la UI de /usersAdmin (Admin SDK, bypassa rules) ──
    db = fb_firestore.client()
    doc_ref = db.collection('memberships').document(f'{target_user.uid}_{org_id}')
    if role:
        doc_ref.set({
            'uid': target_user.uid,
            'email': target_email,
            'orgId': org_id,
            'role': role,
            'displayName': display_name,
            'updatedAt': fb_firestore.SERVER_TIMESTAMP,
        }, merge=True)
    else:
        doc_ref.delete()

    return _role_json({'ok': True})


# ══════════════════════════════════════════════════════════════════════════
# Límites de plan (SPEC-6 / docs/PLAN_MONETIZACION.md §1.4)
#
# El plan Free es de uso único (1 campeonato O 1 evento). El cliente no
# puede marcar `freeTrialUsed` él mismo (firestore.rules bloquea escritura de
# ese campo salvo platformOwner) — lo hace esta Cloud Function, con Admin
# SDK, al detectar la creación del primer campeonato/evento de una
# organización en plan Free. `firestore.rules` ya deniega una segunda
# creación una vez `freeTrialUsed == true`.
# ══════════════════════════════════════════════════════════════════════════

def _mark_free_trial_used_if_needed(org_id: str | None) -> None:
    if not org_id:
        return
    db = fb_firestore.client()
    org_ref = db.collection('organizations').document(org_id)
    org_snap = org_ref.get()
    if not org_snap.exists:
        return
    org = org_snap.to_dict() or {}
    if org.get('plan') == 'free' and not org.get('freeTrialUsed'):
        org_ref.update({'freeTrialUsed': True, 'updatedAt': fb_firestore.SERVER_TIMESTAMP})


@firestore_fn.on_document_created(document='championships/{champId}')
def on_championship_created(event: firestore_fn.Event) -> None:
    data = event.data.to_dict() if event.data else {}
    _mark_free_trial_used_if_needed(data.get('orgId'))


@firestore_fn.on_document_created(document='events/{eventId}')
def on_event_created(event: firestore_fn.Event) -> None:
    data = event.data.to_dict() if event.data else {}
    _mark_free_trial_used_if_needed(data.get('orgId'))


# `events/{eventId}.participantsCount` es un contador cacheado, mantenido
# aquí (Admin SDK) para que firestore.rules pueda topar el límite de pilotos
# del plan al momento de la inscripción pública sin necesitar una query de
# conteo (no soportada en el lenguaje de las security rules).
@firestore_fn.on_document_created(document='events/{eventId}/participants/{participantId}')
def on_event_participant_created(event: firestore_fn.Event) -> None:
    event_id = event.params['eventId']
    db = fb_firestore.client()
    db.collection('events').document(event_id).update({
        'participantsCount': fb_firestore.Increment(1),
    })


@firestore_fn.on_document_deleted(document='events/{eventId}/participants/{participantId}')
def on_event_participant_deleted(event: firestore_fn.Event) -> None:
    event_id = event.params['eventId']
    db = fb_firestore.client()
    db.collection('events').document(event_id).update({
        'participantsCount': fb_firestore.Increment(-1),
    })


# ══════════════════════════════════════════════════════════════════════════
# Alta de organización self-service (Fase 4 — sin esto, la única forma de
# crear una organización era un script manual; bloqueante para vender la
# plataforma a un cliente real).
#
# firestore.rules NO permite al cliente crear organizations/{orgId}
# directamente (create exige platformOwner u organizador de ESA org, que
# todavía no existe) — es intencional: la creación pasa exclusivamente por
# esta Cloud Function (Admin SDK), que además de escribir el documento
# asigna el custom claim `orgs.{slug} = 'organizador'` al creador, algo que
# el cliente nunca puede hacer por sí mismo.
# ══════════════════════════════════════════════════════════════════════════

_RESERVED_SLUGS = {
    'l', 'api', 'championships', 'championshipsadmin', 'equipamiento',
    'events', 'eventsadmin', 'login', 'pilots', 'reglamento', 'teamsadmin',
    'tools', 'tracksadmin', 'usersadmin', 'admin', 'www', 'app', 'signup',
    'equipamientoadmin',
}

_SLUG_RE = re.compile(r'^[a-z0-9-]+$')

_FREE_PLAN_LIMITS = {
    'maxActiveChampionshipsOrEvents': 1,
    'maxDrivers': 15,
    'maxAdmins': 1,
    'maxComisarios': 1,
}

_PRO_PLAN_LIMITS = {
    'maxActiveChampionshipsOrEvents': None,  # ilimitado
    'maxDrivers': 200,
    'maxAdmins': 10,
    'maxComisarios': 15,
}


def _validate_org_slug(slug: str) -> str | None:
    """Devuelve un mensaje de error, o None si el slug es válido."""
    if not slug or len(slug) < 3 or len(slug) > 40:
        return 'El slug debe tener entre 3 y 40 caracteres'
    if not _SLUG_RE.match(slug):
        return 'El slug solo puede tener minúsculas, números y guiones'
    if slug.startswith('-') or slug.endswith('-'):
        return 'El slug no puede empezar ni terminar con guion'
    if slug in _RESERVED_SLUGS:
        return f'"{slug}" es una palabra reservada'
    return None


@https_fn.on_request(region='us-central1')
def create_organization(req: https_fn.Request) -> https_fn.Response:
    if req.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers=_ROLE_CORS)

    if req.method != 'POST':
        return _role_json({'ok': False, 'error': 'Method not allowed'}, 405)

    auth_header = req.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return _role_json({'ok': False, 'error': 'Falta token de autorización'}, 401)

    id_token = auth_header.split(' ', 1)[1]
    try:
        caller_claims = fb_auth.verify_id_token(id_token)
    except Exception:
        return _role_json({'ok': False, 'error': 'Token inválido o expirado'}, 401)

    uid = caller_claims['uid']
    body = req.get_json(silent=True) or {}
    name = (body.get('name') or '').strip()
    slug = (body.get('slug') or '').strip().lower()

    if not name:
        return _role_json({'ok': False, 'error': 'El nombre de la organización es obligatorio'}, 400)

    slug_error = _validate_org_slug(slug)
    if slug_error:
        return _role_json({'ok': False, 'error': slug_error}, 400)

    db = fb_firestore.client()
    org_ref = db.collection('organizations').document(slug)
    membership_ref = db.collection('memberships').document(f'{uid}_{slug}')

    # Transacción: la comprobación de slug único y de "una sola organización
    # por usuario" tiene que ser atómica con la escritura, si no dos
    # requests casi simultáneas (doble click, reintento de red) podrían
    # pasar ambos el check-then-write y uno pisar silenciosamente al otro.
    transaction = db.transaction()

    @fb_firestore.transactional
    def _create_org_tx(transaction):
        existing_owned = list(
            db.collection('organizations').where('ownerUid', '==', uid).limit(1).stream(transaction=transaction)
        )
        if existing_owned:
            raise ValueError('ALREADY_OWNS_ORG')

        if org_ref.get(transaction=transaction).exists:
            raise ValueError('SLUG_TAKEN')

        transaction.set(org_ref, {
            'name': name,
            'slug': slug,
            'plan': 'free',
            'status': 'active',
            'freeTrialUsed': False,
            'billingExempt': False,
            'ownerUid': uid,
            'branding': {'logoUrl': None, 'colorPrimary': None, 'colorSecondary': None},
            'limits': _FREE_PLAN_LIMITS,
            'subscription': {'provider': None, 'externalId': None, 'currentPeriodEnd': None, 'cycle': None},
            'createdAt': fb_firestore.SERVER_TIMESTAMP,
            'updatedAt': fb_firestore.SERVER_TIMESTAMP,
        })
        transaction.set(membership_ref, {
            'uid': uid,
            'email': (caller_claims.get('email') or '').lower(),
            'orgId': slug,
            'role': 'organizador',
            'displayName': name,
            'updatedAt': fb_firestore.SERVER_TIMESTAMP,
        })

    try:
        _create_org_tx(transaction)
    except ValueError as err:
        if str(err) == 'ALREADY_OWNS_ORG':
            return _role_json({'ok': False, 'error': 'Ya tienes una organización creada con esta cuenta'}, 409)
        if str(err) == 'SLUG_TAKEN':
            return _role_json({'ok': False, 'error': 'Ese slug ya está en uso, prueba con otro'}, 409)
        raise

    # ── Otorgar 'organizador' de la organización recién creada ──
    # (Firebase Auth, no Firestore — no puede formar parte de la transacción
    # de arriba, pero va después de que esta ya confirmó ser la única
    # escritora del slug/uid, así que no hay condición de carrera real aquí.)
    target_user = fb_auth.get_user(uid)
    existing_claims = target_user.custom_claims or {}
    existing_orgs = dict(existing_claims.get('orgs') or {})
    existing_orgs[slug] = 'organizador'
    fb_auth.set_custom_user_claims(uid, {**existing_claims, 'orgs': existing_orgs})

    return _role_json({'ok': True, 'orgId': slug})


# ══════════════════════════════════════════════════════════════════════════
# Billing — Paddle (Merchant of Record, ADR-005) webhook.
#
# Fuente de verdad de la suscripción: el webhook de Paddle, nunca el cliente
# (el checkout en sí ocurre client-side vía Paddle.js — ver src/app/
# facturacion/page.js — pero solo este webhook, con el body firmado por
# Paddle y verificado con PADDLE_WEBHOOK_SECRET, puede promover una
# organización a plan 'pro'). El checkout pasa `customData: { orgId }` para
# que este webhook sepa a qué organización aplicar el cambio.
#
# PADDLE_WEBHOOK_SECRET vive en Secret Manager (mismo patrón que
# TELEGRAM_BOT_TOKEN) — configurar con:
#   firebase functions:secrets:set PADDLE_WEBHOOK_SECRET
# (ejecutar en tu propia terminal; el valor nunca debe pegarse en el chat).
# ══════════════════════════════════════════════════════════════════════════

_PADDLE_MAX_SIGNATURE_AGE_SECONDS = 300  # 5 min — evita repetir un payload capturado/filtrado


def _verify_paddle_signature(signature_header: str, raw_body: bytes, secret: str) -> bool:
    if not signature_header or not secret:
        return False
    try:
        parts = dict(p.split('=', 1) for p in signature_header.split(';') if '=' in p)
    except ValueError:
        return False
    ts = parts.get('ts')
    h1 = parts.get('h1')
    if not ts or not h1:
        return False
    try:
        age = abs(time.time() - int(ts))
    except ValueError:
        return False
    if age > _PADDLE_MAX_SIGNATURE_AGE_SECONDS:
        return False
    signed_payload = f'{ts}:'.encode('utf-8') + raw_body
    computed = hmac.new(secret.encode('utf-8'), signed_payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, h1)


@https_fn.on_request(region='us-central1', secrets=['PADDLE_WEBHOOK_SECRET'])
def paddle_webhook(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)

    secret = os.environ.get('PADDLE_WEBHOOK_SECRET', '')
    if not _verify_paddle_signature(req.headers.get('Paddle-Signature', ''), req.get_data(), secret):
        return https_fn.Response('Invalid signature', status=401)

    payload = req.get_json(silent=True) or {}
    event_type = payload.get('event_type', '')
    data = payload.get('data') or {}
    org_id = (data.get('custom_data') or {}).get('orgId')

    if not org_id:
        # Evento de Paddle sin orgId asociado (no debería pasar si el
        # checkout siempre manda customData) — no es un error, solo no hay
        # nada que actualizar.
        return https_fn.Response('ok', status=200)

    db = fb_firestore.client()
    org_ref = db.collection('organizations').document(org_id)

    if not org_ref.get().exists:
        # orgId del checkout no corresponde a ninguna organización real (org
        # borrada, dato corrupto, o un customData desactualizado) — no crear
        # un documento a medias, solo registrar y devolver 200 para que
        # Paddle no reintente indefinidamente un evento que nunca va a poder
        # aplicarse.
        print(f'paddle_webhook: orgId "{org_id}" no existe, evento {event_type} ignorado')
        return https_fn.Response('ok', status=200)

    if event_type in ('subscription.created', 'subscription.updated', 'subscription.activated', 'subscription.resumed'):
        billing_period = data.get('current_billing_period') or {}
        billing_cycle = data.get('billing_cycle') or {}
        org_ref.set({
            'plan': 'pro',
            'status': 'active',
            'limits': _PRO_PLAN_LIMITS,
            'subscription': {
                'provider': 'paddle',
                'externalId': data.get('id'),
                'currentPeriodEnd': billing_period.get('ends_at'),
                'cycle': billing_cycle.get('interval'),
            },
            'updatedAt': fb_firestore.SERVER_TIMESTAMP,
        }, merge=True)
    elif event_type in ('subscription.canceled', 'subscription.paused'):
        # No se revierten los límites automáticamente (evita cortar en
        # caliente antes de fin de periodo ya pagado) — solo se marca el
        # estado para que el Administrador de Plataforma revise el caso.
        org_ref.set({
            'status': 'canceled',
            'updatedAt': fb_firestore.SERVER_TIMESTAMP,
        }, merge=True)

    return https_fn.Response('ok', status=200)