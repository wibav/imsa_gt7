"""
Genera las imágenes OG 1200×630 que se ven al compartir un enlace del sitio
(Telegram, WhatsApp, X…).

Sigue el mismo lenguaje visual que la web (ver DESIGN.md): fondo con el
gradiente diagonal slate-900 → blue-900 → slate-800 y el acento naranja→rojo
de los botones principales, en vez de la paleta suelta de verdes, ámbares y
morados que tenía antes y que no salía de ninguna parte del diseño.

Notas de PIL que costaron un rato:
  - `draw.text(..., fill=(r,g,b,a))` sobre una imagen RGB IGNORA el alfa. Para
    tener texto atenuado hay que pintar en una capa RGBA y componer.
  - Lo mismo con las líneas: dibujarlas directamente salía opaco. La versión
    anterior construía una capa con alfa 12 y se olvidaba de componerla, así
    que el grid se veía como líneas duras de color.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')
# El escudo GT7 ESP. El logo antiguo (logo_gt7.png) era blanco con textura y
# apenas se distinguía en la vista previa de WhatsApp. Este sale del PNG con
# el fondo quitado, con el interior blanco reconstruido: la herramienta de
# recorte se había llevado también la placa de "CHAMPIONSHIP" y las franjas.
LOGO_PATH = os.path.join(PUBLIC_DIR, 'logo_gt7_esp.png')

WIDTH, HEIGHT = 1200, 630

# Paleta de la web (tailwind slate/blue + CTA naranja→rojo).
SLATE_900 = (15, 23, 42)
BLUE_900 = (30, 58, 138)
SLATE_800 = (30, 41, 59)
ORANGE_600 = (234, 88, 12)
RED_600 = (220, 38, 38)

SECTIONS = [
    {
        'filename': 'og-image.png',
        'title': 'GT7 CHAMPIONSHIPS',
        'subtitle': 'Campeonatos, eventos y resultados',
    },
    {
        'filename': 'og-championships.png',
        'title': 'CAMPEONATOS',
        'subtitle': 'Clasificaciones, resultados y estadísticas',
    },
    {
        'filename': 'og-pilots.png',
        'title': 'ÁREA DE PILOTOS',
        'subtitle': 'Perfiles, rendimiento e historial',
    },
    {
        'filename': 'og-reglamento.png',
        'title': 'REGLAMENTO OFICIAL',
        'subtitle': 'Normativa, sanciones y procedimientos',
    },
    {
        'filename': 'og-tools.png',
        'title': 'CREADOR DE VINILOS',
        'subtitle': 'Convierte imágenes a SVG para GT7',
    },
    {
        'filename': 'og-events.png',
        'title': 'EVENTOS',
        'subtitle': 'Calendario, carreras especiales e inscripciones',
    },
]


def lerp(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def gradiente_diagonal(width, height):
    """
    Reproduce `bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800`.

    Se calcula en pequeño —un píxel por celda, con t = (x/w + y/h)/2, que es
    justo la diagonal de CSS— y se escala con LANCZOS. Interpolar dos pases,
    uno vertical y otro horizontal, no da un diagonal: lava el resultado y se
    pierde el arranque oscuro que caracteriza al fondo de la web.
    """
    pequeno = Image.new('RGB', (64, 34))
    px = pequeno.load()
    for y in range(34):
        for x in range(64):
            px[x, y] = _color_en((x / 63 + y / 33) / 2)
    return pequeno.resize((width, height), Image.LANCZOS)


def _color_en(t):
    """Color del gradiente en t∈[0,1]: slate-900 → blue-900 → slate-800."""
    if t < 0.5:
        return lerp(SLATE_900, BLUE_900, t / 0.5)
    return lerp(BLUE_900, SLATE_800, (t - 0.5) / 0.5)


def barra_cta(width, alto):
    """Franja con el gradiente naranja→rojo de los botones principales."""
    barra = Image.new('RGB', (width, alto))
    d = ImageDraw.Draw(barra)
    for x in range(width):
        d.line([(x, 0), (x, alto)], fill=lerp(ORANGE_600, RED_600, x / width))
    return barra


def cargar_fuentes():
    """
    La web usa Inter (next/font). No está en el sistema, así que se cae a la
    sans-serif más parecida que haya. Se prueban rutas de macOS y de Linux
    para que el build dé el mismo resultado en CI.
    """
    candidatos_bold = [
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        '/System/Library/Fonts/HelveticaNeue.ttc',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]
    candidatos_regular = [
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]

    def primera(rutas, tam):
        for r in rutas:
            try:
                return ImageFont.truetype(r, tam)
            except (IOError, OSError):
                continue
        return ImageFont.load_default()

    return {
        'titulo': primera(candidatos_bold, 58),
        'subtitulo': primera(candidatos_regular, 26),
        'marca': primera(candidatos_bold, 20),
        'url': primera(candidatos_regular, 18),
    }


def generate_og_image(section, fuentes):
    img = gradiente_diagonal(WIDTH, HEIGHT).convert('RGBA')

    # ── Halo naranja detrás del logo ──
    # Va en su propia capa y desenfocado: una elipse de alfa plano deja un
    # borde duro que se ve como un disco pegado, no como el resplandor difuso
    # que tienen los botones de la web.
    halo = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    h = ImageDraw.Draw(halo)
    cx, cy = 930, 315
    for radio, alfa in ((260, 18), (170, 22), (100, 26)):
        h.ellipse([cx - radio, cy - radio, cx + radio, cy + radio], fill=(*ORANGE_600, alfa))
    halo = halo.filter(ImageFilter.GaussianBlur(90))
    img = Image.alpha_composite(img, halo)

    # ── Rejilla ──
    # Nítida, en capa aparte para que no la toque el desenfoque. Sugiere la
    # cuadrícula de las tarjetas sin competir con el texto; blanca y no del
    # color de acento, para no ensuciar el fondo.
    rejilla = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    r = ImageDraw.Draw(rejilla)
    for x in range(200, WIDTH, 200):
        r.line([(x, 0), (x, HEIGHT)], fill=(255, 255, 255, 10), width=1)
    for y in range(126, HEIGHT, 126):
        r.line([(0, y), (WIDTH, y)], fill=(255, 255, 255, 10), width=1)
    img = Image.alpha_composite(img, rejilla)

    # ── Barras de acento arriba y abajo, con el gradiente de los CTA ──
    img.paste(barra_cta(WIDTH, 6), (0, 0))
    img.paste(barra_cta(WIDTH, 6), (0, HEIGHT - 6))

    # ── Logo ──
    # Conserva la proporción (el escudo es más alto que ancho; forzarlo a un
    # cuadrado lo achataba) y va centrado sobre el halo.
    try:
        logo = Image.open(LOGO_PATH).convert('RGBA')
        logo.thumbnail((380, 380), Image.LANCZOS)
        img.alpha_composite(logo, (cx - logo.width // 2, cy - logo.height // 2))
    except Exception as e:
        print(f"  [aviso] No se pudo insertar el logo: {e}")

    # ── Texto, en capa aparte para que el alfa funcione ──
    capa = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    t = ImageDraw.Draw(capa)

    t.text((90, 232), section['title'], fill=(255, 255, 255, 255), font=fuentes['titulo'])
    t.text((90, 306), section['subtitle'], fill=(255, 255, 255, 170), font=fuentes['subtitulo'])

    img = Image.alpha_composite(img, capa)

    # Divisoria con el gradiente del CTA, como el subrayado de la web.
    img.paste(barra_cta(180, 4), (90, 358))

    pie = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    p = ImageDraw.Draw(pie)
    p.text((90, 494), "GT7 CHAMPIONSHIPS", fill=(255, 255, 255, 120), font=fuentes['marca'])
    p.text((90, 524), "imsa.trenkit.com", fill=(*ORANGE_600, 220), font=fuentes['url'])
    img = Image.alpha_composite(img, pie)

    dest = os.path.join(PUBLIC_DIR, section['filename'])
    img.convert('RGB').save(dest, 'PNG', optimize=True)
    print(f"  ✓ {section['filename']} ({WIDTH}×{HEIGHT}, {os.path.getsize(dest) / 1024:.0f} KB)")


def main():
    print("[generate-og] Generando imágenes OG 1200×630...")
    if not os.path.exists(LOGO_PATH):
        print(f"  ✗ Logo no encontrado: {LOGO_PATH}")
        return

    fuentes = cargar_fuentes()
    for section in SECTIONS:
        generate_og_image(section, fuentes)

    print(f"[generate-og] {len(SECTIONS)} imágenes generadas en public/")


if __name__ == '__main__':
    main()
