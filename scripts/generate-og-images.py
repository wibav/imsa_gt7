"""
Genera imágenes OG 1200×630 para cada sección del sitio GT7 ESP Racing Club.
Usa el logo como elemento central sobre un fondo con gradiente y texto descriptivo.
"""
from PIL import Image, ImageDraw, ImageFont
import os

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')
LOGO_PATH = os.path.join(PUBLIC_DIR, 'logo_gt7.png')

WIDTH, HEIGHT = 1200, 630

SECTIONS = [
    {
        'filename': 'og-image.png',
        'title': 'GT7 Championships',
        'subtitle': 'Dashboard de campeonatos y resultados',
        'bg_top': (15, 23, 42),       # slate-900
        'bg_bottom': (30, 41, 59),     # slate-800
        'accent': (59, 130, 246),      # blue-500
    },
    {
        'filename': 'og-championships.png',
        'title': 'CAMPEONATOS',
        'subtitle': 'Clasificaciones, resultados y estadísticas',
        'bg_top': (12, 18, 32),
        'bg_bottom': (26, 39, 68),
        'accent': (245, 158, 11),      # amber-500
    },
    {
        'filename': 'og-pilots.png',
        'title': 'ÁREA DE PILOTOS',
        'subtitle': 'Perfiles, rendimiento e historial',
        'bg_top': (15, 23, 42),
        'bg_bottom': (22, 32, 50),
        'accent': (16, 185, 129),      # emerald-500
    },
    {
        'filename': 'og-reglamento.png',
        'title': 'REGLAMENTO OFICIAL',
        'subtitle': 'Normativa, sanciones y procedimientos',
        'bg_top': (24, 10, 46),
        'bg_bottom': (30, 17, 69),
        'accent': (168, 85, 247),      # purple-500
    },
    {
        'filename': 'og-tools.png',
        'title': 'CREADOR DE VINILOS',
        'subtitle': 'Convierte imágenes a SVG para GT7',
        'bg_top': (26, 10, 10),
        'bg_bottom': (45, 21, 21),
        'accent': (239, 68, 68),       # red-500
    },
    {
        'filename': 'og-events.png',
        'title': 'EVENTOS',
        'subtitle': 'Calendario, carreras especiales e inscripciones',
        'bg_top': (10, 20, 30),
        'bg_bottom': (20, 40, 60),
        'accent': (251, 146, 60),      # orange-400
    },
]


def lerp_color(c1, c2, t):
    """Interpola linealmente entre dos colores RGB."""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def draw_gradient(draw, width, height, top_color, bottom_color):
    """Dibuja un gradiente vertical."""
    for y in range(height):
        color = lerp_color(top_color, bottom_color, y / height)
        draw.line([(0, y), (width, y)], fill=color)


def generate_og_image(section):
    img = Image.new('RGB', (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)

    # Gradiente de fondo
    draw_gradient(draw, WIDTH, HEIGHT, section['bg_top'], section['bg_bottom'])

    accent = section['accent']

    # Barras de acento superiores e inferiores
    draw.rectangle([0, 0, WIDTH, 5], fill=accent)
    draw.rectangle([0, HEIGHT - 5, WIDTH, HEIGHT], fill=accent)

    # Líneas decorativas sutiles (grid)
    grid_color = (*accent, 15)  # Muy transparente
    for x in [300, 600, 900]:
        draw.line([(x, 0), (x, HEIGHT)], fill=(*accent[:3],), width=1)
    for y in [157, 315, 473]:
        draw.line([(0, y), (WIDTH, y)], fill=(*accent[:3],), width=1)

    # Hacer las líneas del grid más tenues pintando encima con el fondo
    overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    for x in [300, 600, 900]:
        overlay_draw.line([(x, 0), (x, HEIGHT)], fill=(*accent, 12), width=1)
    for y in [157, 315, 473]:
        overlay_draw.line([(0, y), (WIDTH, y)], fill=(*accent, 12), width=1)

    # Círculo decorativo grande (fondo)
    circle_overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    circle_draw = ImageDraw.Draw(circle_overlay)
    cx, cy, r = 900, 315, 250
    circle_draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(*accent, 10))
    r2 = 180
    circle_draw.ellipse([cx-r2, cy-r2, cx+r2, cy+r2], fill=(*accent, 8))
    img.paste(Image.alpha_composite(Image.new('RGBA', (WIDTH, HEIGHT), (0,0,0,0)), circle_overlay).convert('RGB'),
              mask=circle_overlay.split()[3])

    # Logo — redimensionado y centrado a la derecha
    try:
        logo = Image.open(LOGO_PATH).convert('RGBA')
        logo_size = 220
        logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
        logo_x = WIDTH - logo_size - 80
        logo_y = (HEIGHT - logo_size) // 2
        # Crear fondo temporal para el logo
        img_rgba = img.convert('RGBA')
        img_rgba.paste(logo, (logo_x, logo_y), logo)
        img = img_rgba.convert('RGB')
        draw = ImageDraw.Draw(img)
    except Exception as e:
        print(f"  [warning] No se pudo insertar logo: {e}")

    # Fuentes — intentar system fonts, fallback a default
    title_size = 52
    subtitle_size = 24
    brand_size = 18
    url_size = 15

    try:
        # macOS system fonts
        title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", title_size)
        subtitle_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", subtitle_size)
        brand_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", brand_size)
        url_font = ImageFont.truetype("/Library/Fonts/Courier New.ttf", url_size)
    except (IOError, OSError):
        try:
            title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", title_size)
            subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", subtitle_size)
            brand_font = subtitle_font
            url_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", url_size)
        except (IOError, OSError):
            title_font = ImageFont.load_default()
            subtitle_font = title_font
            brand_font = title_font
            url_font = title_font

    # Título principal
    draw.text((90, 220), section['title'], fill='white', font=title_font)

    # Subtítulo
    draw.text((90, 290), section['subtitle'], fill=(255, 255, 255, 166), font=subtitle_font)

    # Línea divisoria de acento
    draw.rectangle([90, 335, 260, 338], fill=(*accent,))

    # Brand footer
    draw.text((90, 490), "IMSA", fill=(255, 255, 255, 128), font=brand_font)
    draw.text((140, 490), "GT7 ESP Racing Club", fill=(255, 255, 255, 90), font=brand_font)

    # URL
    draw.text((90, 520), "imsa.trenkit.com", fill=(*accent,), font=url_font)

    # Guardar
    dest = os.path.join(PUBLIC_DIR, section['filename'])
    img.save(dest, 'PNG', optimize=True)
    size_kb = os.path.getsize(dest) / 1024
    print(f"  ✓ {section['filename']} ({WIDTH}×{HEIGHT}, {size_kb:.0f} KB)")


def main():
    print("[generate-og] Generando imágenes OG 1200×630...")
    if not os.path.exists(LOGO_PATH):
        print(f"  ✗ Logo no encontrado: {LOGO_PATH}")
        return

    for section in SECTIONS:
        generate_og_image(section)

    print(f"[generate-og] {len(SECTIONS)} imágenes generadas en public/")


if __name__ == '__main__':
    main()
