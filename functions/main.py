from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import time
import traceback as tb
from datetime import datetime, timezone
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


def _send_telegram_message(text: str) -> bool:
    """Helper interno reusable por cualquier Cloud Function que declare el
    secreto TELEGRAM_BOT_TOKEN — a diferencia de `notify` (endpoint HTTP para
    el cliente), esto se llama directo desde Python, sin round-trip HTTP.
    Best-effort: nunca lanza, solo devuelve si se pudo enviar o no."""
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_CHAT_ID', _DEFAULT_CHAT_ID)
    if not token:
        return False
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
            return 200 <= resp.status < 300
    except Exception:
        return False


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


@https_fn.on_request(region='us-central1', secrets=['TELEGRAM_BOT_TOKEN'])
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

    # ── Buscar el usuario en Firebase Auth, o crearlo si se le está
    # asignando un rol por primera vez (antes esto se rechazaba pidiendo que
    # el usuario ya hubiera iniciado sesión — ahora se crea la cuenta con una
    # contraseña aleatoria que nunca se expone, y el cliente le manda un
    # correo de restablecimiento para que la defina él mismo en su primer
    # acceso, ver src/app/usersAdmin/page.js). Al limpiar un rol (role=None)
    # sobre un email inexistente no tiene sentido crear la cuenta.
    created = False
    try:
        target_user = fb_auth.get_user_by_email(target_email)
    except fb_auth.UserNotFoundError:
        if not role:
            return _role_json({'ok': False, 'error': 'No existe una cuenta con ese email'}, 404)
        random_password = secrets.token_urlsafe(24)
        target_user = fb_auth.create_user(email=target_email, password=random_password, email_verified=False)
        created = True

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

    if created:
        org_snap = db.collection('organizations').document(org_id).get()
        org_name = org_snap.to_dict().get('name', org_id) if org_snap.exists else org_id
        role_labels = {'organizador': 'Organizador', 'director_liga': 'Director de liga', 'comisario': 'Comisario'}
        _send_telegram_message(
            f'👤 <b>Cuenta nueva creada</b>\n'
            f'🏢 {org_name}\n'
            f'✉️ {target_email}\n'
            f'🔖 Rol: {role_labels.get(role, role)}\n'
            f'📧 Se le envió un correo para definir su contraseña.'
        )

    return _role_json({'ok': True, 'created': created})


# ══════════════════════════════════════════════════════════════════════════
# Límites de plan — modelo de lotes prepagados (ADR-007, reemplaza la
# suscripción recurrente).
#
# Cada organización tiene un saldo `championshipCredits`: se descuenta 1 al
# crear un campeonato o evento, hasta llegar a 0 (ahí `firestore.rules`
# deniega nuevas creaciones — `canCreateInOrg`). El plan Free arranca con 1
# crédito (su prueba única); los planes de pago recargan el saldo al comprar
# un lote (webhook de Paddle, aún no implementado — hasta entonces, el
# Administrador de Plataforma puede otorgar créditos manualmente desde
# /organizacionesAdmin). El cliente no puede tocar `championshipCredits`
# directamente (firestore.rules solo permite platformOwner) — el descuento
# lo hace esta Cloud Function con Admin SDK, al detectar la creación.
# ══════════════════════════════════════════════════════════════════════════

def _consume_championship_credit_if_needed(org_id: str | None) -> None:
    if not org_id:
        return
    db = fb_firestore.client()
    org_ref = db.collection('organizations').document(org_id)
    org_snap = org_ref.get()
    if not org_snap.exists:
        return
    org = org_snap.to_dict() or {}
    if org.get('billingExempt'):
        return
    if org.get('championshipCredits', 0) > 0:
        org_ref.update({
            'championshipCredits': fb_firestore.Increment(-1),
            'updatedAt': fb_firestore.SERVER_TIMESTAMP,
        })


@firestore_fn.on_document_created(document='championships/{champId}')
def on_championship_created(event: firestore_fn.Event) -> None:
    data = event.data.to_dict() if event.data else {}
    _consume_championship_credit_if_needed(data.get('orgId'))


@firestore_fn.on_document_created(document='events/{eventId}')
def on_event_created(event: firestore_fn.Event) -> None:
    data = event.data.to_dict() if event.data else {}
    _consume_championship_credit_if_needed(data.get('orgId'))


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
    'equipamientoadmin', 'organizacionesadmin', 'organizacionadmin',
    'facturacion',
}

_SLUG_RE = re.compile(r'^[a-z0-9-]+$')

# `maxActiveChampionshipsOrEvents` ya no aplica (modelo de lotes prepagados,
# ADR-007): cuántos campeonatos/eventos puede crear una org lo determina su
# saldo `championshipCredits`, no un tope fijo por plan. Estos límites solo
# cubren lo que sí sigue dependiendo del tier (pilotos, administradores).
#
# Fuente única: planLimits.json (junto a este archivo, se despliega con la
# función) — también lo importa src/app/services/firebaseService.js para el
# otorgamiento manual de planes. Antes vivían duplicados a mano en Python y
# JS con solo un comentario pidiendo mantenerlos en sync.
with open(os.path.join(os.path.dirname(__file__), 'planLimits.json')) as _plan_limits_file:
    _PLAN_LIMITS = json.load(_plan_limits_file)

_FREE_PLAN_LIMITS = _PLAN_LIMITS['free']
_STARTER_PLAN_LIMITS = _PLAN_LIMITS['starter']
_PRO_PLAN_LIMITS = _PLAN_LIMITS['pro']
_PRO_IA_PLAN_LIMITS = _PLAN_LIMITS['pro_ia']

# ══════════════════════════════════════════════════════════════════════════
# Catálogo de precios de Paddle → qué desbloquea cada uno.
#
# Los `price_id` son públicos (no son secretos, van también en el frontend
# como NEXT_PUBLIC_PADDLE_PRICE_ID_*), así que viven hardcodeados aquí igual
# que el resto de constantes de negocio del archivo. Creados en Paddle LIVE
# (producción, no sandbox) el 2026-07-24 vía API — 3 precios "Recurring"
# (planes mensuales) + 3 "One-time" (lotes de créditos), todos en EUR.
#
# _PADDLE_PRICE_PLANS: precios recurrentes → (plan, límites, incluye IA)
_PADDLE_PRICE_PLANS = {
    'pri_01kyarfmr6whk90ts5cfqfmr2j': ('starter', _STARTER_PLAN_LIMITS, False),
    'pri_01kyarfnbfhwjp4x4zcvnefnf1': ('pro', _PRO_PLAN_LIMITS, False),
    'pri_01kyarfnyt8tgqdm2ym7yg0c28': ('pro_ia', _PRO_IA_PLAN_LIMITS, True),
}

# _PADDLE_PRICE_CREDITS: precios de pago único → créditos de campeonatos/eventos
_PADDLE_PRICE_CREDITS = {
    'pri_01kyarf59chkh2bawqd6hm62ze': 1,
    'pri_01kyarf5wxwys80vkb1n5m7fbq': 5,
    'pri_01kyarf6gyp1bt7d9td4bhss3j': 10,
}

# ── BLOQUE TEMPORAL DE PRUEBAS EN SANDBOX (borrar cuando se termine de
# validar el flujo antes de pasar a Live) ───────────────────────────────────
# Un solo `paddle_webhook` recibe eventos de Live y de Sandbox (ver
# PADDLE_WEBHOOK_SECRET_SANDBOX más abajo), pero cada entorno tiene su propio
# catálogo de price_id — sin este bloque, un evento de Sandbox llega con la
# firma válida pero con un price_id que no está en el catálogo de Live, y se
# ignora en silencio (200 ok, sin aplicar nada). Réplica del mismo catálogo
# de arriba con los price_id creados en sandbox-api.paddle.com.
_PADDLE_PRICE_PLANS.update({
    'pri_01kyavjdt8y8acwjny00dvqv59': ('starter', _STARTER_PLAN_LIMITS, False),
    'pri_01kyavjejpfcjjrfcqcd5dbt5a': ('pro', _PRO_PLAN_LIMITS, False),
    'pri_01kyavjf8bx9cbdem8c8sq1bny': ('pro_ia', _PRO_IA_PLAN_LIMITS, True),
})
_PADDLE_PRICE_CREDITS.update({
    'pri_01kyavhxrja0jgg0r67r9vbw52': 1,
    'pri_01kyavhyd5rss1yms3xehc3tnk': 5,
    'pri_01kyavhyzyj3h4167z199gy5dx': 10,
})
# ── FIN BLOQUE TEMPORAL DE SANDBOX ──────────────────────────────────────────

# Tope de sugerencias de IA por organización/mes en plan 'pro_ia' — acota el
# coste variable de Gemini incluso dentro de un plan de pago (ver §9.4 de
# docs/PLAN_MONETIZACION.md). Ajustable a futuro por `org.limits.maxAiSuggestionsPerMonth`.
_AI_MONTHLY_CAP_DEFAULT = 80


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


@https_fn.on_request(region='us-central1', secrets=['TELEGRAM_BOT_TOKEN'])
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
            'championshipCredits': 1,  # prueba única — 1 campeonato o evento
            'billingExempt': False,
            'ownerUid': uid,
            'branding': {'logoUrl': None, 'colorPrimary': None, 'colorSecondary': None},
            'limits': _FREE_PLAN_LIMITS,
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

    _send_telegram_message(
        f'🆕 <b>Nueva organización creada</b>\n'
        f'🏢 {name} (<code>{slug}</code>)\n'
        f'✉️ {(caller_claims.get("email") or "").lower()}\n'
        f'🔗 trenkit.com/l/{slug}\n'
        f'💳 Plan: Free (prueba única)'
    )

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


@https_fn.on_request(
    region='us-central1',
    secrets=['PADDLE_WEBHOOK_SECRET', 'PADDLE_WEBHOOK_SECRET_SANDBOX', 'TELEGRAM_BOT_TOKEN'],
)
def paddle_webhook(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)

    # Un solo endpoint recibe eventos de Live Y de Sandbox (Sandbox se usa
    # para probar flujos con tarjetas de test antes de tocar Live real) —
    # cada entorno de Paddle firma con su propio secreto, así que se acepta
    # cualquiera de los dos. PADDLE_WEBHOOK_SECRET_SANDBOX solo existe
    # mientras se estén validando flujos nuevos; quitarlo del catálogo de
    # secrets si Sandbox deja de usarse.
    raw_body = req.get_data()
    signature_header = req.headers.get('Paddle-Signature', '')
    live_secret = os.environ.get('PADDLE_WEBHOOK_SECRET', '')
    sandbox_secret = os.environ.get('PADDLE_WEBHOOK_SECRET_SANDBOX', '')
    if not (
        _verify_paddle_signature(signature_header, raw_body, live_secret)
        or _verify_paddle_signature(signature_header, raw_body, sandbox_secret)
    ):
        return https_fn.Response('Invalid signature', status=401)

    payload = req.get_json(silent=True) or {}
    event_type = payload.get('event_type', '')
    data = payload.get('data') or {}
    org_id = (data.get('custom_data') or {}).get('orgId')

    # Log de diagnóstico: qué evento llegó y si trae orgId — visible en
    # Cloud Logging (gcloud logging read ... service_name="paddle-webhook").
    print(f'paddle_webhook: event_type={event_type!r} orgId={org_id!r} custom_data={data.get("custom_data")!r}')

    if not org_id:
        # Evento de Paddle sin orgId asociado (no debería pasar si el
        # checkout siempre manda customData) — no es un error, solo no hay
        # nada que actualizar.
        return https_fn.Response('ok', status=200)

    db = fb_firestore.client()
    org_ref = db.collection('organizations').document(org_id)
    org_snap = org_ref.get()

    if not org_snap.exists:
        # orgId del checkout no corresponde a ninguna organización real (org
        # borrada, dato corrupto, o un customData desactualizado) — no crear
        # un documento a medias, solo registrar y devolver 200 para que
        # Paddle no reintente indefinidamente un evento que nunca va a poder
        # aplicarse.
        print(f'paddle_webhook: orgId "{org_id}" no existe, evento {event_type} ignorado')
        return https_fn.Response('ok', status=200)

    org_name = org_snap.to_dict().get('name', org_id)

    if event_type in ('subscription.created', 'subscription.updated', 'subscription.activated', 'subscription.resumed'):
        # Un item de la suscripción trae el price.id que compró — se resuelve
        # contra el catálogo para saber qué plan/límites/IA corresponde.
        items = data.get('items') or []
        price_id = next((it.get('price', {}).get('id') for it in items if it.get('price')), None)
        price_match = _PADDLE_PRICE_PLANS.get(price_id)

        if price_match is None:
            # price.id desconocido (precio rotado, typo en el catálogo, o un
            # tipo de precio nuevo aún no añadido) — NO se toca plan/limits/
            # aiEnabled. Este evento dispara en cada renovación, así que
            # "caer" a un plan por defecto sobrescribiría silenciosamente el
            # plan real de la organización (ej. degradar un pro_ia pagado a
            # pro sin avisar). Se registra y se alerta para revisión manual.
            print(f'paddle_webhook: price_id desconocido {price_id!r} en {event_type} para org "{org_id}" — no se actualiza el plan')
            _send_telegram_message(
                f'⚠️ <b>price_id desconocido en webhook de Paddle</b>\n'
                f'🏢 {org_name}\n'
                f'🔖 price_id: {price_id or "—"}\n'
                f'👉 El plan de la organización NO se actualizó — revisar _PADDLE_PRICE_PLANS.'
            )
            return https_fn.Response('ok', status=200)

        plan, plan_limits, ai_enabled = price_match

        billing_period = data.get('current_billing_period') or {}
        billing_cycle = data.get('billing_cycle') or {}
        prev = org_snap.to_dict()
        was_same_plan_already = prev.get('plan') == plan

        # Si la organización ya compró algún lote de créditos alguna vez
        # (creditsPurchased), el límite de pilotos queda eliminado
        # permanentemente — no se reintroduce al cambiar de plan mensual.
        limits = dict(plan_limits)
        if prev.get('creditsPurchased'):
            limits.pop('maxDrivers', None)

        org_ref.set({
            'plan': plan,
            'status': 'active',
            'limits': limits,
            'aiEnabled': ai_enabled,
            'subscription': {
                'provider': 'paddle',
                'externalId': data.get('id'),
                'priceId': price_id,
                'currentPeriodEnd': billing_period.get('ends_at'),
                'cycle': billing_cycle.get('interval'),
            },
            'updatedAt': fb_firestore.SERVER_TIMESTAMP,
        }, merge=True)
        if not was_same_plan_already:
            _send_telegram_message(
                f'💳 <b>Organización actualizada a {plan}</b> 🎉\n'
                f'🏢 {org_name}\n'
                f'📅 Próxima renovación: {billing_period.get("ends_at", "—")}\n'
                f'🔁 Ciclo: {billing_cycle.get("interval", "—")}'
            )
    elif event_type in ('subscription.canceled', 'subscription.paused'):
        # No se revierten los límites automáticamente (evita cortar en
        # caliente antes de fin de periodo ya pagado) — solo se marca el
        # estado para que el Administrador de Plataforma revise el caso.
        org_ref.set({
            'status': 'canceled',
            'updatedAt': fb_firestore.SERVER_TIMESTAMP,
        }, merge=True)
        _send_telegram_message(
            f'⚠️ <b>Suscripción {"cancelada" if event_type == "subscription.canceled" else "pausada"}</b>\n'
            f'🏢 {org_name}\n'
            f'👉 Revisar manualmente si corresponde revertir a plan Free.'
        )
    elif event_type in ('transaction.completed', 'transaction.paid'):
        # Compra de un lote de créditos (pago único, no una suscripción) —
        # suma championshipCredits según el price.id comprado. Un mismo
        # transaction_id puede llegar más de una vez (reintentos de Paddle),
        # así que se registra en `paddleProcessedTransactions/{id}` y se
        # ignora si ya se procesó, para no duplicar el abono.
        transaction_id = data.get('id')
        items = data.get('items') or []

        def _item_quantity(it):
            # `or 1` trataría una quantity explícita de 0 igual que una
            # ausente (0 or 1 == 1) — se distingue None (ausente, default 1)
            # de un 0 real (línea ajustada/con descuento total, cuenta como 0).
            quantity = it.get('quantity')
            return 1 if quantity is None else int(quantity)

        total_credits = sum(
            _PADDLE_PRICE_CREDITS.get(it.get('price', {}).get('id'), 0) * _item_quantity(it)
            for it in items if it.get('price')
        )
        if total_credits > 0 and transaction_id:
            processed_ref = db.collection('paddleProcessedTransactions').document(transaction_id)

            @fb_firestore.transactional
            def _grant_credits_tx(transaction):
                if processed_ref.get(transaction=transaction).exists:
                    return False
                transaction.set(processed_ref, {
                    'orgId': org_id,
                    'credits': total_credits,
                    'processedAt': fb_firestore.SERVER_TIMESTAMP,
                })
                # Comprar un lote elimina el límite de pilotos permanentemente
                # (a diferencia de los créditos, esto no se revierte al gastar
                # los créditos ni al cambiar de plan mensual — ver el chequeo
                # de `creditsPurchased` en el handler de subscription.* más
                # arriba). No aplica al crédito de prueba inicial del plan
                # Free (ese se otorga en create_organization, no aquí).
                transaction.update(org_ref, {
                    'championshipCredits': fb_firestore.Increment(total_credits),
                    'creditsPurchased': True,
                    'limits.maxDrivers': fb_firestore.DELETE_FIELD,
                    'updatedAt': fb_firestore.SERVER_TIMESTAMP,
                })
                return True

            granted = _grant_credits_tx(db.transaction())
            if granted:
                _send_telegram_message(
                    f'💳 <b>Lote de créditos comprado</b> 🎉\n'
                    f'🏢 {org_name}\n'
                    f'➕ {total_credits} campeonatos/eventos\n'
                    f'♾️ Límite de pilotos eliminado'
                )

    return https_fn.Response('ok', status=200)


# ══════════════════════════════════════════════════════════════════════════
# Sugerencia de resolución de reclamaciones — Gemini (analiza el video de
# evidencia por URL, sin descargarlo).
#
# Es una AYUDA, no un fallo automático: el comisario sigue siendo quien
# decide. Solo puede analizar evidencia de YouTube — Gemini soporta pasar
# una URL de YouTube directamente en el request (fileData.fileUri), sin
# necesidad de descargar/subir el video. Otros orígenes (Twitch, TikTok,
# etc., que sí aparecen en reclamaciones reales) se listan como omitidos.
#
# GEMINI_API_KEY vive en Secret Manager (mismo patrón que TELEGRAM_BOT_TOKEN
# y PADDLE_WEBHOOK_SECRET):
#   firebase functions:secrets:set GEMINI_API_KEY
# (ejecutar en tu propia terminal; el valor nunca debe pegarse en el chat).
# ══════════════════════════════════════════════════════════════════════════

_GEMINI_MODEL = 'gemini-3.6-flash'


def _is_youtube_url(url: str) -> bool:
    return 'youtube.com' in url or 'youtu.be' in url


@https_fn.on_request(region='us-central1', secrets=['GEMINI_API_KEY'], timeout_sec=120)
def suggest_claim_resolution(req: https_fn.Request) -> https_fn.Response:
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

    body = req.get_json(silent=True) or {}
    championship_id = (body.get('championshipId') or '').strip()
    claim_id = (body.get('claimId') or '').strip()
    if not championship_id or not claim_id:
        return _role_json({'ok': False, 'error': 'Falta championshipId o claimId'}, 400)

    db = fb_firestore.client()
    champ_ref = db.collection('championships').document(championship_id)
    champ_snap = champ_ref.get()
    if not champ_snap.exists:
        return _role_json({'ok': False, 'error': 'Campeonato no encontrado'}, 404)
    champ = champ_snap.to_dict()
    org_id = champ.get('orgId')

    caller_org_role = (caller_claims.get('orgs') or {}).get(org_id)
    caller_rank = _ROLE_RANK.get(caller_org_role, 0)
    if not caller_claims.get('platformOwner') and caller_rank < _ROLE_RANK['comisario']:
        return _role_json({'ok': False, 'error': 'Requiere rol de comisario en esta organización'}, 403)

    # Asignación por campeonato (ADR-009): un comisario (rango exacto, no
    # director_liga/organizador que ya pasan por encima) solo puede pedir
    # sugerencias en campeonatos a los que está asignado — igual que
    # canRefereeChamp() en firestore.rules. `comisarioUids` ausente/null =
    # sin restringir (legacy). Sin este chequeo, un comisario no asignado
    # podría gastar la cuota mensual de IA de la org en un campeonato que no
    # arbitra.
    if not caller_claims.get('platformOwner') and caller_rank < _ROLE_RANK['director_liga']:
        assigned = champ.get('comisarioUids')
        if assigned is not None and caller_claims['uid'] not in assigned:
            return _role_json({'ok': False, 'error': 'No estás asignado a este campeonato'}, 403)

    # Gemini tiene coste por llamada (facturado a nosotros, no al organizador),
    # así que esta función solo se sirve a organizaciones en el plan 'pro_ia'
    # (el tier superior que incluye IA — Starter y Pro "a secas" NO la
    # incluyen) o exentas de facturación. El chequeo de rol de arriba ya
    # exige comisario+, pero eso no basta: un comisario de una org sin ese
    # plan también queda bloqueado aquí.
    org_ref = db.collection('organizations').document(org_id) if org_id else None
    org_snap = org_ref.get() if org_ref else None
    org = org_snap.to_dict() if org_snap and org_snap.exists else {}
    is_billing_exempt = bool(org.get('billingExempt'))

    if not caller_claims.get('platformOwner') and not is_billing_exempt and not org.get('aiEnabled'):
        return _role_json({
            'ok': False,
            'error': 'La sugerencia con IA es parte del plan Pro + IA. '
                     'Actualiza el plan de tu organización en Facturación para usarla.',
        }, 402)

    # Tope de uso mensual — acota el coste de Gemini incluso dentro de un
    # plan de pago. billingExempt (GT7 ESP) no tiene tope, y platformOwner
    # tampoco consume el cupo de una organización ajena (mismo criterio que
    # el chequeo de plan de arriba). La transacción evita que dos llamadas
    # casi simultáneas se cuelen ambas justo en el límite (leer-comprobar-
    # incrementar no es atómico sin ella).
    if org_ref and not is_billing_exempt and not caller_claims.get('platformOwner'):
        cap = (org.get('limits') or {}).get('maxAiSuggestionsPerMonth', _AI_MONTHLY_CAP_DEFAULT)
        current_month = datetime.now(timezone.utc).strftime('%Y-%m')

        @fb_firestore.transactional
        def _check_and_bump_ai_usage(transaction):
            snap = org_ref.get(transaction=transaction)
            usage = (snap.to_dict() or {}).get('aiUsage') or {}
            count = usage.get('count', 0) if usage.get('month') == current_month else 0
            if count >= cap:
                return False
            transaction.set(org_ref, {
                'aiUsage': {'month': current_month, 'count': count + 1},
                'updatedAt': fb_firestore.SERVER_TIMESTAMP,
            }, merge=True)
            return True

        if not _check_and_bump_ai_usage(db.transaction()):
            return _role_json({
                'ok': False,
                'error': f'Se alcanzó el límite de {cap} sugerencias de IA este mes para tu organización. '
                         'Vuelve a intentarlo el próximo mes, o contacta al Administrador de Plataforma.',
            }, 429)

    claim_snap = champ_ref.collection('claims').document(claim_id).get()
    if not claim_snap.exists:
        return _role_json({'ok': False, 'error': 'Reclamación no encontrada'}, 404)
    claim = claim_snap.to_dict()

    evidence = claim.get('evidence') or []
    if isinstance(evidence, str):
        evidence = [evidence] if evidence else []
    youtube_urls = [u for u in evidence if u and _is_youtube_url(u)]
    skipped_urls = [u for u in evidence if u and not _is_youtube_url(u)]

    if not youtube_urls:
        return _role_json({
            'ok': False,
            'error': 'No hay ningún video de YouTube en la evidencia de esta reclamación — Gemini solo puede '
                     'analizar videos de YouTube por URL directa.',
            'skippedUrls': skipped_urls,
        }, 422)

    accused = ', '.join(claim.get('accusedNames') or ([claim.get('accusedName')] if claim.get('accusedName') else []))
    prompt_lines = [
        'Eres un asistente para comisarios de una liga de sim racing de Gran Turismo 7. '
        'Analiza el/los video(s) del incidente reportado y da una SUGERENCIA de resolución — '
        'no un fallo definitivo, la decisión final la toma siempre el comisario humano.',
        '',
        f'Reclamante: {claim.get("reporterName") or "?"}',
        f'Piloto(s) infractor(es): {accused or "?"}',
        f'Carrera: {claim.get("trackName") or "?"} (ronda {claim.get("round") or "?"})',
    ]
    if claim.get('lap'):
        prompt_lines.append(f'Vuelta reportada: {claim["lap"]}')
    if claim.get('minute'):
        prompt_lines.append(f'Minuto reportado: {claim["minute"]}')
    prompt_lines += [
        f'Descripción del reclamante: {claim.get("description") or ""}',
        '',
        'Responde en español, en máximo 150 palabras, con este formato:',
        '1) Qué se observa en el video (momento aproximado del incidente).',
        '2) Si parece un incidente de carrera, error de un piloto, o conducción peligrosa/evitable.',
        '3) Sugerencia de resolución (aceptar o rechazar la reclamación) y, si aplica, '
        'severidad orientativa (leve/moderada/grave).',
    ]
    prompt = '\n'.join(prompt_lines)

    parts = [{'text': prompt}] + [{'fileData': {'fileUri': u}} for u in youtube_urls]

    api_key = os.environ.get('GEMINI_API_KEY', '')
    if not api_key:
        return _role_json({'ok': False, 'error': 'GEMINI_API_KEY no configurada en Secret Manager'}, 500)

    gemini_url = (
        f'https://generativelanguage.googleapis.com/v1beta/models/{_GEMINI_MODEL}:generateContent'
        f'?key={api_key}'
    )
    payload = json.dumps({'contents': [{'parts': parts}]}).encode('utf-8')
    gemini_req = urllib.request.Request(
        gemini_url, data=payload, headers={'Content-Type': 'application/json'}, method='POST'
    )
    try:
        with urllib.request.urlopen(gemini_req, timeout=100) as resp:
            result = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', errors='ignore')
        return _role_json({'ok': False, 'error': f'Error de Gemini ({e.code}): {detail[:300]}'}, 502)
    except Exception as e:
        return _role_json({'ok': False, 'error': f'Error llamando a Gemini: {e}'}, 502)

    try:
        suggestion = result['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError, TypeError):
        return _role_json({'ok': False, 'error': 'Respuesta inesperada de Gemini', 'raw': result}, 502)

    return _role_json({
        'ok': True,
        'suggestion': suggestion.strip(),
        'analyzedUrls': youtube_urls,
        'skippedUrls': skipped_urls,
    })