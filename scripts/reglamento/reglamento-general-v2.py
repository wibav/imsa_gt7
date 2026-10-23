"""
Reglamento general v2 (GT7 Championships).

Fuente única del texto: genera src/app/data/reglamento-general.json con el
formato que guarda Firestore en organizations/{id}.reglamento (las filas de
tabla van como {cells: [...]}, porque Firestore no admite arrays anidados).

Numeración: la web y la IA de reclamaciones numeran por posición
(sección.bloque.punto). Las figuras van DENTRO de un bloque (`figuras`) para
no alterar esa numeración.

    python3 scripts/reglamento/reglamento-general-v2.py
"""
import json
from pathlib import Path

VERSION = '2.0'
FECHA = '2026-10-23'


def lista(subtitulo, items, figuras=None):
    b = {'subtitle': subtitulo, 'items': items}
    if figuras:
        b['figuras'] = [{'src': f'/reglamento/{n}.svg', 'alt': alt} for n, alt in figuras]
    return b


def tabla(subtitulo, cabeceras, filas):
    return {'subtitle': subtitulo, 'type': 'table', 'headers': cabeceras, 'rows': [{'cells': f} for f in filas]}


SECCIONES = [
    {
        'id': 'definiciones', 'icon': '📖', 'title': 'Aplicación y Definiciones',
        'content': [
            lista('Aplicación', [
                'Este reglamento general aplica a todos los campeonatos y eventos de GT7 Championships.',
                'El reglamento particular de cada campeonato o evento prevalece sobre este en todo lo que regule de forma distinta (coches, sistema de puntos, umbrales de amonestación, configuración de sala, etc.).',
                'Lo no previsto lo resuelven los comisarios, tomando como referencia el Código de Conducta en Pista de la FIA (Código Deportivo Internacional, Anexo L, capítulo IV) y sus guías de pilotaje (Driving Standards Guidelines), adaptados a Gran Turismo 7.',
                'Los artículos se citan con su numeración (por ejemplo, 5.3.2). Cada versión publicada indica su fecha de actualización; las resoluciones se rigen por la versión vigente el día de la carrera.',
            ]),
            tabla('Definiciones', ['Término', 'Significado'], [
                ['Pista', 'Superficie asfaltada delimitada por las líneas blancas. Las líneas blancas forman parte de la pista; los pianos, arcenes, césped y escapatorias, no.'],
                ['Punto de giro', 'Punto en el que el piloto empieza a girar el volante para entrar en la curva.'],
                ['Vértice (ápice)', 'Punto de la curva en el que el coche pasa más cerca del borde interior.'],
                ['Paralelo (overlap)', 'Situación en la que el coche que ataca tiene derecho a espacio en una curva, según el artículo 5.3.'],
                ['Divebomb', 'Intento de adelantamiento por dentro, tardío y sin control, en el que el atacante no podría trazar la curva sin apoyarse en el rival o salirse de pista.'],
                ['Ventaja duradera', 'Posición o tiempo ganados al salirse de los límites de pista o con una maniobra ilegal, que se mantienen después de la maniobra.'],
                ['Incidente de carrera', 'Contacto en el que ningún piloto es total o predominantemente responsable. No se sanciona.'],
                ['Responsabilidad predominante', 'Cuando la mayor parte de la culpa de un incidente recae en un piloto, aunque el otro haya contribuido.'],
                ['Puntos de amonestación', 'Puntos que suman algunas sanciones y que se acumulan durante el campeonato (ver 7.2).'],
                ['Comisarios', 'Personas designadas por la organización para revisar incidentes y resolver reclamaciones.'],
                ['Host (anfitrión)', 'Piloto que crea y configura la sala de cada carrera (ver sección 3).'],
                ['DNF / OUT', 'DNF: no terminó la carrera. OUT: terminó sin completar el mínimo de vueltas para puntuar (ver 10.6).'],
            ]),
        ],
    },
    {
        'id': 'conducta', 'icon': '🤝', 'title': 'Conducta General y Deportividad',
        'content': [
            lista('Principios fundamentales', [
                'Todos los pilotos deben mantener un comportamiento deportivo y respetuoso en todo momento, tanto en pista como en los canales de comunicación (WhatsApp, chat de PlayStation, stream, etc.).',
                'Está terminantemente prohibido insultar, amenazar o faltar al respeto a cualquier piloto, organizador, comisario, caster o miembro de la comunidad.',
                'Se espera fair play: si causas un incidente involuntario que perjudica a otro piloto, espera y devuélvele la posición cuando sea seguro hacerlo. Es un atenuante que reduce la sanción a la mitad (ver 6.5).',
                'El uso de exploits, bugs, glitches o cualquier ventaja no legítima del juego supone la descalificación de la carrera y la posible expulsión del campeonato.',
                'Los campeonatos son INDIVIDUALES salvo que se indique lo contrario. Están prohibidas las órdenes de equipo que perjudiquen a terceros (dejarse adelantar deliberadamente o perjudicar a un rival para beneficiar a un compañero). Se sanciona a los dos pilotos implicados.',
            ]),
            lista('Primero conduce, después compite', [
                'Tu primera prioridad es mantener el control de tu coche. Solo cuando lo tengas, preocúpate de competir con los rivales.',
                'Si puedes tomar una curva a 110 km/h estando solo, no pretendas tomarla a 150 km/h porque compites con alguien.',
                'Si dudas, levanta el pie. En la mayoría de situaciones, reducir la velocidad es la mejor forma de evitar un accidente.',
                'La mejor diversión está en completar la carrera. Arriesgar innecesariamente solo te perjudica.',
            ]),
            lista('Comunicación oficial', [
                'La comunicación oficial se realiza por los canales designados por la organización (Comunidad de WhatsApp — Comisarios).',
                'Las quejas, reclamaciones o disputas NUNCA se resuelven en chats públicos, redes sociales ni durante la retransmisión. Existe un procedimiento formal (ver sección 8).',
                'Las decisiones de los comisarios son definitivas una vez publicadas, salvo que el campeonato tenga habilitadas las alegaciones (ver 8.4).',
            ]),
        ],
    },
    {
        'id': 'sala', 'icon': '🎮', 'title': 'Configuración de Sala',
        'content': [
            lista('El anfitrión (Host)', [
                'El Host crea y configura la sala según los parámetros publicados para cada carrera.',
                'El Host de cada carrera se comunica con antelación por la Comunidad de WhatsApp.',
                'Debe abrir la sala con 15-20 minutos de antelación para el calentamiento y la verificación de conexiones.',
                'El Host guarda la repetición, captura los resultados y envía el informe de carrera a la organización.',
                'También debe informar a los comisarios de cualquier acción ilegal, antideportiva o dudosa que observe.',
            ]),
            lista('Apertura y preparación', [
                'Los pilotos deben estar en la sala al menos 5 minutos antes de la hora de inicio. Quien no esté al cerrarse la sala puede ser sancionado.',
                'Se conceden como máximo 5 minutos de cortesía por problemas de conexión. Pasado ese tiempo, la carrera empieza sin el piloto.',
                'Si la configuración de la sala es incorrecta (desgastes, neumáticos, clima, etc.), hay que avisar ANTES de empezar la clasificación. Una vez iniciada la sesión, se corre con la configuración activa.',
                'Si el error de configuración es grave, la organización puede anular la carrera. Si es leve, la carrera es válida.',
            ]),
            lista('Bugs y reinicios', [
                'Si un piloto queda bloqueado en la salida, debe avisar inmediatamente por el chat. Solo el Host puede reiniciar la carrera.',
                'Los pilotos afectados vuelven a su puesto de parrilla mediante una vuelta de recolocación.',
                'El reinicio solo se hace en los primeros sectores o vueltas. Después, la carrera continúa.',
            ]),
        ],
    },
    {
        'id': 'clasificacion', 'icon': '⏱️', 'title': 'Clasificación (Qualy)',
        'content': [
            lista('Normas de clasificación', [
                'La duración de la clasificación la fija cada carrera (normalmente 10-15 minutos).',
                'Hay que usar el compuesto de neumático indicado para la sesión.',
                'Respeta el espacio de los demás: no bloquees ni estorbes a quien esté en vuelta rápida.',
                'En las vueltas de salida o de enfriamiento, mantén una línea predecible y apártate de la trazada.',
                'Permanece en pista al terminar el tiempo de clasificación. Si sales, el juego puede colocarte en una posición que no te corresponde.',
            ]),
            tabla('Sanciones en clasificación', ['Infracción', 'Sanción'], [
                ['Bloquear deliberadamente a un piloto en vuelta rápida', '-2 puntos'],
                ['Empujar o contacto intencionado en clasificación', '-5 puntos'],
                ['No usar el compuesto obligatorio de clasificación', '-3 puntos'],
                ['Penalizaciones automáticas del juego (límites de pista)', 'Se respetan tal cual'],
            ]),
        ],
    },
    {
        'id': 'carrera', 'icon': '🏁', 'title': 'Normas de Carrera',
        'content': [
            lista('Salida', [
                'El tipo de salida (parrilla, lanzada o con salida en falso) se indica en la ficha de cada carrera.',
                'En salidas lanzadas, hay que mantener la posición hasta cruzar la línea de salida. Adelantar antes conlleva sanción.',
                'En salidas desde parrilla, se arranca al apagarse el semáforo. El juego penaliza automáticamente la salida anticipada.',
            ]),
            lista('Límites de pista', [
                'Un coche está dentro de los límites si al menos dos ruedas de ejes distintos (una delantera y una trasera) siguen sobre la pista. La línea blanca es pista; el piano, no.',
                'Las penalizaciones por atajar son las que impone el juego según la configuración de la sala, y se respetan.',
                'Adelantar con el coche fuera de los límites, o ganar una ventaja duradera saliéndose de ellos, obliga a devolver la posición de inmediato, como muy tarde antes del final de la vuelta. No hacerlo: -3 posiciones en el resultado final.',
                'Si se detecta un abuso sistemático de los límites que el juego no penaliza, los comisarios pueden aplicar sanciones adicionales.',
                'Está TOTALMENTE PROHIBIDO quitarse penalizaciones del juego saliéndose de pista a propósito (ruedas en la hierba o fuera del asfalto). Es actuar de mala fe: DESCALIFICACIÓN de la carrera.',
            ], figuras=[('limites-pista', 'Límites de pista: dos ruedas de ejes distintos sobre la pista')]),
            lista('Adelantamientos', [
                'El piloto de detrás es responsable de no golpear al coche de delante.',
                'Por DENTRO, hay paralelo cuando, antes del punto de giro, el eje delantero del atacante está como mínimo a la altura del retrovisor del rival, y se mantiene así hasta el vértice. Desde ese momento, el defensor debe dejarle espacio.',
                'Por FUERA, el atacante solo tiene derecho a espacio si en el vértice su eje delantero va por delante del eje delantero del rival. Es la maniobra más difícil: quien la intenta asume su riesgo.',
                'En los dos casos, el atacante debe ir controlado, frenar a tiempo y poder trazar la curva dentro de los límites sin apoyarse en el rival. Si no es así, es un divebomb y no da derecho a espacio.',
                'Sin paralelo, el piloto de delante puede elegir cualquier trazada sin que se considere bloqueo.',
                'Con paralelo, cada piloto tiene derecho a su mitad de la pista (exterior o interior) hasta la salida de la curva. Ninguno puede empujar al otro fuera de los límites.',
                'El adelantamiento termina cuando el coche que adelanta ha superado por completo al otro, sin solaparse. Hasta entonces, el paralelo sigue vigente.',
                'No se adelanta a un coche que está esquivando un accidente (bandera amarilla). Si lo haces, devuelve la posición en esa vuelta o en la siguiente. No hacerlo: -4 puntos.',
                'No aproveches el doblaje de otro piloto para adelantar a un rival directo. Espera a la siguiente curva.',
            ], figuras=[('adelantamiento-interior', 'Adelantamiento por dentro: cuándo hay paralelo'),
                        ('adelantamiento-exterior', 'Adelantamiento por fuera: cuándo hay derecho a espacio')]),
            lista('Defensa de posición', [
                'Para defender en recta se permite UN solo cambio de trayectoria, que hay que mantener hasta la siguiente curva.',
                'Quien vuelve hacia la trazada tras defender por un lado debe dejar al menos el ancho de un coche entre su coche y el borde de la pista.',
                'Está prohibido: zigzaguear, cambiar de trayectoria durante la frenada, frenar deliberadamente para perjudicar al de atrás, cerrar a un coche que ya está en paralelo y empujar al rival fuera de pista.',
                'En carreras por tiempo, está prohibido frenar o perder tiempo a propósito en la última vuelta para evitar dar una vuelta más. Sanción: última posición de la carrera.',
            ], figuras=[('defensa-recta', 'Defensa de posición en recta')]),
            lista('Banderas azules (doblajes)', [
                'El piloto que va a ser doblado DEBE facilitar el paso de forma segura, predecible y sin obstruir.',
                'Para dejar pasar, pégate a un borde de la pista y mantén esa línea hasta que te superen. Puedes levantar el pie.',
                'Puede haber varios coches intentando doblarte: mira a ambos lados y usa el radar de proximidad.',
                'El piloto doblado NO debe competir con quien le dobla ni aprovechar el paso para ganar posiciones a rivales directos.',
                'No facilitar el doblaje: -5 puntos.',
            ]),
            lista('Boxes', [
                'Respeta la entrada y salida de boxes. El juego penaliza automáticamente pisar la línea de boxes.',
                'Está prohibido detener el coche fuera de boxes durante la carrera; si necesitas pararte, hazlo en boxes. Sanción: -5 puntos.',
                'Si, al cumplir una penalización del juego, estorbas a otros pilotos, tienes que cumplirla cediendo el paso fuera de la trazada. No hacerlo: -6 puntos.',
            ]),
            lista('Neumáticos obligatorios', [
                'Cuando se indican compuestos obligatorios, hay que usar todos ellos durante la carrera.',
                'Hay que montar siempre el MISMO compuesto en las cuatro ruedas. Mezclar compuestos supone la descalificación de la carrera.',
                'No usar el compuesto obligatorio: -3 puntos.',
                'Los compuestos de cada carrera se publican en su ficha: CD (duro), CM (medio), CB (blando).',
            ]),
            lista('Reincorporaciones', [
                'Tras salirte de pista, reincorpórate sin provocar ningún incidente, cediendo el paso a todos los que estén en pista.',
                'Quien está en pista tiene prioridad absoluta sobre quien está fuera.',
                'Tras un accidente, comprueba el estado de tu coche. Con daños graves, facilita que te adelanten para no poner en riesgo al resto. No hacerlo: -3 puntos (salvo en la última vuelta).',
                'Las sanciones por reincorporación peligrosa están en la tabla del artículo 6.3.',
            ]),
        ],
    },
    {
        'id': 'incidentes', 'icon': '⚠️', 'title': 'Incidentes y Contactos',
        'content': [
            tabla('Clasificación de daños', ['Grado', 'Descripción'], [
                ['Sin daños', 'Contacto que causa pérdida de posición o salida de pista sin daño visible'],
                ['Daños LEVES', '1 parte aerodinámica dañada, o 1 aerodinámica + 1 rueda'],
                ['Daños MODERADOS', '2 partes aerodinámicas + 1-2 ruedas, o 1 aerodinámica + 2 ruedas'],
                ['Daños GRAVES', 'Cualquiera de los anteriores + rotura de motor'],
            ]),
            lista('Clasificación de incidentes', [
                'INCIDENTE DE CARRERA (no sancionable): contacto propio de la competición en el que ningún piloto es total o predominantemente responsable.',
                'INCIDENTE LEVE: contacto que causa pérdida de posición o daño menor, sin intención. Amonestación o sanción menor.',
                'INCIDENTE GRAVE: contacto que provoca un abandono (DNF), una pérdida importante de posiciones o que demuestra negligencia. Sanción de puntos.',
                'INCIDENTE MUY GRAVE: acción deliberada para sacar a otro piloto, torpedeo intencionado o represalia. Descalificación de la carrera y posible expulsión del campeonato.',
                'Se sanciona al piloto total o predominantemente responsable. Si la responsabilidad es compartida, los comisarios pueden declarar incidente de carrera o sancionar a ambos de forma proporcional.',
            ]),
            tabla('Sanciones por contacto en carrera', ['Tipo de contacto', 'Sin daños', 'D. leves', 'D. moderados', 'D. graves'], [
                ['Golpe por detrás', '-2 pts', '-3 pts', '-4 pts', '-6 pts'],
                ['Golpe en adelantamiento en curva (incluido divebomb)', '-2 pts', '-3 pts', '-4 pts', '-6 pts'],
                ['Reincorporación peligrosa a pista', '-3 pts', '-6 pts', '-8 pts', '-10 pts'],
                ['Adelantamiento sin paralelo, o con ventaja fuera de pista sin devolverla', '-3 posiciones en el resultado final', '—', '—', '—'],
            ]),
            lista('Extras por daños al rival', [
                'Cada parte aerodinámica dañada del coche rival: +1 punto a la sanción.',
                'Cada suspensión dañada del coche rival: +1 punto.',
                'Rotura del motor del coche rival: +2 puntos.',
                'Daños a terceros en un accidente provocado: +1 punto por coche con daños leves, +2 por moderados y +3 por graves, más +1 punto por cada posición que pierdan esos terceros.',
            ]),
            lista('Agravantes y atenuantes', [
                'AGRAVANTE — incidente en la primera o la última vuelta: sanción ×2.',
                'AGRAVANTE — reincidencia (la misma infracción en el mismo campeonato): sanción ×2.',
                'AGRAVANTE — intencionalidad o mala fe: sanción ×2.',
                'ATENUANTE — devolver la posición tras el incidente: sanción reducida a la mitad.',
                'ATENUANTE — otras circunstancias que reduzcan la gravedad o la culpa: sanción reducida a la mitad.',
                'Agravantes y atenuantes se combinan, pero la sanción final nunca supera el triple de la sanción base. Los extras por daños se suman después.',
            ]),
            lista('Procedimiento de evaluación', [
                'Los comisarios revisan los incidentes con la repetición del juego, los vídeos aportados y la retransmisión en directo.',
                'Pueden actuar de oficio, sin necesidad de reclamación, si observan una infracción o reciben el informe del Host.',
                'Antes de resolver, el piloto acusado puede dar su versión y aportar su propio vídeo en un plazo de 24 horas desde que se le comunica la reclamación, por el canal oficial de comisarios.',
                'Un comisario no puede resolver incidentes en los que haya participado, ni los de su propio equipo o su sala. En esos casos resuelve otro comisario o la dirección del campeonato.',
                'Se tienen en cuenta: intencionalidad, espacio dejado, velocidad relativa, consecuencias para el otro piloto e historial de incidentes.',
                'Los comisarios resuelven en un plazo máximo de 48 horas desde que termina el plazo de reclamaciones.',
            ]),
        ],
    },
    {
        'id': 'sanciones', 'icon': '⚖️', 'title': 'Sistema de Sanciones',
        'content': [
            tabla('Tabla general de sanciones', ['Infracción', 'Sanción', 'Gravedad'], [
                ['No usar el compuesto obligatorio en carrera', '-3 puntos', '🟡 Leve'],
                ['No usar el compuesto obligatorio en clasificación', '-3 puntos', '🟡 Leve'],
                ['Bloquear a un piloto en vuelta rápida (clasificación)', '-2 puntos', '🟡 Leve'],
                ['No llevar el dorsal obligatorio', '-2 puntos', '🟡 Leve'],
                ['No llevar un sticker obligatorio', '-3 puntos por sticker', '🟡 Leve'],
                ['No presentarse a la sala sin avisar', '-3 puntos (individual) / -15 puntos (equipos)', '🟡 Leve'],
                ['Trompo sin causar daños', '-2 puntos', '🟡 Leve'],
                ['Detener el coche fuera de boxes en carrera', '-5 puntos', '🟠 Moderada'],
                ['Empujar en clasificación', '-5 puntos', '🟠 Moderada'],
                ['Uso abusivo de ráfagas de luces para distraer', '-3 puntos', '🟠 Moderada'],
                ['Estorbar al cumplir una penalización del juego', '-6 puntos', '🟠 Moderada'],
                ['Trompo causando daños graves', '-5 puntos', '🟠 Moderada'],
                ['Pasarse de frenada y chocar con otro piloto', '-5 puntos', '🟠 Moderada'],
                ['Pasarse de frenada causando un accidente múltiple', '-7 puntos', '🔴 Grave'],
                ['No respetar la bandera azul (doblaje)', '-5 puntos', '🔴 Grave'],
                ['Adelantar con bandera amarilla sin devolver la posición', '-4 puntos', '🔴 Grave'],
                ['Más de un cambio de trayectoria en recta, o moverse con un coche en paralelo', '-5 puntos', '🔴 Grave'],
                ['No correr con el diseño o logo obligatorio', '-10 puntos', '🔴 Grave'],
                ['Reclamación manifiestamente infundada o de mala fe', '-5 puntos', '🔴 Grave'],
                ['Reclamar fuera del formulario oficial', '-5 puntos', '🔴 Grave'],
                ['Quitarse una penalización saliéndose de pista a propósito', 'Descalificación de la carrera', '🔴 Muy grave'],
                ['Perder tiempo a propósito en la última vuelta (carreras por tiempo)', 'Última posición', '🔴 Muy grave'],
                ['Quedarse sin combustible y tapar deliberadamente a un rival', 'Descalificación de la carrera', '🔴 Muy grave'],
                ['Colisión intencionada / torpedeo', 'Descalificación + posible expulsión', '🔴 Muy grave'],
                ['Órdenes de equipo que perjudiquen a terceros', 'Descenso de división (ambos pilotos)', '🔴 Muy grave'],
                ['Circular en sentido contrario (práctica, clasificación o carrera)', 'Descalificación de la carrera', '🔴 Muy grave'],
                ['Insultar a la organización, a los comisarios o a otros pilotos', 'Expulsión', '🔴 Muy grave'],
                ['Uso de exploits, trampas o mala fe reiterada', 'Expulsión + veto', '🔴 Muy grave'],
            ]),
            lista('Puntos de amonestación', [
                'Algunas sanciones suman puntos de amonestación además de restar puntos. Se acumulan durante todo el campeonato y no se reinician entre carreras.',
                'Cada vez que un piloto alcanza el umbral del campeonato (por defecto, 8 puntos de amonestación, y de nuevo a los 16, 24…), se le restan automáticamente 10 puntos de la clasificación. Umbral y descuento pueden variar en cada campeonato.',
                'Al llegar al umbral de descalificación del campeonato (por defecto, 16 puntos de amonestación), los comisarios estudian su exclusión del campeonato.',
                'La página de cada campeonato muestra sus valores en la sección Sanciones.',
            ]),
            lista('Notas importantes', [
                'Las sanciones en puntos se descuentan del total del campeonato. Un piloto puede quedar con puntos negativos.',
                'Las penalizaciones automáticas del juego se suman a las sanciones de los comisarios cuando corresponde.',
                'Los valores de este reglamento son los estándar. Cada campeonato puede configurar los suyos.',
                'La organización puede excluir de futuras ediciones o expulsar a pilotos conflictivos o con sanciones graves reiteradas.',
            ]),
        ],
    },
    {
        'id': 'reclamaciones', 'icon': '📋', 'title': 'Reclamaciones',
        'content': [
            lista('Cómo presentar una reclamación', [
                'Las reclamaciones SOLO se aceptan por el formulario oficial de la web. No se aceptan por WhatsApp, por el chat del stream ni por otros medios. Reclamar fuera del formulario: -5 puntos.',
                'El plazo es de 48 horas desde el final de la carrera. Pasado ese tiempo, el formulario deja de estar disponible para esa carrera.',
                'El formulario está en la página del campeonato, sección Sanciones, botón «📩 Reportar Incidente» (solo si el campeonato tiene las reclamaciones activadas).',
                'Indica: tu nombre, el piloto o los pilotos implicados, la carrera, la vuelta o el minuto (si lo sabes), una descripción detallada y el enlace al vídeo.',
                'Puedes reclamar a varios pilotos en la misma reclamación si el incidente los implica a todos.',
            ]),
            lista('Evidencias', [
                'La evidencia en vídeo es muy recomendable. Sin ella, los comisarios solo pueden resolver con la repetición o la retransmisión; si no hay imágenes suficientes, la reclamación puede desestimarse.',
                'Sube el vídeo a YouTube como «Oculto» (No listado), nunca como «Privado»: un vídeo privado no lo pueden ver los comisarios ni la herramienta de análisis.',
                'Muestra el HUD de daños en el vídeo para que se pueda valorar el grado de daño.',
                'Si no puedes subirlo, envíalo por privado a los comisarios; ellos lo adjuntarán a la reclamación.',
            ]),
            lista('Resolución', [
                'Los comisarios revisan la evidencia, la completan con la repetición o la retransmisión y escuchan al piloto acusado (ver 6.6).',
                'La resolución se publica en la web con la decisión y, si la hay, la sanción aplicada.',
                'Una reclamación manifiestamente infundada o de mala fe supone -5 puntos para quien la presenta. Una reclamación de buena fe que se desestima no se sanciona.',
            ]),
            lista('Alegación (apelación)', [
                'Si el campeonato tiene las alegaciones activadas, el piloto sancionado (si la reclamación se aceptó) o el reclamante (si se rechazó) puede alegar contra la resolución dentro del plazo configurado (por defecto, 48 horas desde la resolución).',
                'La alegación la resuelve una instancia superior: un director de liga u organizador, nunca un comisario ni quien resolvió la reclamación.',
                'Mientras se resuelve, la sanción sigue aplicándose y se muestra como «⚖️ En disputa».',
                'La resolución de la alegación es definitiva: puede confirmar, revocar o modificar la sanción, o inadmitir la alegación por forma (fuera de plazo, sin legitimación o duplicada). No hay segunda instancia.',
                'Si no se alega en plazo, o el campeonato no tiene alegaciones, la resolución original es definitiva.',
            ]),
        ],
    },
    {
        'id': 'desconexiones', 'icon': '📡', 'title': 'Desconexiones y Lag',
        'content': [
            lista('Desconexión de un piloto', [
                'Cada piloto es responsable de su conexión. Se recomienda conexión por cable (ethernet) en lugar de WiFi.',
                'Un piloto que se desconecta durante la carrera es DNF.',
                'Se espera como máximo 5 minutos para que se reconecte antes de la salida. La sala NO se reinicia para recolocar la parrilla.',
                'Excepción: si el piloto demuestra una caída del servicio de internet, la organización puede estudiar el caso.',
            ]),
            lista('Caída de la sala o del servidor', [
                'Si la sala cae con MÁS del 75 % de la carrera completada, la carrera se da por terminada con las posiciones del último paso por meta.',
                'Si cae entre el 50 % y el 75 %, se otorga LA MITAD de los puntos de cada posición según el último paso por meta.',
                'Si cae antes del 50 %, la carrera se anula sin repetición. Si se han disputado entre 10 y 20 minutos, la organización puede reanudarla con el tiempo restante.',
                'Estas decisiones son exclusivas de los comisarios, tras recibir el informe de carrera.',
            ]),
            lista('Lag', [
                'Si un piloto tiene un lag severo que afecta a los demás (teletransportes, rebotes), la organización puede pedirle que abandone la carrera.',
                'Los incidentes causados por lag se estudian caso por caso. Por norma, no se sanciona al piloto con lag si no es intencionado, ni tampoco al afectado.',
                'Un piloto con lag extremo y reiterado puede recibir un DNF para proteger la competición.',
            ]),
            lista('Bugs de GT7', [
                'Si el juego recoloca mal a un piloto, se estudia caso por caso.',
                'Si el bug afecta a las posiciones finales y se detecta a tiempo, la organización puede reiniciar la carrera.',
            ]),
        ],
    },
    {
        'id': 'especificas', 'icon': '📐', 'title': 'Reglas de Campeonato',
        'content': [
            lista('Coches y Balance of Performance', [
                'Salvo que se indique lo contrario, el BoP (BdR) está SIEMPRE activado en las carreras competitivas.',
                'Los ajustes del coche (setup) están prohibidos salvo que la ficha de la carrera los permita.',
                'Cada campeonato puede definir los coches permitidos y sus reglas de uso (por ejemplo, número de coches por piloto y usos máximos de cada uno).',
                'Usar un coche no permitido o incumplir las reglas de uso supone la descalificación de la carrera.',
            ]),
            lista('Diseño, logo y dorsal', [
                'Si el campeonato exige un diseño o logo, es obligatorio llevarlo. No hacerlo: -10 puntos.',
                'El dorsal debe verse según las indicaciones del campeonato. No llevarlo: -2 puntos.',
                'Los stickers obligatorios deben ir en las posiciones indicadas (normalmente parabrisas y ambos laterales). No llevarlos: -3 puntos por sticker.',
                'El diseño es libre salvo que el campeonato indique restricciones.',
            ]),
            lista('Formato Sprint + Carrera', [
                'Algunos campeonatos incluyen una carrera Sprint (normalmente 5 vueltas) además de la carrera principal.',
                'Cada sesión (Sprint, clasificación y carrera) puede tener sus propios compuestos obligatorios y configuración.',
                'Los puntos del Sprint se suman a los de la carrera principal.',
            ]),
            lista('Divisiones, ascensos y descensos', [
                'Los campeonatos con varias divisiones usan un sistema de ascensos y descensos entre ediciones.',
                'Al terminar cada edición, los pilotos en puesto de ascenso suben de división y los de descenso bajan.',
                'Si quedan plazas libres, los pilotos que acaban de descender de la división superior tienen prioridad sobre los que acaban de ascender de la inferior.',
                'El número de ascensos y descensos lo fija cada campeonato.',
            ]),
            lista('Puntuación y desempates', [
                'Cada campeonato publica su sistema de puntos (carrera, clasificación y vuelta rápida) en la sección Información de su página.',
                'En caso de empate a puntos en la clasificación general, se desempata por: 1) más victorias, 2) más podios, 3) mejor resultado en una carrera.',
            ]),
            lista('Requisitos para puntuar', [
                'Para puntuar hay que completar al menos el 75 % de las vueltas del ganador.',
                'Quien no llega al 75 % aparece como OUT: cuenta como asistencia, pero no suma puntos.',
            ]),
        ],
    },
]

salida = Path(__file__).resolve().parents[2] / 'src' / 'app' / 'data' / 'reglamento-general.json'
salida.write_text(json.dumps({'version': VERSION, 'fecha': FECHA, 'sections': SECCIONES}, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'✓ {salida} · {len(SECCIONES)} secciones')
