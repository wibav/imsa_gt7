"""
Figuras del reglamento general (vista cenital, estilo de la web).

Genera SVG estáticos en public/reglamento/. Se regeneran con:
    python3 scripts/reglamento/generar-figuras.py
"""
from pathlib import Path

DEST = Path(__file__).resolve().parents[2] / 'public' / 'reglamento'
DEST.mkdir(parents=True, exist_ok=True)

ASFALTO = '#334155'
LINEA = '#e2e8f0'
TEXTO = '#e2e8f0'
TEXTO_SUAVE = '#94a3b8'
ATACANTE = '#f97316'   # naranja
DEFENSOR = '#3b82f6'   # azul
OK = '#22c55e'
MAL = '#ef4444'
FUENTE = "font-family='Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'"


def coche(x, y, color, etiqueta=None, largo=84, ancho=34):
    """Coche visto desde arriba, avanzando hacia la derecha. (x, y) = esquina
    trasera izquierda. Devuelve el SVG y las referencias: retrovisor y ejes."""
    ret_x = x + largo * 0.58       # retrovisores
    eje_del = x + largo * 0.80     # eje delantero
    eje_tra = x + largo * 0.20
    s = [
        # ruedas
        *[f"<rect x='{ex - 7}' y='{wy}' width='14' height='6' rx='2' fill='#0f172a'/>"
          for ex in (eje_del, eje_tra) for wy in (y - 3, y + ancho - 3)],
        f"<rect x='{x}' y='{y}' width='{largo}' height='{ancho}' rx='9' fill='{color}'/>",
        # cabina
        f"<rect x='{x + largo * 0.36}' y='{y + 6}' width='{largo * 0.26}' height='{ancho - 12}' rx='5' fill='#0f172a' opacity='0.55'/>",
        # retrovisores
        f"<rect x='{ret_x - 3}' y='{y - 6}' width='6' height='6' rx='1.5' fill='{color}'/>",
        f"<rect x='{ret_x - 3}' y='{y + ancho}' width='6' height='6' rx='1.5' fill='{color}'/>",
    ]
    if etiqueta:
        s.append(f"<text x='{x + largo / 2}' y='{y + ancho / 2 + 4}' text-anchor='middle' {FUENTE} font-size='11' font-weight='700' fill='#fff'>{etiqueta}</text>")
    return '\n'.join(s), {'retrovisor': ret_x, 'eje_del': eje_del, 'eje_tra': eje_tra}


def marca(x, y1, y2, color, texto, abajo=False):
    ty = y2 + 16 if abajo else y1 - 6
    return (f"<line x1='{x}' y1='{y1}' x2='{x}' y2='{y2}' stroke='{color}' stroke-width='2' stroke-dasharray='4 3'/>"
            f"<text x='{x}' y='{ty}' text-anchor='middle' {FUENTE} font-size='11' fill='{color}'>{texto}</text>")


def veredicto(x, y, ok, texto):
    color = OK if ok else MAL
    # Trazos y no caracteres ✓/✗: la fuente del PDF no trae esos glifos
    simbolo = (f"<polyline points='{x - 5},{y} {x - 1.5},{y + 4} {x + 5.5},{y - 4}' fill='none' stroke='#fff' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/>"
               if ok else
               f"<path d='M{x - 4.5},{y - 4.5} L{x + 4.5},{y + 4.5} M{x + 4.5},{y - 4.5} L{x - 4.5},{y + 4.5}' stroke='#fff' stroke-width='2.6' stroke-linecap='round'/>")
    return (f"<circle cx='{x}' cy='{y}' r='11' fill='{color}'/>{simbolo}"
            f"<text x='{x + 18}' y='{y + 5}' {FUENTE} font-size='13' font-weight='700' fill='{TEXTO}'>{texto}</text>")


def recta_con_curva(y0, alto, sentido='derecha'):
    """Recta horizontal que acaba en curva. sentido='derecha': curva hacia abajo
    (el interior queda abajo)."""
    x_ini, x_curva = 10, 430
    y1 = y0 + alto
    if sentido == 'derecha':
        fin = y1 + 18
        d = (f"M{x_ini},{y0} L{x_curva},{y0} Q590,{y0} 590,{fin} L{590 - alto},{fin} "
             f"Q{590 - alto},{y1} {x_curva},{y1} L{x_ini},{y1} Z")
        bordes = (f"<path d='M{x_ini},{y0} L{x_curva},{y0} Q590,{y0} 590,{fin}' fill='none' stroke='{LINEA}' stroke-width='2.5'/>"
                  f"<path d='M{x_ini},{y1} L{x_curva},{y1} Q{590 - alto},{y1} {590 - alto},{fin}' fill='none' stroke='{LINEA}' stroke-width='2.5'/>")
        vertice = (x_curva + 50, y1 - 4)
    return f"<path d='{d}' fill='{ASFALTO}'/>" + bordes, vertice


def svg(ancho, alto, cuerpo, titulo):
    return (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {ancho} {alto}' role='img' aria-label='{titulo}'>"
            f"<title>{titulo}</title>"
            # Fondo propio: la figura se ve igual en la web (tema oscuro) y en el PDF (página blanca)
            f"<rect width='{ancho}' height='{alto}' rx='12' fill='#1e293b'/>"
            f"{cuerpo}</svg>\n")


def panel_adelantamiento(y, ok, interior=True):
    pista, (vx, vy) = recta_con_curva(y + 22, 96)
    partes = [pista]
    giro_x = 360
    partes.append(marca(giro_x, y + 20, y + 120, '#facc15', 'Punto de giro'))
    partes.append(f"<circle cx='{vx}' cy='{vy}' r='5' fill='#facc15'/>"
                  f"<text x='{vx}' y='{vy - 9}' text-anchor='middle' {FUENTE} font-size='11' fill='#facc15'>Vértice</text>")
    carril_ext, carril_int = y + 34, y + 72
    def_x = 250
    if interior:
        d, rd = coche(def_x, carril_ext, DEFENSOR, 'B')
        atk_x = (rd['retrovisor'] - 84 * 0.80 + 6) if ok else (rd['retrovisor'] - 84 * 0.80 - 34)
        a, ra = coche(atk_x, carril_int, ATACANTE, 'A')
        partes += [d, a]
        partes.append(f"<line x1='{rd['retrovisor']}' y1='{carril_ext}' x2='{rd['retrovisor']}' y2='{carril_int + 34}' stroke='{TEXTO_SUAVE}' stroke-width='1.5' stroke-dasharray='3 3'/>")
        partes.append(f"<line x1='{ra['eje_del']}' y1='{carril_int - 4}' x2='{ra['eje_del']}' y2='{carril_int + 38}' stroke='{OK if ok else MAL}' stroke-width='2.5'/>")
    else:
        d, rd = coche(def_x, carril_int, DEFENSOR, 'B')
        atk_x = (rd['eje_del'] - 84 * 0.80 + 12) if ok else (rd['eje_del'] - 84 * 0.80 - 30)
        a, ra = coche(atk_x, carril_ext, ATACANTE, 'A')
        partes += [d, a]
        partes.append(f"<line x1='{rd['eje_del']}' y1='{carril_ext - 4}' x2='{rd['eje_del']}' y2='{carril_int + 38}' stroke='{TEXTO_SUAVE}' stroke-width='1.5' stroke-dasharray='3 3'/>")
        partes.append(f"<line x1='{ra['eje_del']}' y1='{carril_ext - 4}' x2='{ra['eje_del']}' y2='{carril_ext + 38}' stroke='{OK if ok else MAL}' stroke-width='2.5'/>")
    return '\n'.join(partes)


def figura_interior():
    c = [
        f"<text x='10' y='18' {FUENTE} font-size='13' font-weight='700' fill='{TEXTO}'>Adelantamiento por DENTRO · A = atacante · B = defensor</text>",
        panel_adelantamiento(26, True, interior=True),
        veredicto(22, 180, True, 'Hay paralelo: el eje delantero de A llega al retrovisor de B'),
        f"<text x='40' y='199' {FUENTE} font-size='11' fill='{TEXTO_SUAVE}'>antes del punto de giro, y se mantiene hasta el vértice</text>",
        panel_adelantamiento(214, False, interior=True),
        veredicto(22, 368, False, 'No hay paralelo: A no alcanza el retrovisor de B'),
        f"<text x='40' y='387' {FUENTE} font-size='11' fill='{TEXTO_SUAVE}'>B puede elegir cualquier trazada sin que sea bloqueo</text>",
    ]
    return svg(600, 400, '\n'.join(c), 'Adelantamiento por dentro: cuándo hay paralelo')


def figura_exterior():
    c = [
        f"<text x='10' y='18' {FUENTE} font-size='13' font-weight='700' fill='{TEXTO}'>Adelantamiento por FUERA · A = atacante · B = defensor</text>",
        panel_adelantamiento(26, True, interior=False),
        veredicto(22, 180, True, 'Derecho a espacio: el eje delantero de A va por delante'),
        f"<text x='40' y='199' {FUENTE} font-size='11' fill='{TEXTO_SUAVE}'>del eje delantero de B al llegar al vértice</text>",
        panel_adelantamiento(214, False, interior=False),
        veredicto(22, 368, False, 'Sin derecho a espacio: A no supera el eje delantero de B'),
        f"<text x='40' y='387' {FUENTE} font-size='11' fill='{TEXTO_SUAVE}'>por fuera, el atacante asume el riesgo de la maniobra</text>",
    ]
    return svg(600, 400, '\n'.join(c), 'Adelantamiento por fuera: cuándo hay derecho a espacio')


def figura_defensa():
    y0, alto = 40, 120          # borde superior = exterior, inferior = interior
    c = [f"<text x='10' y='18' {FUENTE} font-size='13' font-weight='700' fill='{TEXTO}'>Defensa en recta: UN solo cambio de trayectoria</text>",
         f"<rect x='10' y='{y0}' width='580' height='{alto}' fill='{ASFALTO}'/>",
         f"<line x1='10' y1='{y0}' x2='590' y2='{y0}' stroke='{LINEA}' stroke-width='2.5'/>",
         f"<line x1='10' y1='{y0 + alto}' x2='590' y2='{y0 + alto}' stroke='{LINEA}' stroke-width='2.5'/>",
         # B: por el centro → ① se mueve al interior → ② vuelve a la trazada sin pasar de la mitad
         f"<path d='M20,{y0 + 60} C90,{y0 + 60} 110,{y0 + 98} 190,{y0 + 98} L300,{y0 + 98} C360,{y0 + 98} 380,{y0 + 76} 440,{y0 + 76} L470,{y0 + 76}' fill='none' stroke='{DEFENSOR}' stroke-width='2.5' stroke-dasharray='7 5'/>",
         f"<text x='170' y='{y0 + 114}' {FUENTE} font-size='11' fill='{DEFENSOR}'>1 · un movimiento para defender</text>",
         f"<text x='290' y='{y0 + 64}' {FUENTE} font-size='11' fill='{DEFENSOR}'>2 · vuelve a la trazada</text>"]
    d, _ = coche(470, y0 + 62, DEFENSOR, 'B', largo=76, ancho=28)
    a, _ = coche(450, y0 + 12, ATACANTE, 'A', largo=76, ancho=28)
    c += [d, a]
    # hueco de un coche entre B y el borde exterior, ocupado por A
    c.append(f"<line x1='566' y1='{y0 + 2}' x2='566' y2='{y0 + 54}' stroke='{OK}' stroke-width='2'/>"
             f"<line x1='561' y1='{y0 + 2}' x2='571' y2='{y0 + 2}' stroke='{OK}' stroke-width='2'/>"
             f"<line x1='561' y1='{y0 + 54}' x2='571' y2='{y0 + 54}' stroke='{OK}' stroke-width='2'/>")
    c.append(f"<text x='584' y='{y0 + 140}' text-anchor='end' {FUENTE} font-size='11' fill='{OK}'>al volver deja ≥ 1 ancho de coche hasta el borde</text>")
    c.append(veredicto(22, 216, True, 'Un movimiento, mantenido hasta la siguiente curva'))
    c.append(veredicto(22, 244, False, 'Prohibido: zigzaguear o moverse en la frenada'))
    c.append(veredicto(22, 272, False, 'Prohibido: cerrar a un coche que ya está en paralelo'))
    return svg(600, 288, '\n'.join(c), 'Defensa de posición en recta')


def figura_limites():
    def escena(x0, ok):
        p = [f"<rect x='{x0}' y='40' width='260' height='120' fill='#14532d' opacity='0.55'/>",   # hierba / escapatoria
             f"<rect x='{x0}' y='40' width='160' height='120' fill='{ASFALTO}'/>",
             f"<rect x='{x0 + 160}' y='40' width='14' height='120' fill='url(#piano)'/>",
             f"<line x1='{x0 + 158}' y1='40' x2='{x0 + 158}' y2='160' stroke='{LINEA}' stroke-width='4'/>",
             f"<text x='{x0 + 80}' y='34' text-anchor='middle' {FUENTE} font-size='11' fill='{TEXTO_SUAVE}'>pista</text>",
             f"<text x='{x0 + 158}' y='176' text-anchor='middle' {FUENTE} font-size='11' fill='{LINEA}'>línea blanca (es pista)</text>",
             f"<text x='{x0 + 220}' y='34' text-anchor='middle' {FUENTE} font-size='11' fill='{TEXTO_SUAVE}'>piano / fuera</text>"]
        # coche visto de arriba, en vertical (avanza hacia arriba)
        cx = x0 + 128 if ok else x0 + 176
        p += [f"<rect x='{cx}' y='70' width='34' height='70' rx='9' fill='{ATACANTE}'/>",
              f"<rect x='{cx - 4}' y='80' width='6' height='13' rx='2' fill='#0f172a'/>", f"<rect x='{cx + 32}' y='80' width='6' height='13' rx='2' fill='#0f172a'/>",
              f"<rect x='{cx - 4}' y='118' width='6' height='13' rx='2' fill='#0f172a'/>", f"<rect x='{cx + 32}' y='118' width='6' height='13' rx='2' fill='#0f172a'/>"]
        return '\n'.join(p)
    c = [f"<defs><pattern id='piano' width='14' height='20' patternUnits='userSpaceOnUse'><rect width='14' height='10' fill='#dc2626'/><rect y='10' width='14' height='10' fill='#f8fafc'/></pattern></defs>",
         f"<text x='10' y='18' {FUENTE} font-size='13' font-weight='700' fill='{TEXTO}'>Límites de pista: dos ruedas de ejes distintos sobre la pista o la línea</text>",
         escena(20, True), escena(320, False),
         veredicto(32, 205, True, 'Dentro de los límites'),
         f"<text x='50' y='224' {FUENTE} font-size='11' fill='{TEXTO_SUAVE}'>las ruedas izquierdas siguen en la pista</text>",
         veredicto(332, 205, False, 'Fuera de los límites'),
         f"<text x='350' y='224' {FUENTE} font-size='11' fill='{TEXTO_SUAVE}'>las cuatro ruedas han pasado la línea</text>"]
    return svg(600, 236, '\n'.join(c), 'Límites de pista')


for nombre, fn in [('adelantamiento-interior', figura_interior), ('adelantamiento-exterior', figura_exterior),
                   ('defensa-recta', figura_defensa), ('limites-pista', figura_limites)]:
    (DEST / f'{nombre}.svg').write_text(fn(), encoding='utf-8')
    print('✓', nombre)
