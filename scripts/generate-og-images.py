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
        'motivo': 'trofeo',
        'title': 'CAMPEONATOS',
        'subtitle': 'Clasificaciones, resultados y estadísticas',
    },
    {
        'filename': 'og-pilots.png',
        'motivo': 'volante',
        'title': 'ÁREA DE PILOTOS',
        'subtitle': 'Perfiles, rendimiento e historial',
    },
    {
        'filename': 'og-reglamento.png',
        'motivo': 'reglamento',
        'title': 'REGLAMENTO OFICIAL',
        'subtitle': 'Normativa, sanciones y procedimientos',
    },
    {
        'filename': 'og-tools.png',
        'motivo': 'vinilo',
        'title': 'CREADOR DE VINILOS',
        'subtitle': 'Convierte imágenes a SVG para GT7',
    },
    {
        'filename': 'og-equipos.png',
        'motivo': 'equipo',
        'title': 'EQUIPOS',
        'subtitle': 'Los equipos de la comunidad y sus pilotos',
    },
    {
        'filename': 'og-zona-caster.png',
        'motivo': 'caster',
        'insignia': 'EN DIRECTO',
        'title': 'ZONA CASTER',
        'subtitle': 'Los casters que retransmiten nuestras carreras',
    },
    {
        'filename': 'og-events.png',
        'motivo': 'calendario',
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


# ── Motivos por sección ─────────────────────────────────────────────────────
#
# Cada sección lleva a la derecha un icono propio (auriculares y micro en la
# Zona Caster, trofeo en Campeonatos…) en vez del escudo de siempre: en el
# chat, todas las vistas previas eran iguales salvo el título. El escudo pasa
# a pequeño junto a la marca.
#
# Estilo neón: trazos dibujados en blanco sobre una capa (a 2× para suavizar
# los bordes), coloreados con el degradado naranja→rojo de la web y con un
# resplandor desenfocado del mismo color. Cada función recibe un ImageDraw
# sobre un lienzo de LADO×LADO (coordenadas de un icono de 400×400 ya
# escaladas con `k`).

LADO = 400
ESCALA = 2


def _pinceles(d, k):
    """Atajos de dibujo en coordenadas de 400×400."""
    w = lambda n: max(1, int(n * k))
    P = lambda *xs: [x * k for x in xs]
    return w, P


def motivo_caster(d, k):
    w, P = _pinceles(d, k)
    # Micrófono de estudio: cápsula, rejilla, horquilla y pie
    d.rounded_rectangle(P(160, 92, 240, 236), radius=40 * k, outline='white', width=w(11))
    for y in (128, 150, 172, 194):
        d.line(P(176, y, 224, y), fill='white', width=w(6))
    d.arc(P(130, 150, 270, 280), start=0, end=180, fill='white', width=w(10))
    d.line(P(200, 280, 200, 322), fill='white', width=w(10))
    d.line(P(150, 326, 250, 326), fill='white', width=w(11))
    # Auriculares por encima, rodeando el micro
    d.arc(P(70, 34, 330, 300), start=195, end=345, fill='white', width=w(13))
    d.rounded_rectangle(P(54, 150, 104, 252), radius=20 * k, outline='white', width=w(11))
    d.rounded_rectangle(P(296, 150, 346, 252), radius=20 * k, outline='white', width=w(11))
    # Ondas de sonido
    for r, a in ((150, 5), (182, 4)):
        d.arc(P(200 - r, 186 - r, 200 + r, 186 + r), start=-28, end=28, fill='white', width=w(a * 1.6))
        d.arc(P(200 - r, 186 - r, 200 + r, 186 + r), start=152, end=208, fill='white', width=w(a * 1.6))


def motivo_trofeo(d, k):
    w, P = _pinceles(d, k)
    d.polygon(P(120, 70, 280, 70, 268, 170, 240, 214, 160, 214, 132, 170), outline='white', width=w(11))
    d.arc(P(70, 84, 150, 174), start=90, end=270, fill='white', width=w(10))
    d.arc(P(250, 84, 330, 174), start=270, end=90, fill='white', width=w(10))
    d.line(P(200, 214, 200, 268), fill='white', width=w(12))
    d.rounded_rectangle(P(140, 268, 260, 300), radius=8 * k, outline='white', width=w(10))
    d.rounded_rectangle(P(118, 300, 282, 334), radius=8 * k, outline='white', width=w(10))
    # Estrella en la copa
    import math
    pts = []
    for i in range(10):
        r = 34 if i % 2 == 0 else 15
        a = math.radians(-90 + i * 36)
        pts += [200 + r * math.cos(a), 140 + r * math.sin(a)]
    d.polygon(P(*pts), outline='white', width=w(7))


def motivo_volante(d, k):
    w, P = _pinceles(d, k)
    d.ellipse(P(60, 60, 340, 340), outline='white', width=w(16))
    d.ellipse(P(160, 160, 240, 240), outline='white', width=w(11))
    d.line(P(76, 186, 164, 194), fill='white', width=w(14))
    d.line(P(324, 186, 236, 194), fill='white', width=w(14))
    d.line(P(200, 240, 200, 326), fill='white', width=w(14))
    d.line(P(200, 62, 200, 92), fill='white', width=w(10))      # marca de centro


def motivo_reglamento(d, k):
    w, P = _pinceles(d, k)
    d.rounded_rectangle(P(92, 50, 290, 330), radius=16 * k, outline='white', width=w(11))
    for i, y in enumerate((112, 162, 212, 262)):
        d.line(P(122, y - 4, 136, y + 8, 156, y - 12), fill='white', width=w(8), joint='curve')
        d.line(P(176, y, 256, y), fill='white', width=w(8))
    # Mazo
    d.line(P(250, 300, 330, 220), fill='white', width=w(12))
    d.polygon(P(300, 170, 350, 220, 330, 240, 280, 190), outline='white', width=w(10))


def motivo_vinilo(d, k):
    w, P = _pinceles(d, k)
    # Coche de carreras de perfil, bajo y largo, con el vinilo: franja y dorsal
    d.line(P(36, 252, 48, 214, 128, 204, 178, 198, 222, 160, 290, 158, 334, 198, 372, 210, 384, 240, 384, 252, 36, 252),
           fill='white', width=w(10), joint='curve')
    d.line(P(26, 192, 84, 192), fill='white', width=w(10))           # alerón
    d.line(P(58, 192, 62, 212), fill='white', width=w(8))
    for cx in (112, 312):
        d.ellipse(P(cx - 32, 222, cx + 32, 286), outline='white', width=w(11))
    d.line(P(150, 236, 270, 236), fill='white', width=w(7))
    d.line(P(150, 216, 196, 216), fill='white', width=w(7))
    d.ellipse(P(226, 186, 270, 230), outline='white', width=w(7))     # dorsal
    d.line(P(244, 198, 250, 194, 250, 220), fill='white', width=w(5))


def motivo_equipo(d, k):
    w, P = _pinceles(d, k)
    d.line(P(200, 44, 330, 92, 318, 232, 200, 344, 82, 232, 70, 92, 200, 44), fill='white', width=w(11), joint='curve')
    for cx, cy, s in ((200, 150, 1.0), (140, 190, 0.8), (260, 190, 0.8)):
        r = 24 * s
        d.ellipse(P(cx - r, cy - r, cx + r, cy + r), outline='white', width=w(8))
        d.arc(P(cx - 46 * s, cy + 30 * s, cx + 46 * s, cy + 120 * s), start=180, end=360, fill='white', width=w(8))


def motivo_calendario(d, k):
    w, P = _pinceles(d, k)
    d.rounded_rectangle(P(70, 82, 330, 320), radius=20 * k, outline='white', width=w(11))
    d.line(P(70, 140, 330, 140), fill='white', width=w(10))
    for x in (140, 260):
        d.line(P(x, 56, x, 104), fill='white', width=w(12))
    # Bandera a cuadros dentro
    for fila in range(4):
        for col in range(6):
            if (fila + col) % 2 == 0:
                x0, y0 = 110 + col * 30, 170 + fila * 30
                d.rectangle(P(x0, y0, x0 + 30, y0 + 30), fill='white')


MOTIVOS = {
    'caster': motivo_caster, 'trofeo': motivo_trofeo, 'volante': motivo_volante,
    'reglamento': motivo_reglamento, 'vinilo': motivo_vinilo, 'equipo': motivo_equipo,
    'calendario': motivo_calendario,
}


def icono_neon(nombre, lado):
    """Icono del motivo en estilo neón, lado×lado, RGBA."""
    grande = lado * ESCALA
    trazo = Image.new('L', (grande, grande), 0)
    MOTIVOS[nombre](ImageDraw.Draw(trazo), grande / LADO)
    trazo = trazo.resize((lado, lado), Image.LANCZOS)

    color = Image.new('RGBA', (lado, lado))
    cd = ImageDraw.Draw(color)
    for y in range(lado):   # degradado vertical naranja→rojo, como el CTA
        cd.line([(0, y), (lado, y)], fill=(*lerp((251, 146, 60), RED_600, y / lado), 255))
    neon = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    neon.paste(color, (0, 0), trazo)

    resplandor = neon.filter(ImageFilter.GaussianBlur(14))
    capa = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    capa = Image.alpha_composite(capa, resplandor)
    capa = Image.alpha_composite(capa, resplandor)
    capa = Image.alpha_composite(capa, neon)
    # Núcleo más claro: el trazo fino en blanco cálido sobre el color
    nucleo = Image.new('RGBA', (lado, lado), (255, 237, 213, 0))
    nucleo.putalpha(trazo.point(lambda v: int(v * 0.45)))
    return Image.alpha_composite(capa, nucleo)


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

    # ── Logo o motivo ──
    # Conserva la proporción (el escudo es más alto que ancho; forzarlo a un
    # cuadrado lo achataba) y va centrado sobre el halo. Con motivo propio, el
    # icono ocupa su sitio y el escudo va pequeño junto a la marca.
    motivo = section.get('motivo')
    try:
        logo = Image.open(LOGO_PATH).convert('RGBA')
        if motivo:
            icono = icono_neon(motivo, 340)
            img.alpha_composite(icono, (cx + 25 - 170, cy - 170))
            logo.thumbnail((84, 84), Image.LANCZOS)
            img.alpha_composite(logo, (90, 548 - logo.height))
        else:
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

    # Insignia opcional sobre el icono («● EN DIRECTO» en la Zona Caster)
    if section.get('insignia'):
        ins = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
        di = ImageDraw.Draw(ins)
        texto = section['insignia']
        ancho = int(di.textlength(texto, font=fuentes['marca'])) + 58
        x0, y0 = cx + 25 - ancho // 2, 96
        di.rounded_rectangle([x0, y0, x0 + ancho, y0 + 40], radius=20, fill=(*RED_600, 235))
        di.ellipse([x0 + 16, y0 + 13, x0 + 30, y0 + 27], fill=(255, 255, 255, 255))
        di.text((x0 + 40, y0 + 9), texto, fill=(255, 255, 255, 255), font=fuentes['marca'])
        brillo = ins.filter(ImageFilter.GaussianBlur(12))
        img = Image.alpha_composite(Image.alpha_composite(img, brillo), ins)

    # Divisoria con el gradiente del CTA, como el subrayado de la web.
    img.paste(barra_cta(180, 4), (90, 358))

    pie = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    p = ImageDraw.Draw(pie)
    x_marca = 190 if motivo else 90
    p.text((x_marca, 494), "GT7 CHAMPIONSHIPS", fill=(255, 255, 255, 120), font=fuentes['marca'])
    p.text((x_marca, 524), "imsa.trenkit.com", fill=(*ORANGE_600, 220), font=fuentes['url'])
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
