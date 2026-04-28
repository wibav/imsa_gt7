from __future__ import annotations

import json
import re
import traceback as tb
from io import BytesIO

from firebase_functions import https_fn
from PIL import Image, UnidentifiedImageError
import vtracer


SVG_SIZE_LIMIT_BYTES = 15 * 1024
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

    # Intentos ordenados de menor a mayor agresividad:
    # (path_precision, filter_speckle, color_precision, max_dim)
    DIMS = [None, 256, 192, 128, 96]
    attempts = []
    for dim in DIMS:
        for precision in ([requested_precision] if requested_precision == 1 else [requested_precision, 1]):
            for speckle in [base_speckle, min(base_speckle + 4, 16), 16]:
                for color in [base_color, max(base_color - 1, 4), 4]:
                    attempts.append((precision, speckle, color, dim))

    # Deduplicar manteniendo orden
    seen = set()
    unique_attempts = []
    for a in attempts:
        if a not in seen:
            seen.add(a)
            unique_attempts.append(a)

    svg_text       = ''
    used_precision = requested_precision
    used_speckle   = base_speckle
    used_color     = base_color
    used_dim       = None

    original_image = Image.open(BytesIO(image_bytes))

    for precision, speckle, color, dim in unique_attempts:
        if dim is not None:
            img = original_image.copy()
            img.thumbnail((dim, dim), Image.LANCZOS)
        else:
            img = original_image

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
        svg_text       = _minify_svg(svg_candidate)
        used_precision = precision
        used_speckle   = speckle
        used_color     = color
        used_dim       = dim
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

    try:
        image = Image.open(BytesIO(file_bytes))
        image.load()
    except UnidentifiedImageError:
        return _json_response({'error': 'The uploaded file is not a valid image.'}, status_code=400)

    if image.mode != 'RGBA':
        image = image.convert('RGBA')

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