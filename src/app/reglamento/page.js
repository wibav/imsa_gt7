"use client";
import { useState } from "react";
import Navbar from "../components/Navbar";

// ============================
// DATOS DEL REGLAMENTO UNIFICADO
// ============================

const SECTIONS = [
    // ─────────────────────────────────────────────
    // 1. CONDUCTA GENERAL Y DEPORTIVIDAD
    // ─────────────────────────────────────────────
    {
        id: "conducta",
        icon: "🤝",
        title: "Conducta General y Deportividad",
        content: [
            {
                subtitle: "Principios fundamentales",
                items: [
                    "Todos los pilotos deben mantener un comportamiento deportivo y respetuoso en todo momento, tanto en pista como en los canales de comunicación (Whatsapp, chat de PlayStation, stream, etc.).",
                    "Está terminantemente prohibido insultar, amenazar o faltar al respeto a cualquier piloto, organizador, comisario, caster o miembro de la comunidad.",
                    "Se espera fair play: si causas un incidente involuntario que perjudica a otro piloto, se valora positivamente esperar y devolver la posición cuando sea seguro hacerlo. Devolver la posición puede reducir la sanción a la mitad.",
                    "El uso de exploits, bugs, glitches o cualquier ventaja no legítima del juego resultará en descalificación inmediata de la carrera y posible expulsión del campeonato.",
                    "Este es un campeonato INDIVIDUAL. Están prohibidas las órdenes de equipo que perjudiquen a terceros (dejarse adelantar deliberadamente o perjudicar a un rival para beneficiar a un compañero). Ambos pilotos implicados serán sancionados."
                ]
            },
            {
                subtitle: "Primero conduce, después compite",
                items: [
                    "Tu primera prioridad es mantener el control de tu coche. Solo cuando lo hayas conseguido, preocúpate de competir con los rivales.",
                    "Si puedes tomar una curva a 110 km/h estando solo, no pretendas tomarla a 150 km/h solo porque compitas con alguien. No dejes que la emoción de la carrera desvíe tu atención.",
                    "Si dudas, levanta el pie. En 9 de cada 10 situaciones, reducir la velocidad es la mejor opción para evitar un accidente.",
                    "La mejor diversión está en competir la carrera completa y acabarla. Arriesgar innecesariamente solo te perjudica."
                ]
            },
            {
                subtitle: "Comunicación oficial",
                items: [
                    "Toda comunicación oficial se realiza por los canales designados por la organización (Comunidad de Whatsapp (Comisarios)).",
                    "Las quejas, reclamaciones o disputas NUNCA deben resolverse en chat público, redes sociales o durante la retransmisión. Existe un procedimiento formal de reclamaciones (ver sección correspondiente).",
                    "Las decisiones de los comisarios y la organización son definitivas una vez publicadas. No se admiten apelaciones salvo nuevas pruebas contundentes.",
                    "Está prohibido hablar por micrófono o escribir por chat durante la clasificación y la carrera, salvo el anfitrión de sala para cuestiones de organización. Infracción: -3 puntos."
                ]
            }
        ]
    },
    // ─────────────────────────────────────────────
    // 2. CONFIGURACIÓN DE SALA
    // ─────────────────────────────────────────────
    {
        id: "sala",
        icon: "🎮",
        title: "Configuración de Sala",
        content: [
            {
                subtitle: "El anfitrión (Host)",
                items: [
                    "El Host es el responsable de crear y configurar la sala según los parámetros establecidos para cada carrera.",
                    "El anfitrión de cada carrera será comunicado con antelación por la Comunidad de Whatsapp.",
                    "Debe crear la sala con un mínimo de 15-20 minutos de antelación para calentamiento y verificación de conexiones.",
                    "El Host es responsable de guardar la repetición, tomar captura de los resultados y enviar el informe de carrera a la organización.",
                    "También deberá reportar a los comisarios cualquier acción ilegal, antideportiva o de dudosa legalidad que observe durante la carrera."
                ]
            },
            {
                subtitle: "Apertura y preparación",
                items: [
                    "Los pilotos deben estar en la sala al menos 5 minutos antes de la hora de inicio. Un piloto que no esté presente al cerrar la sala podrá ser penalizado.",
                    "Se darán máximo 5 minutos de cortesía para pilotos con problemas de conexión. Si pasado ese tiempo no se resuelve, la carrera continúa sin ellos.",
                    "Si se detecta que la configuración de sala es incorrecta (desgastes, neumáticos, clima, etc.), se debe avisar ANTES de iniciar la clasificación. Una vez iniciada la sesión, se corre con la configuración activa.",
                    "Si el error de configuración es grave, la organización puede declarar la carrera nula. Si es leve, la carrera se da como válida."
                ]
            },
            {
                subtitle: "Bugs y reinicios",
                items: [
                    "Si un piloto se queda bugeado en la salida, debe avisar inmediatamente por chat. Solo el anfitrión tiene potestad de reiniciar la carrera.",
                    "Los pilotos afectados volverán a su puesto de grilla mediante una vuelta de recolocación.",
                    "El reinicio solo se realizará en los primeros sectores/vueltas. Más allá de ese punto, se continúa la carrera."
                ]
            }
        ]
    },
    // ─────────────────────────────────────────────
    // 3. CLASIFICACIÓN (QUALIFY)
    // ─────────────────────────────────────────────
    {
        id: "clasificacion",
        icon: "⏱️",
        title: "Clasificación (Qualify)",
        content: [
            {
                subtitle: "Normas de clasificación",
                items: [
                    "La clasificación tiene una duración definida por cada evento (generalmente 10-15 minutos).",
                    "Se debe usar el compuesto de neumático indicado para la sesión de clasificación. Usar un compuesto diferente al obligatorio: -3 puntos.",
                    "Durante la clasificación hay que respetar el espacio de los demás pilotos. No se debe bloquear intencionalmente ni estorbar a pilotos en vuelta rápida.",
                    "Si haces una vuelta de instalación o de enfriamiento, mantén una línea predecible y deja espacio.",
                    "Todo piloto debe permanecer en pista una vez concluido el tiempo de clasificación. Si sales de pista, el juego puede colocarte en una posición que no te corresponda."
                ]
            },
            {
                subtitle: "Penalizaciones en clasificación",
                type: "table",
                headers: ["Infracción", "Sanción"],
                rows: [
                    ["Bloqueo deliberado a otro piloto en vuelta rápida", "-2 puntos"],
                    ["Empujarse o contacto intencional en clasificación", "-5 puntos"],
                    ["No usar compuesto obligatorio de clasificación", "-3 puntos"],
                    ["Penalizaciones automáticas del juego (límites de pista)", "Se respetan tal cual"]
                ]
            }
        ]
    },
    // ─────────────────────────────────────────────
    // 4. NORMAS DE CARRERA
    // ─────────────────────────────────────────────
    {
        id: "carrera",
        icon: "🏁",
        title: "Normas de Carrera",
        content: [
            {
                subtitle: "Salida",
                items: [
                    "El tipo de salida (parrilla, lanzada o verificación en falso) se especifica en la ficha de cada circuito.",
                    "En salidas lanzadas, se debe mantener la posición hasta la línea de salida/meta. Adelantar antes de la línea conlleva penalización.",
                    "En salidas desde parrilla, se debe arrancar cuando el semáforo se apague. Saltar el semáforo resultará en penalización automática del juego."
                ]
            },
            {
                subtitle: "Trazadas y límites de pista",
                items: [
                    "Los pilotos deben mantener como mínimo 2 ruedas de ejes distintos dentro de los límites de la pista en todo momento.",
                    "Se define pista como la parte asfaltada entre las dos líneas exteriores del trazado. En ausencia de líneas, se toman los pianos como referencia; sin pianos, el asfalto.",
                    "No se considera parte de la pista: pianos, arcenes, césped artificial o escapatorias.",
                    "Las penalizaciones por atajos serán las marcadas por el juego según la configuración de la sala. Si el juego las impone, se respetan.",
                    "Si se detecta abuso sistemático de los límites de pista no penalizados por el juego, la organización puede aplicar sanciones adicionales.",
                    "Está TOTALMENTE PROHIBIDO quitarse penalizaciones sacando el coche de pista intencionadamente (ruedas sobre hierba o fuera del asfalto). Esto se considera actuar de mala fe: DESCALIFICACIÓN INMEDIATA."
                ]
            },
            {
                subtitle: "Adelantamientos",
                items: [
                    "Es responsabilidad del piloto de atrás tomar las precauciones necesarias para no golpear al coche de delante.",
                    "Para tener derecho a espacio en una curva, el piloto que adelanta debe establecer suficiente overlap ANTES del punto de giro (al menos el morro a la altura del piloto rival).",
                    "Si no hay overlap suficiente antes del punto de giro, el piloto de delante tiene derecho absoluto a elegir cualquier trazada sin que se considere bloqueo.",
                    "Si hay overlap, ambos pilotos deben respetar la trazada paralela: el coche exterior tiene derecho a la mitad exterior, y el interior a la mitad interior, hasta la salida de la curva.",
                    "No se debe adelantar a un coche que está esquivando un accidente (bandera amarilla). Si adelantas bajo bandera amarilla, debes devolver la posición en la misma vuelta o la siguiente. No hacerlo: -4 puntos.",
                    "No se debe aprovechar el doblaje de otro piloto para adelantar a rivales directos. Espera a la siguiente curva."
                ]
            },
            {
                subtitle: "Defensa de posición",
                items: [
                    "El piloto que defiende puede hacer UN SOLO cambio de trazada en recta para proteger su posición, y debe mantenerla hasta la entrada de la siguiente curva.",
                    "Se permite un segundo cambio de trazada únicamente para retomar la línea natural de entrada a curva, siempre que el rival no esté en paralelo.",
                    "Acciones prohibidas: frenar deliberadamente para perjudicar al de atrás, cerrar de forma ilegal, zigzaguear en recta, o empujar al rival fuera de pista.",
                    "En carreras por tiempo, está prohibido frenar deliberadamente o perder tiempo en la última vuelta para evitar dar una vuelta extra. Sanción: última posición de la carrera."
                ]
            },
            {
                subtitle: "Banderas azules (pilotos doblados)",
                items: [
                    "Un piloto que está siendo doblado DEBE facilitar el paso de forma segura, predecible y sin obstruir.",
                    "Para dejar pasar, pégate a un borde de la pista y mantén esa línea hasta que el coche te haya superado. Puedes levantar el pie para facilitar el adelantamiento.",
                    "Ten en cuenta que puede haber varios coches intentando doblarte, no solo uno. Mira ambos lados y usa el HUD de proximidad.",
                    "El piloto doblado NO debe intentar competir con el líder ni aprovecharse del paso para sumar posiciones frente a rivales directos.",
                    "No facilitar el doblaje: -5 puntos."
                ]
            },
            {
                subtitle: "Boxes y pit stops",
                items: [
                    "Se debe respetar la entrada y salida de boxes según los límites marcados. El juego aplica penalización automática por cruzar la línea de boxes.",
                    "Está prohibido aparcar el coche fuera de boxes durante la carrera. Si necesitas detenerte, hazlo dentro de los boxes. Sanción: -5 puntos.",
                    "Si durante la compensación de una penalización del juego obstaculizas a otros pilotos en pista, deberás quitártela cediendo espacio en la trazada. No hacerlo: -6 puntos."
                ]
            },
            {
                subtitle: "Neumáticos obligatorios",
                items: [
                    "Cuando se especifican compuestos obligatorios, es OBLIGATORIO usar todos los compuestos indicados durante la carrera.",
                    "Es obligatorio montar siempre el MISMO tipo de neumáticos en las 4 ruedas. Está prohibido mezclar compuestos. Hacerlo supone descalificación de la carrera.",
                    "No cumplir con el compuesto obligatorio: -3 puntos en la clasificación general.",
                    "Los compuestos de cada circuito se definen en la ficha del evento: CD (Duro), CM (Medio), CB (Blando)."
                ]
            },
            {
                subtitle: "Reincorporaciones",
                items: [
                    "Tras una salida de pista, el piloto debe reincorporarse sin provocar ningún incidente, cediendo el paso a todo piloto que se encuentre dentro de la pista.",
                    "Todo piloto dentro de la pista tiene prioridad absoluta sobre el que se encuentra fuera.",
                    "Tras un accidente, comprueba el estado de tu vehículo. Si tienes daños graves, debes facilitar que te adelanten para no poner en riesgo al resto.",
                    "Entrada en pista molestando: -3 puntos. Entrada provocando golpe con daños: -6 a -10 puntos según gravedad."
                ]
            }
        ]
    },
    // ─────────────────────────────────────────────
    // 5. INCIDENTES Y CONTACTOS
    // ─────────────────────────────────────────────
    {
        id: "incidentes",
        icon: "⚠️",
        title: "Incidentes y Contactos",
        content: [
            {
                subtitle: "Clasificación de daños",
                type: "table",
                headers: ["Grado", "Descripción"],
                rows: [
                    ["Sin daños", "Contacto que causa pérdida de posición o salida de pista sin daño visible en el vehículo"],
                    ["Daños LEVES", "1 parte aerodinámica dañada y/o 1 aerodinámica + 1 rueda"],
                    ["Daños MODERADOS", "2 partes aerodinámicas + 1-2 ruedas, o 1 aerodinámica + 2 ruedas"],
                    ["Daños GRAVES", "Cualquiera de los anteriores + rotura de motor"]
                ]
            },
            {
                subtitle: "Clasificación de incidentes",
                items: [
                    "INCIDENTE DE CARRERA (no sancionable): Contacto leve producto de la competencia normal, sin intención y sin consecuencias significativas.",
                    "INCIDENTE LEVE: Contacto que causa pérdida de posición o daño menor sin intención clara. Se aplica amonestación o sanción menor.",
                    "INCIDENTE GRAVE: Contacto que causa abandono (DNF), pérdida masiva de posiciones, o que demuestra negligencia. Se aplica sanción de puntos.",
                    "INCIDENTE MUY GRAVE: Acción deliberada para sacar a otro piloto de pista, torpedeo intencional, o represalias. Descalificación de la carrera y posible expulsión del campeonato."
                ]
            },
            {
                subtitle: "Sanciones por contacto en carrera",
                type: "table",
                headers: ["Tipo de contacto", "Sin daños", "D. Leves", "D. Moderados", "D. Graves"],
                rows: [
                    ["Golpe por detrás", "-2 pts", "-3 pts", "-4 pts", "-6 pts"],
                    ["Golpe en adelantamiento en curva", "-2 pts", "-3 pts", "-4 pts", "-6 pts"],
                    ["Adelantamiento no legal (sin overlap)", "-3 posiciones en resultado final", "—", "—", "—"],
                    ["Entrada peligrosa a pista", "-3 pts", "-6 pts", "-8 pts", "-10 pts"]
                ]
            },
            {
                subtitle: "Extras por daños adicionales al rival",
                items: [
                    "Cada parte aerodinámica dañada del coche rival: +1 punto adicional a la sanción.",
                    "Cada suspensión dañada del coche rival: +1 punto adicional.",
                    "Rotura de motor del coche rival: +2 puntos adicionales.",
                    "Daños a terceros en un accidente causado: +1 punto por coche afectado con daños leves, +2 por moderados, +3 por graves. Más +1 punto por cada posición perdida por terceros."
                ]
            },
            {
                subtitle: "Agravantes y atenuantes",
                items: [
                    "AGRAVANTE — Incidente en primera o última vuelta: sanción ×2 (los accidentes en estos momentos son especialmente perjudiciales).",
                    "AGRAVANTE — Reincidencia sin justificación: sanción ×2.",
                    "AGRAVANTE — Acción con alevosía o intencionalidad: sanción ×2.",
                    "ATENUANTE — Devolver la posición tras el incidente: sanción reducida a la mitad.",
                    "ATENUANTE — Circunstancias que reduzcan la gravedad o culpabilidad: sanción reducida a la mitad.",
                    "Los agravantes y atenuantes son acumulativos con las sanciones base."
                ]
            },
            {
                subtitle: "Procedimiento de evaluación",
                items: [
                    "Todos los incidentes reportados se evalúan utilizando las repeticiones del juego y/o la retransmisión en directo.",
                    "La organización/comisarios analizarán el incidente y emitirán su veredicto en un plazo máximo de 48 horas.",
                    "Factores considerados: intencionalidad, espacio dejado, velocidad relativa, consecuencias para el otro piloto, historial de incidentes.",
                    "Un piloto con daños graves que no facilite el adelantamiento al resto: -3 puntos (excepto en la última vuelta)."
                ]
            }
        ]
    },
    // ─────────────────────────────────────────────
    // 6. SISTEMA DE SANCIONES
    // ─────────────────────────────────────────────
    {
        id: "sanciones",
        icon: "⚖️",
        title: "Sistema de Sanciones",
        content: [
            {
                subtitle: "Tabla general de sanciones (todas en puntos)",
                type: "table",
                headers: ["Infracción", "Sanción", "Severidad"],
                rows: [
                    ["No usar compuesto obligatorio en carrera", "-3 puntos", "🟡 Leve"],
                    ["No usar compuesto obligatorio en clasificación", "-3 puntos", "🟡 Leve"],
                    ["Bloqueo a piloto en vuelta rápida (classify)", "-2 puntos", "🟡 Leve"],
                    ["No llevar número o stickers obligatorios", "-3 puntos por elemento", "🟡 Leve"],
                    ["No presentarse a la sala sin avisar", "-3 puntos (individual) / -15 puntos (equipo)", "🟡 Leve"],
                    ["Trompear sin causar daño", "-2 puntos", "🟡 Leve"],
                    ["Aparcar coche fuera de boxes en carrera", "-5 puntos", "🟠 Moderada"],
                    ["Empujarse en clasificación", "-5 puntos", "🟠 Moderada"],
                    ["Uso abusivo de ráfagas de luces para distraer", "-3 puntos", "🟠 Moderada"],
                    ["Hablar por micro/chat en clasificación o carrera", "-3 puntos", "🟠 Moderada"],
                    ["Obstaculizar tráfico durante compensación de penalización", "-6 puntos", "🟠 Moderada"],
                    ["Trompear causando daños graves", "-5 puntos", "🟠 Moderada"],
                    ["Pasada de frenada y chocar a otro piloto", "-5 puntos", "🟠 Moderada"],
                    ["Pasada de frenada causando accidente múltiple", "-7 puntos", "🔴 Grave"],
                    ["No respetar bandera azul (doblaje)", "-5 puntos", "🔴 Grave"],
                    ["Adelantar bajo bandera amarilla sin devolver posición", "-4 puntos", "🔴 Grave"],
                    ["Alterar trayectoria en recta más de una vez o con coche en paralelo", "-5 puntos", "🔴 Grave"],
                    ["No correr con diseño/logo obligatorio", "-10 puntos", "🔴 Grave"],
                    ["Solicitar una sanción falsa o infundada", "-5 puntos", "🔴 Grave"],
                    ["Reclamar fuera del formulario oficial", "-5 puntos", "🔴 Grave"],
                    ["Quitarse penalización sacando coche fuera de pista", "Descalificación", "🔴 Muy grave"],
                    ["Frenar deliberadamente en última vuelta (formato por tiempo)", "Última posición", "🔴 Muy grave"],
                    ["Quedarse sin gasolina y tapar deliberadamente al rival", "Descalificación", "🔴 Muy grave"],
                    ["Colisión intencional / torpedeo", "Descalificación + posible expulsión", "🔴 Muy grave"],
                    ["Órdenes de equipo que perjudiquen a terceros", "Descenso de división (causa y beneficiado)", "🔴 Muy grave"],
                    ["Conducir en sentido contrario (práctica, classify o carrera)", "Descalificación", "🔴 Muy grave"],
                    ["Insultar a organización, comisarios o pilotos", "Expulsión directa", "🔴 Muy grave"],
                    ["Uso de exploits, trampas o mala fe reiterada", "Expulsión directa + ban", "🔴 Muy grave"]
                ]
            },
            {
                subtitle: "Sistema de amonestaciones",
                items: [
                    "Las amonestaciones son acumulativas a lo largo del campeonato y NO se reinician entre carreras.",
                    "Al acumular 3 amonestaciones, se aplica automáticamente una sanción de -10 puntos (valor configurable por campeonato).",
                    "La organización puede ajustar el umbral de amonestaciones según la competición.",
                    "Un piloto con historial de sanciones graves puede ser excluido de futuras ediciones del campeonato."
                ]
            },
            {
                subtitle: "Notas importantes",
                items: [
                    "TODAS las sanciones se descuentan del total de puntos del campeonato. Puede darse el caso de pilotos con puntos negativos.",
                    "Las sanciones automáticas del juego (GT7) se suman a las sanciones de la organización cuando aplique.",
                    "Cada campeonato puede configurar valores personalizados. Los valores indicados aquí son los estándar.",
                    "Los comisarios se reservan el derecho de expulsar a cualquier piloto conflictivo o que incurra reiteradamente en sanciones."
                ]
            }
        ]
    },
    // ─────────────────────────────────────────────
    // 7. RECLAMACIONES
    // ─────────────────────────────────────────────
    {
        id: "reclamaciones",
        icon: "📋",
        title: "Reclamaciones",
        content: [
            {
                subtitle: "Cómo presentar una reclamación",
                items: [
                    "Las reclamaciones SOLO se aceptan a través del formulario oficial dentro de la plataforma web del campeonato.",
                    "NO se aceptan reclamaciones por la comunidad de WhatsApp, comentarios de stream o cualquier otro medio informal. Reclamar fuera del formulario: -5 puntos.",
                    "El plazo para presentar una reclamación es de 48 horas después de finalizada la carrera."
                ]
            },
            {
                subtitle: "Contenido obligatorio de la reclamación",
                items: [
                    "Nombre del piloto reclamante y del piloto acusado.",
                    "Carrera, ronda y vuelta en la que ocurrió el incidente.",
                    "Descripción detallada de lo sucedido.",
                    "Evidencia obligatoria: clip de video, captura de pantalla o marca de tiempo de la retransmisión. Sin evidencia, la reclamación puede ser desestimada.",
                    "Es imprescindible mostrar el HUD de daños en los videos de reclamaciones para que los comisarios puedan evaluar el grado de daño."
                ]
            },
            {
                subtitle: "Proceso de resolución",
                items: [
                    "La organización revisará la evidencia presentada y complementará con la repetición de la retransmisión en directo si está disponible.",
                    "La resolución se publicará en un plazo máximo de 48 horas con la decisión tomada.",
                    "Las decisiones de los comisarios son DEFINITIVAS. No se admiten apelaciones salvo nuevas pruebas contundentes.",
                    "Solicitar una sanción falsa o infundada conlleva -5 puntos para el reclamante.",
                    "Si un piloto no está de acuerdo con una resolución, debe comunicarlo por mensaje privado a la organización, NUNCA en público."
                ]
            }
        ]
    },
    // ─────────────────────────────────────────────
    // 8. DESCONEXIONES Y LAG
    // ─────────────────────────────────────────────
    {
        id: "desconexiones",
        icon: "📡",
        title: "Desconexiones y Lag",
        content: [
            {
                subtitle: "Desconexión de pilotos individuales",
                items: [
                    "Es responsabilidad de cada piloto tener una conexión a internet estable. Se recomienda conexión por cable (ethernet) en lugar de WiFi.",
                    "Si un piloto se desconecta por problemas de conexión, se considera DNF (Did Not Finish).",
                    "Se espera a los pilotos un máximo de 5 minutos para reconectarse. Si no vuelven, no corren y la sala NO se reinicia para acomodar grilla.",
                    "Excepción: si el piloto demuestra que fue una caída de internet (comprobante), la organización puede evaluar caso por caso."
                ]
            },
            {
                subtitle: "Caída masiva de sala / Fallos del servidor",
                items: [
                    "Si la sala se cae habiendo completado MÁS DEL 75% de la carrera: se da por concluida y los resultados del último paso por meta son los oficiales.",
                    "Si la sala se cae entre el 50% y el 75% de la carrera: se otorgan LA MITAD de los puntos en cada posición según el último paso por meta.",
                    "Si la sala se cae antes del 50% de la carrera: carrera declarada NULA sin posibilidad de repetición. Si se ha disputado entre 10-20 minutos, la organización puede optar por reiniciar con el tiempo restante.",
                    "Estas decisiones son competencia exclusiva de los comisarios tras recibir el informe de carrera."
                ]
            },
            {
                subtitle: "Problemas de lag",
                items: [
                    "Si un piloto presenta lag severo que afecta a los demás (teletransportaciones, rebotes), la organización puede solicitar que abandone la carrera.",
                    "Si el lag causa un incidente, se evaluará caso por caso. Generalmente no se penaliza al piloto con lag si no fue intencional, pero tampoco se penaliza al afectado.",
                    "Un piloto con lag extremo y reiterado puede recibir DNF para proteger la integridad de la competición."
                ]
            },
            {
                subtitle: "Bugs de GT7",
                items: [
                    "Si se produce el bug de recolocación (GT7 coloca incorrectamente a un piloto), se evaluará caso por caso.",
                    "En caso de bugueo en la salida, solo el anfitrión puede ordenar el reinicio. Los pilotos afectados son responsables de avisar por chat inmediatamente.",
                    "En casos graves donde el bug afecta posiciones finales, la organización puede reiniciar si se detecta a tiempo."
                ]
            }
        ]
    },
    // ─────────────────────────────────────────────
    // 9. REGLAS ESPECÍFICAS DE CAMPEONATO
    // ─────────────────────────────────────────────
    {
        id: "especificas",
        icon: "📐",
        title: "Reglas Específicas de Campeonato",
        content: [
            {
                subtitle: "Coches y Balance of Performance",
                items: [
                    "Salvo indicación contraria, el BoP SIEMPRE está activado en carreras competitivas para garantizar igualdad de condiciones.",
                    "Los ajustes de coche (setup) están generalmente PROHIBIDOS salvo que la ficha del circuito indique lo contrario.",
                    "Cada campeonato puede definir una lista de coches permitidos y reglas de uso (ej: 3 coches distintos con uso mínimo de X veces cada uno).",
                    "Usar un coche no permitido o incumplir las reglas de uso: descalificación de la carrera."
                ]
            },
            {
                subtitle: "Logo, diseño y dorsales",
                items: [
                    "Si el campeonato requiere un logo o diseño visible en el coche, es obligatorio aplicarlo. No hacerlo: -10 puntos.",
                    "El portanúmero y dorsal del piloto deben estar visibles según las indicaciones de cada campeonato. No llevar el número: -2 puntos.",
                    "Los stickers del campeonato deben estar en las posiciones indicadas (generalmente parabrisas, ambos lados). No llevarlos: -3 puntos por sticker.",
                    "El diseño del coche puede ser libre salvo restricciones específicas indicadas en la ficha del campeonato."
                ]
            },
            {
                subtitle: "Formato Sprint + Carrera",
                items: [
                    "Algunos campeonatos incluyen una carrera Sprint (generalmente 5 vueltas) además de la carrera principal.",
                    "Cada sesión (Sprint, Clasificación, Carrera) puede tener sus propios compuestos obligatorios y configuración.",
                    "Los puntos del Sprint se suman a los puntos de la carrera principal en la clasificación general."
                ]
            },
            {
                subtitle: "Divisiones, ascensos y descensos",
                items: [
                    "Los campeonatos con múltiples divisiones/salas utilizan un sistema de ascensos y descensos entre ediciones.",
                    "Al finalizar cada serie, los pilotos en posiciones de ascenso suben de división y los de posiciones de descenso bajan.",
                    "En caso de plazas vacantes, los pilotos recién descendidos de la división superior tienen prioridad de reingreso sobre los recién ascendidos de la inferior.",
                    "Los números exactos de promoción/relegación se definen por cada campeonato en su configuración."
                ]
            },
            {
                subtitle: "Puntuación general de referencia",
                type: "table",
                headers: ["Posición", "Puntos Carrera", "Puntos Pole/Classify"],
                rows: [
                    ["1°", "25", "10"],
                    ["2°", "20", "9"],
                    ["3°", "16", "8"],
                    ["4°", "14", "7"],
                    ["5°", "12", "6"],
                    ["6°", "10", "5"],
                    ["7°", "8", "4"],
                    ["8°", "7", "3"],
                    ["9°", "6", "2"],
                    ["10°", "5", "1"],
                    ["11°-15°", "4, 3, 2, 1, 0", "—"]
                ]
            },
            {
                subtitle: "Puntos extra y requisitos para puntuar",
                items: [
                    "Se otorga 1 PUNTO EXTRA por la vuelta rápida de la sala. Si esa vuelta rápida es la mejor entre todas las salas: 2 PUNTOS EXTRA.",
                    "Para puntuar, el piloto debe completar al menos el 75% de las vueltas totales de la carrera (referencia: vueltas del ganador en carreras por tiempo).",
                    "Pilotos que no cumplan el 75% se marcan como OUT (asistió pero no puntuó). Cuenta para asistencia pero no para puntos.",
                    "Cada campeonato puede personalizar su tabla de puntos. Los valores indicados son referencia estándar."
                ]
            }
        ]
    }
];

// ============================
// SUB-COMPONENTS
// ============================

function SectionNav({ sections, activeSection, onSelect }) {
    return (
        <nav className="hidden lg:block sticky top-24 w-64 flex-shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Contenido</p>
                {sections.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => onSelect(s.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeSection === s.id
                            ? "bg-orange-600/20 text-orange-400 font-semibold"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {s.icon} {s.title}
                    </button>
                ))}
            </div>
        </nav>
    );
}

function SectionCard({ section }) {
    return (
        <div id={section.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden scroll-mt-28">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border-b border-white/10 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <span className="text-2xl">{section.icon}</span>
                    {section.title}
                </h2>
            </div>

            {/* Content blocks */}
            <div className="px-6 py-5 space-y-6">
                {section.content.map((block, bIdx) => (
                    <div key={bIdx}>
                        <h3 className="text-orange-400 font-semibold text-sm uppercase tracking-wider mb-3">
                            {block.subtitle}
                        </h3>

                        {block.type === "table" ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            {block.headers.map((h, hIdx) => (
                                                <th key={hIdx} className="text-left py-2 px-3 text-gray-500 font-semibold text-xs uppercase">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {block.rows.map((row, rIdx) => (
                                            <tr key={rIdx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                {row.map((cell, cIdx) => (
                                                    <td key={cIdx} className={`py-2.5 px-3 ${cIdx === 0 ? "text-white font-medium" : "text-gray-300"}`}>
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <ul className="space-y-2.5">
                                {block.items.map((item, iIdx) => (
                                    <li key={iIdx} className="flex gap-3 text-gray-300 text-sm leading-relaxed">
                                        <span className="text-orange-500 mt-1 flex-shrink-0">▸</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================
// MAIN PAGE
// ============================

export default function ReglamentoPage() {
    const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

    const handleSelectSection = (id) => {
        setActiveSection(id);
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <Navbar />

            {/* Hero */}
            <div className="bg-gradient-to-r from-orange-600/20 via-red-600/20 to-orange-600/20 border-b border-white/10">
                <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 text-center">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3">
                        📜 Reglamento General
                    </h1>
                    <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto">
                        Normas de conducta, sanciones y procedimientos para todos los campeonatos y eventos.
                        Léelo antes de inscribirte para evitar sorpresas.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
                        <span>📅 Última actualización: 1 de marzo de 2026</span>
                        <span>•</span>
                        <span>{SECTIONS.length} secciones</span>
                    </div>
                </div>
            </div>

            {/* Mobile Section Selector */}
            <div className="lg:hidden sticky top-16 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-white/10 px-4 py-3">
                <select
                    value={activeSection}
                    onChange={(e) => handleSelectSection(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm focus:border-orange-500 outline-none"
                >
                    {SECTIONS.map((s) => (
                        <option key={s.id} value={s.id} className="bg-slate-800 text-white">
                            {s.icon} {s.title}
                        </option>
                    ))}
                </select>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">

                {/* Sidebar Nav (desktop) */}
                <SectionNav
                    sections={SECTIONS}
                    activeSection={activeSection}
                    onSelect={handleSelectSection}
                />

                {/* Main Content */}
                <div className="flex-1 space-y-6 min-w-0">
                    {SECTIONS.map((section) => (
                        <SectionCard key={section.id} section={section} />
                    ))}

                    {/* Footer note */}
                    <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-5 text-center">
                        <p className="text-blue-300 text-sm">
                            💡 Este reglamento aplica como base para todos los campeonatos y eventos. Cada campeonato puede tener reglas adicionales o valores de sanción personalizados que se especifican en su configuración individual.
                        </p>
                    </div>

                    {/* Back to dashboard */}
                    <div className="flex justify-center pt-4 pb-8">
                        <button
                            onClick={() => window.location.href = "/"}
                            className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-all"
                        >
                            ← Volver al Dashboard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
