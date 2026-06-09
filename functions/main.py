from __future__ import annotations

import json
import re
import traceback as tb
from io import BytesIO

from firebase_functions import https_fn
from PIL import Image, ImageEnhance, ImageFilter, UnidentifiedImageError
import vtracer


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