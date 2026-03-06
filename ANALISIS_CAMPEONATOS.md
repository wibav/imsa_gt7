# Análisis del Sistema de Campeonatos — IMSA GT7 + HGT GT7

> **Fecha:** 18 de febrero de 2026  
> **Última actualización:** 6 de marzo de 2026  
> **Proyectos analizados:** `imsa_gt7`, `hgt_gt7`  
> **Referencia externa:** PDF "WORLD SERIES LEAGUE RR 10°MA EDICIÓN" (reglamento de club), PDF "Normativa DAS 2.3"

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Estado Actual del Sistema (imsa_gt7)](#2-estado-actual-del-sistema-imsa_gt7)
3. [Estado Actual del Sistema (hgt_gt7)](#3-estado-actual-del-sistema-hgt_gt7)
4. [Análisis del PDF — World Series League RR](#4-análisis-del-pdf--world-series-league-rr)
5. [Comparativa: Lo que tenemos vs Lo que hace el club](#5-comparativa-lo-que-tenemos-vs-lo-que-hace-el-club)
6. [Problemas y Código Duplicado Detectados](#6-problemas-y-código-duplicado-detectados)
7. [Propuesta de Unificación de Componentes](#7-propuesta-de-unificación-de-componentes)
8. [Ideas de Mejora para el Sistema de Campeonatos](#8-ideas-de-mejora-para-el-sistema-de-campeonatos)
   - 8.1 [Prioridad ALTA — Funcionalidades Core](#81-prioridad-alta--funcionalidades-core) (Divisiones, Sanciones, Sprint, Standings, Inscripción, Streaming)
   - 8.2 [Prioridad MEDIA — Reglamentación](#82-prioridad-media--reglamentación) (Reglamento, Compuestos, Clima, Coches, Reutilización)
   - 8.3 [Prioridad BAJA — Mejoras de UX](#83-prioridad-baja--mejoras-de-ux) (Briefing, Perfiles)
   - 8.4 [Mejoras para Eventos Únicos](#84-mejoras-para-eventos-únicos)
9. [Modelo de Datos Propuesto (Unificado)](#9-modelo-de-datos-propuesto-unificado)
10. [Roadmap Priorizado](#10-roadmap-priorizado)
11. [Reglamento Unificado Público](#11-reglamento-unificado-público)

---

## 1. Resumen Ejecutivo

Se tienen **dos proyectos** que manejan campeonatos de carreras de Gran Turismo 7: `imsa_gt7` y `hgt_gt7`. Ambos comparten la misma base tecnológica (Next.js + Firebase + Tailwind) pero fueron desarrollados de forma independiente, resultando en:

- **Duplicación significativa** de lógica (cálculo de standings, formateo de fechas, nextRace, progreso)
- **Modelos de datos incompatibles** (imsa usa clases formales, hgt usa objetos planos)
- **Funcionalidades complementarias**: imsa tiene equipos y categorías; hgt tiene standings calculator, replays, noticias y sponsors
- **Carencias comunes** al comparar con el reglamento del club World Series League RR, donde se manejan **divisiones, sanciones, obligación de compuestos, salas múltiples, ascensos/descensos y reglamentos detallados** que ninguno de los dos sistemas soporta

---

## 2. Estado Actual del Sistema (imsa_gt7)

### 2.1 Tech Stack

| Componente   | Versión                                         |
| ------------ | ----------------------------------------------- |
| Next.js      | 15.3.3 (App Router, static export)              |
| React        | 19.0.0                                          |
| Firebase     | 11.8.1 (Firestore + Auth + Storage + Analytics) |
| Tailwind CSS | v4                                              |
| Hosting      | Firebase Hosting                                |

### 2.2 Arquitectura de Datos

```
Firestore
├── championships/
│   └── {champId}/
│       ├── teams/        → Equipos con pilotos, color, logo
│       ├── tracks/       → Carreras con resultados, reglas, circuito
│       └── events/       → Eventos especiales del campeonato
├── teams/                → (Legacy) Equipos globales
├── tracks/               → (Legacy) Pistas globales
└── events/               → Eventos únicos independientes
```

### 2.3 Modelos de Datos Actuales

#### Championship

| Campo                         | Tipo                                    | Descripción                                                                          |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| `name`, `shortName`           | string                                  | Nombre completo y abreviado (≤10 chars)                                              |
| `description`                 | string                                  | Descripción libre                                                                    |
| `season`                      | string                                  | Año/temporada                                                                        |
| `status`                      | `draft │ active │ completed │ archived` | Estado del campeonato                                                                |
| `startDate`, `endDate`        | ISO string                              | Rango de fechas                                                                      |
| `banner`, `logo`              | URL string                              | Imágenes (Firebase Storage)                                                          |
| `categories`                  | string[]                                | `['Gr1','Gr2','Gr3','Gr4','GrB','Street']`                                           |
| `settings.pointsSystem`       | object                                  | Sistema de puntos: `{ race: {1:25, 2:18...}, qualifying: {...}, fastestLap: {...} }` |
| `settings.isTeamChampionship` | boolean                                 | ¿Campeonato por equipos?                                                             |
| `settings.maxTeams`           | number                                  | Máximo 20 equipos                                                                    |
| `settings.maxDriversPerTeam`  | number                                  | Máximo 2 pilotos por equipo                                                          |
| `drivers`                     | array                                   | Pilotos (solo campeonatos individuales)                                              |

#### Team (subcolección)

| Campo                   | Tipo                         |
| ----------------------- | ---------------------------- |
| `name`, `color`, `logo` | string                       |
| `drivers[]`             | `{ name, category, points }` |
| `championshipId`        | string                       |

#### Track (subcolección)

| Campo                         | Tipo                                     |
| ----------------------------- | ---------------------------------------- |
| `name`, `country`, `date`     | string                                   |
| `round`                       | number                                   |
| `category`                    | string                                   |
| `raceType`                    | `carrera │ resistencia`                  |
| `laps`, `duration`            | number                                   |
| `rules`                       | object (clima, desgaste, combustible...) |
| `specificCars`, `allowedCars` | boolean, string[]                        |
| `points`                      | `{ "nombrePiloto": puntos }`             |
| `status`                      | `scheduled │ in-progress │ completed`    |

#### Event (subcolección)

| Campo                             | Tipo                                                           |
| --------------------------------- | -------------------------------------------------------------- |
| `title`, `description`            | string                                                         |
| `date`, `hour`, `track`           | string                                                         |
| `rules`                           | object                                                         |
| `maxParticipants`, `participants` | number, array                                                  |
| `waitlist`                        | array — `[{id, gt7Id, psnId, waitlistPosition, registeredAt}]` |
| `status`                          | `upcoming │ live │ completed`                                  |
| `eventType`                       | `standard │ eliminatoria │ doble_eliminatoria`                 |
| `rounds`                          | array — ver estructura abajo                                   |

### 2.4 Funcionalidades Actuales (imsa_gt7)

| Funcionalidad                  | Estado       | Detalle                                                                                                        |
| ------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------- |
| CRUD de campeonatos            | ✅ Completo  | Crear, editar, eliminar, cambiar estado                                                                        |
| Campeonatos por equipos        | ✅ Completo  | Equipos con pilotos, colores, logos                                                                            |
| Campeonatos individuales       | ✅ Completo  | Pilotos directos en el campeonato                                                                              |
| Configuración de circuitos     | ✅ Completo  | 70+ pistas reales de GT7, reglas por circuito                                                                  |
| Sistema de puntos configurable | ✅ Parcial   | Puntos por carrera + qualifying + vuelta rápida                                                                |
| Resultados por carrera         | ✅ Completo  | Puntos asignados por piloto + posiciones de evento desde participantes (drag/reorder)                          |
| Clasificación/standings        | ✅ Completo  | Motor avanzado con desempate multinivel, estadísticas, comparador head-to-head                                 |
| Calendario de carreras         | ✅ Completo  | Lista de rondas con fecha, circuito, estado                                                                    |
| Dashboard público              | ✅ Completo  | Eventos semanales (filtrados por vigentes) + campeonatos + eventos pasados                                     |
| Eventos especiales             | ✅ Completo  | CRUD completo con secciones colapsables, streaming, inscripción, clima, reglas, participantes, resultados      |
| Subida de imágenes             | ✅ Completo  | Firebase Storage                                                                                               |
| Creador de vinilos SVG         | ✅ Completo  | Conversión PNG → SVG con Potrace                                                                               |
| Login admin                    | ✅ Básico    | Email hardcodeado como admin                                                                                   |
| SEO/OG                         | ✅ Completo  | Meta tags dinámicos                                                                                            |
| AdSense                        | ✅ Integrado | 3 formatos de anuncios                                                                                         |
| Sanciones                      | ✅ Completo  | Sistema configurable con presets editables, amonestaciones acumulativas, reclamaciones públicas                |
| Reglamento por campeonato      | ✅ Completo  | Reglamento editable por campeonato + página pública unificada `/reglamento`                                    |
| Ascensos/descensos             | ✅ Completo  | Divisiones con promoción/relegación entre ediciones                                                            |
| Compuestos obligatorios        | ✅ Completo  | Selección múltiple de neumáticos obligatorios en eventos y campeonatos                                         |
| Inscripción de pilotos         | ✅ Completo  | Toggle inscripción pública con aprobación opcional, fecha límite, en eventos y campeonatos                     |
| Perfiles de piloto             | ✅ Completo  | Página `/pilots` con stats históricas acumuladas de todos los campeonatos                                      |
| Exportar clasificación PNG     | ✅ Completo  | Exportar standings como imagen para redes sociales                                                             |
| Briefing pre-carrera           | ✅ Completo  | Vista informativa de la próxima carrera, exportable como imagen PNG                                            |
| Divisiones/salas               | ✅ Completo  | Subcolección Firestore con CRUD, asignación de pilotos, standings por división                                 |
| Eventos multi-ronda            | ✅ Completo  | Tipos: estándar, eliminatoria, doble eliminatoria; rondas con múltiples salas y promoción automática           |
| Lista de reservas (waitlist)   | ✅ Completo  | Cupo global + por sala; auto-enrutamiento al cupo lleno, admin mueve a inscriptos, público se anota en reserva |
| Inscripción pública en eventos | ✅ Completo  | Formulario público, aprobación opcional, fecha límite, waitlist con posición numerada                          |
| Noticias/blog                  | ❌ No existe | —                                                                                                              |
| Replays                        | ❌ No existe | —                                                                                                              |

### 2.5 Páginas del Sistema

| Ruta                            | Función                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `/`                             | Dashboard público: eventos de la semana, campeonatos activos, eventos pasados    |
| `/championships?id=X`           | Detalle público: clasificación, calendario, estadísticas, información            |
| `/championshipsAdmin`           | Panel admin: lista de campeonatos, gestión de equipos/pilotos/pistas             |
| `/championshipsAdmin/new`       | Formulario de creación (multi-paso)                                              |
| `/championshipsAdmin/edit?id=X` | Formulario de edición                                                            |
| `/eventsAdmin`                  | Gestión de eventos únicos                                                        |
| `/tracksAdmin`                  | Catálogo global de pistas                                                        |
| `/teamsAdmin`                   | Gestión de equipos (legacy)                                                      |
| `/tools`                        | Creador de vinilos                                                               |
| `/events?id=X`                  | Detalle público de evento único: banner, info, reglas, participantes, resultados |
| `/pilots`                       | Perfiles globales de pilotos con estadísticas históricas acumuladas              |
| `/reglamento`                   | Reglamento unificado público: normas de conducta, sanciones, sala, reclamaciones |
| `/login`                        | Autenticación                                                                    |

---

## 3. Estado Actual del Sistema (hgt_gt7)

### 3.1 Diferencias Arquitectónicas Clave

| Aspecto    | imsa_gt7                                      | hgt_gt7                                   |
| ---------- | --------------------------------------------- | ----------------------------------------- |
| Modelos    | Clases ES6 formales con validación            | Sin modelos — objetos planos              |
| Servicio   | `FirebaseService` centralizado (30+ métodos)  | Firebase inline en cada componente        |
| Estado     | `ChampionshipContext` global con localStorage | Hooks aislados (`useChampionships`, etc.) |
| Pistas     | Subcolección Firestore separada               | Array embebido en el documento            |
| Resultados | Puntos directos en Track `{ piloto: pts }`    | Subcolección `results/` con posiciones    |
| Equipos    | Soporta equipos completos                     | Solo individual                           |
| Statuses   | `draft`, `active`, `completed`, `archived`    | `upcoming`, `active`, `completed`         |
| Imágenes   | Firebase Storage (URLs)                       | Compresión client-side a base64           |

### 3.2 Funcionalidades Exclusivas de hgt_gt7

| Feature                       | Detalle                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| **Motor de Standings**        | `standingsCalculator.js` con desempate multinivel: puntos → victorias → podiums → mejor posición |
| **Estadísticas avanzadas**    | Victorias, podiums, poles, vueltas rápidas, mejor posición por piloto                            |
| **Puntos por carrera**        | Tabla con columnas sticky mostrando puntos de cada carrera individual                            |
| **Config granular por pista** | BOP, daños, desgaste neumáticos/combustible, motor swap, penalizaciones, neumático obligatorio   |
| **Sistema de Replays**        | Upload, moderación (pending/published/rejected), validación de plataformas                       |
| **Noticias**                  | CRUD de noticias/artículos                                                                       |
| **Sponsors**                  | Gestión de patrocinadores                                                                        |
| **Likes**                     | Botón de "me gusta" en campeonatos                                                               |
| **Códigos de acceso**         | Sistema de acceso controlado                                                                     |
| **Badges dinámicos**          | "EN VIVO" / "FINALIZADO" calculado en tiempo real                                                |

---

## 4. Análisis del PDF — World Series League RR

### 4.1 Datos del Campeonato (extraídos por OCR)

| Dato                         | Valor                                          |
| ---------------------------- | ---------------------------------------------- |
| **Nombre**                   | World Series GT League — 10ᵐᵃ Edición          |
| **Tipo**                     | Individual (con escuderías/equipos opcionales) |
| **Mínimo de pilotos**        | 15 pilotos por sala                            |
| **Salas/Divisiones**         | 3 divisiones                                   |
| **Circuitos**                | 9 circuitos por temporada                      |
| **Formato**                  | Sprint (5 vueltas) + Carrera principal         |
| **Clasificación**            | 10-15 minutos de qualify                       |
| **Frecuencia**               | Cada 3 semanas                                 |
| **Horarios**                 | Domingos, 22:45 o 23:00                        |
| **Descanso entre ediciones** | 2-3 semanas                                    |

### 4.2 Sistema de Divisiones y Ascensos/Descensos

- **3 divisiones (salas)** simultáneas
- Los **5 últimos** de cada división **bajan**
- Los **5 primeros** de la división inferior **suben**
- Se maneja entre temporadas/ediciones

### 4.3 Reglamento Detallado por Circuito

Cada circuito define:

| Regla                             | Ejemplo                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Compuesto obligatorio carrera** | CD/CM/CB (Duro/Medio/Blando)                                                                                                                                                                                                                                                                                                               |
| **Compuesto obligatorio qualify** | CM                                                                                                                                                                                                                                                                                                                                         |
| **Compuesto obligatorio Sprint**  | CB                                                                                                                                                                                                                                                                                                                                         |
| **Climatología**                  | "Última h. de la mañana x3", "Atardecer x5", "Puesta del sol x7"                                                                                                                                                                                                                                                                           |
| **Slots climáticos (presets)**    | Casillas del clima predeterminado de GT7. Cada código representa un slot en la línea de tiempo del clima de la sala: **S** = Sol, **C** = Nublado, **R** = Lluvia, seguido de un número de intensidad. Ej: `S18/C05/R07/R03/C04/S15/C05/R07/R02` = 9 casillas configurando transiciones de sol → nublado → lluvia a lo largo de la carrera |
| **Vueltas**                       | Variable por circuito                                                                                                                                                                                                                                                                                                                      |
| **Tipo de salida**                | Lanzada / Nula                                                                                                                                                                                                                                                                                                                             |
| **Desgaste neumáticos**           | x2, x3, x6                                                                                                                                                                                                                                                                                                                                 |
| **Desgaste combustible**          | x2, x6                                                                                                                                                                                                                                                                                                                                     |
| **Daños**                         | No / Leves / Graves                                                                                                                                                                                                                                                                                                                        |
| **Penalización atajos**           | Fuerte                                                                                                                                                                                                                                                                                                                                     |
| **Penalización choque muro**      | No                                                                                                                                                                                                                                                                                                                                         |
| **Penalización cruzar línea box** | Sí                                                                                                                                                                                                                                                                                                                                         |
| **Fantasma en carrera**           | No                                                                                                                                                                                                                                                                                                                                         |
| **Configuración**                 | Prohibida                                                                                                                                                                                                                                                                                                                                  |
| **BoP**                           | Activado                                                                                                                                                                                                                                                                                                                                   |
| **Coches elegibles**              | 3 coches por campeonato, uso obligatorio 3 veces c/u                                                                                                                                                                                                                                                                                       |

### 4.4 Sistema de Sanciones

| Sanción                               | Penalización                        |
| ------------------------------------- | ----------------------------------- |
| No usar compuesto obligatorio         | **-3 puntos**                       |
| Aparcar coche fuera de box en carrera | **+30 segundos**                    |
| No presentarse a sala (escudería)     | **-15 puntos**                      |
| No presentarse a sala (individual)    | **-3 puntos**                       |
| No correr con diseño establecido      | Descalificación de la carrera       |
| Bug de recolocación                   | Reinicio de carrera                 |
| Empujarse en clasificación/carrera    | **+1 minuto**                       |
| Insultar a organización               | Expulsión directa                   |
| Reclamar fuera de formulario          | Pérdida de puntos                   |
| No respetar bandera azul              | Sanción                             |
| Entrenamiento en salas ajenas         | **-13 puntos**                      |
| Falta grave reiterada                 | **+1 minuto** con posible expulsión |

### 4.5 Reglas Generales

- **Logo obligatorio** del campeonato visible en el coche
- **Sala se abre 20-10 min antes** para calentamiento
- En **caso de lluvia**, se cierra sala y se reabre la oficial
- Las **reclamaciones solo por formulario** (no por chat/discord)
- **Obligación de uso de 3 coches distintos** (3 veces cada uno)
- **Retransmisión en directo** (se verifican reglas ahí)
- **Pilotos doblados**: bandera azul obligatoria (apartarse)
- **Carril de boxes**: respetar entrada/salida, penalización automática del juego

### 4.6 Puntos Extras

| Bonificación         | Detalle      |
| -------------------- | ------------ |
| Vuelta rápida (V.R.) | Puntos extra |
| Pole Position        | Puntos extra |

### 4.7 Calendario de la 10ᵐᵃ Edición

| Fecha            | Hora           | Circuito                       |
| ---------------- | -------------- | ------------------------------ |
| 02/03            | 23:00          | Autódromo de Interlagos        |
| 09/03            | 22:45          | Grand Valley Autopista         |
| 16/03            | 23:00          | Circuito Gilles Villeneuve     |
| 23/03            | 23:00          | Road Atlanta                   |
| 30/03            | 22:45          | Watkins Glen (Largo)           |
| 06/04            | 23:00          | Yas Marina                     |
| 13/04            | 23:00          | Circuit de Spa-Francorchamps   |
| 20/04            | 22:45          | Circuit de Barcelona-Catalunya |
| —                | —              | (9° circuito no legible)       |
| **11ᵛᵃ Edición** | **11/05/2026** | —                              |

### 4.8 Circuitos con Configuración Completa

| #   | Circuito             | Compuesto Carrera | Compuesto Qualify | Clima                |
| --- | -------------------- | ----------------- | ----------------- | -------------------- |
| 1   | Interlagos           | ?                 | ?                 | Última h. mañana x3  |
| 2   | Grand Valley         | CD/CB             | CM                | Atardecer x5         |
| 3   | Gilles Villeneuve    | CD/CM/CB          | CM                | Puesta del sol x7    |
| 4   | Road Atlanta         | ?                 | ?                 | Tarde x5             |
| 5   | Watkins Glen (Largo) | CD/CM             | CD                | Crepúsculo x5        |
| 6   | Yas Marina           | CM/CB             | CB                | Medianoche x6        |
| 7   | Daytona              | CM                | CB                | Primera h. mañana x5 |
| 8   | Barcelona-Catalunya  | CD/CB             | CM                | Tarde x6             |
| 9   | Spa-Francorchamps    | Libre             | Libre             | Última h. mañana x15 |

---

## 5. Comparativa: Lo que tenemos vs Lo que hace el club

### ✅ Lo que YA soportamos

| Funcionalidad del Club                   | imsa_gt7         | hgt_gt7                     |
| ---------------------------------------- | ---------------- | --------------------------- |
| Crear campeonatos con nombre/descripción | ✅               | ✅                          |
| Definir calendario de circuitos          | ✅               | ✅                          |
| Sistema de puntos por posición           | ✅               | ✅                          |
| Puntos por Pole Position                 | ✅ (en settings) | ✅ (scoring.polePosition)   |
| Puntos por Vuelta Rápida                 | ✅ (en settings) | ✅ (scoring.fastestLap)     |
| Configuración de desgaste                | ✅ (rules)       | ✅ (raceConfig)             |
| Coches específicos por circuito          | ✅ (allowedCars) | ✅ (availableCars)          |
| Estado del campeonato                    | ✅ (4 estados)   | ✅ (3 estados)              |
| Clasificación general                    | ✅ (básica)      | ✅ (avanzada con desempate) |
| Equipos/Escuderías                       | ✅               | ❌                          |
| Dashboard público                        | ✅               | ✅                          |
| Imágenes de circuitos                    | ✅               | ✅                          |

### ❌ Lo que NO soportamos (y el club necesita)

| Funcionalidad del Club                           | Impacto  | Complejidad |
| ------------------------------------------------ | -------- | ----------- |
| **Divisiones/Salas múltiples**                   | 🔴 Alto  | 🔴 Alta     |
| **Ascensos y descensos entre divisiones**        | 🔴 Alto  | 🟡 Media    |
| **Sistema de sanciones con penalizaciones**      | 🔴 Alto  | 🟡 Media    |
| **Compuestos obligatorios por circuito**         | 🟡 Medio | 🟢 Baja     |
| **Sprint + Carrera (formato dual)**              | 🟡 Medio | 🟡 Media    |
| **Climatología detallada por circuito** (slots)  | 🟡 Medio | 🟢 Baja     |
| **Reglamento editable por campeonato**           | 🟡 Medio | 🟢 Baja     |
| **Logo obligatorio** (verificación visual)       | 🟢 Bajo  | 🟢 Baja     |
| **Formulario de reclamaciones**                  | 🟡 Medio | 🟡 Media    |
| **Control de uso de coches** (3 usos mínimo)     | 🟡 Medio | 🟡 Media    |
| **Inscripción/registro de pilotos**              | 🟡 Medio | 🟡 Media    |
| **Sistema de hosts/anfitriones**                 | 🟢 Bajo  | 🟢 Baja     |
| **Retransmisiones en directo** (enlace a stream) | 🟢 Bajo  | 🟢 Baja     |
| **Descanso entre ediciones**                     | 🟢 Bajo  | 🟢 Baja     |

---

## 6. Problemas y Código Duplicado Detectados

### 6.1 Bugs Potenciales

| #   | Bug                                                                                                                                                                    | Archivo                                    | Impacto                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------- |
| 1   | **Inconsistencia de puntos**: `getStandings()` usa `track.points[name]`, la tabla de pilotos individuales usa `driver.points[trackId]` — pueden dar totales diferentes | `championships/page.js` L57-66 vs L395-410 | 🔴 Datos incorrectos    |
| 2   | **Race condition en Context**: `updateChampionship` lee `championships` antes de que `setChampionships` se propague                                                    | `ChampionshipContext.js` L128-143          | 🟡 Estado inconsistente |
| 3   | **N+1 queries**: `loadChampionshipsTracks` itera secuencialmente haciendo 1 query por campeonato en `for...of`                                                         | `DashboardRenovated.js` L48-57             | 🟡 Lentitud             |
| 4   | **`getActiveChampionships`** retorna TODOS los campeonatos, no solo los activos (nombre engañoso)                                                                      | `DashboardRenovated.js` L87-89             | 🟢 Confusión            |

### 6.2 Código Duplicado

| Función                                 | Ocurrencias                                     | Archivos                                                                    |
| --------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `getNextRace()`                         | 2                                               | `championships/page.js`, `ChampionshipCard.js`                              |
| `getProgress()` / `calculateProgress()` | 2 (con diferencias)                             | `championships/page.js`, `ChampionshipCard.js`                              |
| `formatDate()`                          | 3+ variantes                                    | `championships/page.js`, `ChampionshipCard.js`, otros componentes           |
| Status colors/labels                    | 2                                               | Modelo `Championship`, `ChampionshipCard.js`                                |
| Patrón de medallas (🥇🥈🥉)             | 5 repeticiones                                  | `championships/page.js`                                                     |
| ~~Formularios new/edit campeonato~~     | ~~2 archivos casi idénticos (2110 líneas c/u)~~ | ✅ Unificado en `components/championship/ChampionshipForm.js` (~850 líneas) |

### 6.3 Deuda Técnica

| Problema                                 | Detalle                                                         |
| ---------------------------------------- | --------------------------------------------------------------- |
| `Dashboard.js` legacy (978 líneas)       | Ya no se usa pero sigue en el proyecto                          |
| Collections legacy (`teams/`, `tracks/`) | Siguen existiendo en Firestore + API Routes                     |
| ~~Formularios duplicados (new vs edit)~~ | ✅ Unificado — `ChampionshipForm.js` (~850 líneas, -79% código) |
| Admins hardcodeados                      | 3 emails hardcodeados en `AuthContext.js`                       |
| `tracks.js` con 15 pistas legacy         | Datos estáticos que ya no se usan                               |

---

## 7. Propuesta de Unificación de Componentes

### 7.1 Utilities Compartidos (extraer)

```
src/utils/
├── standingsCalculator.js   → Cálculo de clasificaciones con desempate multinivel
├── dateUtils.js             → formatDate, normalizeDate, isInCurrentWeek, parseDate
├── progressCalculator.js    → calculateProgress (unificar las 2 versiones)
├── nextRaceHelper.js        → getNextRace (una sola versión)
└── constants.js             → GT7_TRACKS, TYRE_OPTIONS, STATUS_CONFIG, MEDAL_ICONS
```

### 7.2 Componentes Reutilizables (crear/refactorizar)

```
src/components/
├── championship/
│   ├── ChampionshipCard.js          → Card unificada con progreso
│   ├── ChampionshipDetail.js        → Vista de detalle (extraer de page.js)
│   ├── ChampionshipForm.js          → ✅ UN SOLO formulario (new + edit unificados)
│   ├── StandingsTable.js            → ✅ Tabla de clasificación reutilizable (equipos/individual/pilotos)
│   ├── CalendarList.js              → Lista de carreras del calendario
│   ├── RaceResultsDisplay.js        → Resultados inline por carrera
│   ├── PointsSystemDisplay.js       → Visualización del sistema de puntos
│   └── StatsCards.js                → Cards de estadísticas
├── forms/
│   ├── TrackConfigForm.js           → Configuración de circuito
│   ├── PointsSystemForm.js          → Editor de sistema de puntos
│   ├── TeamForm.js                  → Formulario de equipo
│   └── DriverChipInput.js           → Input de pilotos chip-based (de hgt_gt7)
├── common/
│   ├── StatusBadge.js               → ✅ Badge de estado reutilizable (6 estados, 3 tamaños, pulso)
│   ├── LoadingSkeleton.js           → ✅ Skeleton de carga (7 variantes)
│   ├── ErrorMessage.js              → ✅ Mensajes de error (3 variantes)
│   ├── MedalIcon.js                 → Componente de medalla (reemplazar 5 duplicados)
│   └── ProgressBar.js               → Barra de progreso genérica
├── events/
│   ├── EventCard.js                 → Card de evento existente
│   └── EventForm.js                 → Formulario de evento
└── layout/
    ├── Navbar.js
    ├── Footer.js
    ├── AdminLayout.js
    └── ProtectedRoute.js
```

### 7.3 Hooks Unificados

```
src/hooks/
├── useChampionships.js              → Lista y filtrado de campeonatos
├── useChampionshipDetail.js         → Detalle con equipos, pistas, resultados
├── useChampionshipStandings.js      → Cálculo de clasificaciones
├── useChampionshipProgress.js       → Progreso y siguiente carrera
├── useAnalytics.js                  → Tracking de eventos
└── useAuth.js                       → Autenticación (extraer de context)
```

### 7.4 Servicio Unificado

Mantener el patrón de `FirebaseService` de imsa_gt7 (centralizado) pero agregar:

```javascript
// Nuevos métodos sugeridos
class FirebaseService {
  // ... métodos existentes ...

  // DIVISIONS
  static async getDivisions(champId) {}
  static async createDivision(champId, data) {}
  static async promoteDemoteDrivers(champId, movements) {}

  // SANCTIONS
  static async getSanctions(champId) {}
  static async addSanction(champId, sanction) {}
  static async resolveSanction(champId, sanctionId) {}

  // RESULTS (mejorado, inspirado en hgt_gt7)
  static async addRaceResults(champId, trackId, results) {}
  static async getRaceResults(champId, trackId) {}

  // CLAIMS/RECLAMACIONES
  static async submitClaim(champId, claim) {}
  static async getClaims(champId) {}
  static async resolveClaim(champId, claimId, resolution) {}
}
```

---

## 8. Ideas de Mejora para el Sistema de Campeonatos

> ### 🔑 Principio de Diseño: Todo es Opcional
>
> **Todas las funcionalidades nuevas propuestas son configurables y opcionales por campeonato.** Un campeonato puede utilizar solo las características básicas (nombre, circuitos, puntos) o activar módulos avanzados según las necesidades del organizador. Al crear o editar un campeonato, cada sección avanzada (divisiones, sanciones, inscripción pública, formato sprint, compuestos obligatorios, streaming, etc.) tiene un **toggle de activación** que por defecto está **desactivado**. Esto garantiza que:
>
> - Un campeonato casual entre amigos no requiere configurar divisiones ni sanciones
> - Un campeonato competitivo tipo club puede activar el stack completo
> - La complejidad del formulario de creación/edición crece solo si el usuario lo necesita
> - La migración de campeonatos existentes no se rompe (valores por defecto: `null` / `false` / `[]`)
> - Cada módulo funciona de forma **independiente** — activar sanciones no obliga a activar divisiones

### 8.1 Prioridad ALTA — Funcionalidades Core

#### 🏆 8.1.1 Sistema de Divisiones

Inspirado en el club World Series League RR:

- Crear **múltiples divisiones/salas** por campeonato (Div 1, Div 2, Div 3)
- Cada división con su **propia clasificación**
- Configurar **número de pilotos por sala** (ej: 15)
- Sistema de **promoción/relegación** entre ediciones (5 suben, 5 bajan)

```
championships/{champId}/divisions/{divId}
├── name: "División 1"
├── maxDrivers: 15
├── drivers: ["piloto1", "piloto2", ...]
├── tracks/{trackId}/results
└── standings (calculado)
```

#### ⚖️ 8.1.2 Sistema de Sanciones (Configurable)

> **Módulo opcional** — se activa con un toggle al crear/editar el campeonato.

Gestión completa de penalizaciones con **sanciones predefinidas editables** + **sanciones personalizadas creadas por el admin**:

**Sanciones Predefinidas (editables por campeonato):**

El sistema incluye un catálogo de sanciones basadas en reglamentos reales de sim racing. El administrador puede **editar los valores** (puntos, tiempo), **desactivar** las que no apliquen, o **ajustar la severidad**:

| Sanción Predefinida                | Tipo por defecto   | Valor por defecto | Editable |
| ---------------------------------- | ------------------ | ----------------- | -------- |
| No usar compuesto obligatorio      | Puntos             | -3                | ✅       |
| Aparcar fuera de boxes en carrera  | Tiempo             | +30s              | ✅       |
| No presentarse a sala (escudería)  | Puntos             | -15               | ✅       |
| No presentarse a sala (individual) | Puntos             | -3                | ✅       |
| No correr con diseño establecido   | Descalificación    | DSQ               | ✅       |
| Empujarse en clasificación/carrera | Tiempo             | +1 min            | ✅       |
| No respetar bandera azul           | Puntos             | -5                | ✅       |
| Entrenamiento en salas ajenas      | Puntos             | -13               | ✅       |
| Falta grave reiterada              | Tiempo + Expulsión | +1 min            | ✅       |

**Sanciones Personalizadas (creadas por el admin):**

El administrador puede **crear sanciones adicionales** ilimitadas definiendo:

- **Nombre** de la infracción (texto libre, ej: "Uso de atajo no penalizado por el juego")
- **Tipo de penalización**: tiempo, puntos, descalificación de carrera, descalificación de campeonato, expulsión, amonestación
- **Valor**: cantidad de puntos o tiempo según el tipo
- **Severidad**: Leve, Grave, Muy Grave
- **Acumulable**: si se pueden sumar múltiples instancias de la misma sanción
- **Descripción**: texto explicativo de cuándo aplica

**Funcionalidades del módulo:**

- **Toggle de activación**: el sistema de sanciones es opcional por campeonato
- **Registro por carrera**: qué piloto, qué infracción, qué penalización, evidencia opcional (clip/captura)
- **Impacto automático** en la clasificación (restar puntos, añadir tiempo al resultado)
- **Historial de sanciones** por piloto con filtros por ronda, severidad y tipo
- **Formulario de reclamaciones** público para pilotos (sub-toggle opcional)
- **Sistema de amonestaciones acumulativas**: X amonestaciones = sanción automática (ej: 3 amonestaciones = -10 puntos), **configurable por el admin**
- **Exportar resumen** de sanciones por ronda o por piloto (para compartir en Discord/WhatsApp)

#### 🏎️ 8.1.3 Formato Sprint + Carrera

Soporte para múltiples sesiones por ronda:

- **Pre-Qualify**: calentamiento (sin puntos)
- **Sprint**: carrera corta (5 vueltas típico, puntuación reducida)
- **Classify**: clasificación oficial (10-15 min)
- **Race**: carrera principal (puntuación completa)
- Configuración independiente de desgastes y compuestos por sesión

#### 📊 8.1.4 Standings Calculator Avanzado

Adoptar el motor de hgt_gt7 y expandir:

- **Desempate multinivel**: puntos → victorias → podiums → mejor posición
- **Puntos por carrera individual** visibles en tabla
- **Estadísticas por piloto**: wins, podiums, poles, fastest laps, DNFs
- **Gráficas de evolución de puntos** a lo largo de la temporada
- **Comparador de pilotos** (head-to-head)

#### 📝 8.1.5 Inscripción Pública de Pilotos

> **Módulo opcional** — se activa con un toggle al crear/editar el campeonato.

Permitir que los pilotos se inscriban directamente desde el **lado público** (cliente) sin necesidad de que el admin los agregue manualmente:

- **Toggle “Inscripción abierta”** en el formulario de creación/edición del campeonato
- **Botón “Inscribirme”** visible en la página pública del campeonato cuando está activo
- **Formulario de inscripción** con campos configurables por el admin:
  - Nombre del piloto (obligatorio)
  - PSN ID / Gamertag (obligatorio)
  - País (opcional)
  - Equipo/escudería preferida (solo si es campeonato por equipos)
  - Categoría (si aplica: Gr1, Gr2, etc.)
  - División preferida (si hay múltiples salas)
- **Modos de aprobación**:
  - **Automática**: el piloto queda inscrito inmediatamente (ideal para eventos casuales)
  - **Con aprobación**: el admin revisa y aprueba/rechaza (ideal para ligas competitivas)
- **Límite de inscripciones**: máximo de pilotos global o por división/sala
- **Fecha límite** de inscripción (opcional): después de esta fecha el botón se desactiva
- **Aceptación del reglamento**: checkbox obligatorio antes de confirmar inscripción (solo si hay reglamento configurado)
- **Panel admin**: lista de solicitudes pendientes con acción aprobar/rechazar en batch
- **Notificación visual** al admin cuando hay inscripciones pendientes (badge en el panel)
- **Estado de inscripción** visible para el piloto: pendiente, aprobado, rechazado

#### 🎥 8.1.6 Caster, Host y Streaming por Sala

> **Campos opcionales** disponibles al crear/editar cualquier campeonato.

Asignar roles de **Caster** (narrador) y **Host** (anfitrión de sala) tanto a nivel de campeonato como por sala/división individual:

**A nivel de campeonato (sala única):**

- **Caster principal**: nombre del narrador del campeonato
- **Host principal**: nombre del anfitrión de la sala (quien crea la sala en GT7)
- **URL del canal** (opcional): enlace al canal de YouTube, Twitch, Kick u otra plataforma
- **Plataforma**: selector de plataforma (YouTube, Twitch, Kick, Facebook Gaming, otro)

**A nivel de división/sala (campeonato multi-sala):**

- Cada división puede tener su **propio Caster** y **Host** diferentes al principal
- Cada división puede tener su **propia URL de stream** (porque pueden transmitirse en paralelo)
- Si no se especifica, hereda los valores del campeonato principal

**A nivel de carrera individual:**

- Override por carrera: si un Caster/Host cambia para una ronda específica
- URL de stream específica por carrera (ej: enlace al directo del día)

**En la vista pública:**

- Mostrar el **nombre del Caster** y **Host** en el calendario de carreras
- **Botón “Ver en vivo”** que enlaza al stream cuando hay URL configurada
- **Badge “EN VIVO”** automático cuando la carrera está en estado `in-progress`

### 8.2 Prioridad MEDIA — Reglamentación

#### 📜 8.2.1 Reglamento por Campeonato

Sección editable de reglas generales:

- **Editor de texto rico** para el reglamento
- **Secciones predefinidas**: Reglas generales, Sanciones, Compuestos, Boxes, Clasificación
- **Aceptación de reglamento** por los pilotos al inscribirse
- **Versionado** del reglamento (historial de cambios)

#### 🏁 8.2.2 Compuestos Obligatorios por Circuito

Tal como lo hace el club:

- **Compuesto obligatorio para carrera**: CD, CM, CB (**selección múltiple** — ya implementado en eventos, pendiente replicar en campeonatos)
- **Compuesto obligatorio para qualify**: selección única
- **Compuesto obligatorio para Sprint**: selección independiente
- **Lista de neumáticos GT7**: Competición Blando/Medio/Duro, Sport, Racing, Wet, Rally, Nieve
- **Obligación de uso de X compuestos** (ej: "usar al menos 2 compuestos")

> **📌 NOTA**: En eventos únicos ya se implementó la selección múltiple de neumáticos obligatorios (`mandatoryTyres: string[]` con UI de chips seleccionables). Al implementar compuestos en campeonatos, **reutilizar el mismo patrón de selección múltiple** tanto para carrera, classify como sprint. El campo en el formulario de circuitos de campeonato deberá ser `mandatoryTyres: string[]` (array) en lugar de un select simple.

#### 🌦️ 8.2.3 Climatología Detallada

Expandir el sistema de clima actual:

- **Hora del día**: Primera h. mañana, Última h. mañana, Tarde, Atardecer, Crepúsculo, Puesta del Sol, Medianoche
- **Multiplicador de tiempo**: x3, x5, x6, x7, x15
- **Slots climáticos**: códigos como `S18/C05/R07/R03/C04` (Seco/Nublado/Lluvia)
- **Probabilidad de lluvia**: porcentaje o "Variable"

#### 🚗 8.2.4 Control de Uso de Coches

Regla del club: "3 coches obligatorios, usar cada uno 3 veces":

- Definir **pool de coches** elegibles para el campeonato (no solo por circuito)
- **Tracking de uso**: cuántas veces ha usado cada piloto cada coche
- **Alertas** si un piloto no cumple el requisito mínimo de uso
- **Restricción automática** o aviso para la siguiente carrera

#### 🔄 8.2.5 Reutilización de Configuraciones de Campeonatos Previos

> **Función del formulario de creación** — disponible al crear un nuevo campeonato.

Al crear un nuevo campeonato, ofrecer la opción de **importar la configuración** de un campeonato anterior para no empezar de cero:

- **Selector “Basar en campeonato anterior”** al inicio del formulario de creación
- **Dropdown** con la lista de campeonatos previos (nombre + temporada + estado)
- **Campos que se copian** (el admin puede editar después):
  - Sistema de puntos (race, sprint, qualifying, pole, fastest lap)
  - Configuración de formato (sprint, qualify, warmup)
  - Categorías permitidas
  - Reglamento general (texto + reglas)
  - Configuración de sanciones (presets + personalizadas)
  - Configuración de inscripción (modo, límites, campos requeridos)
  - Configuración de streaming (plataforma, canal)
  - Configuración de divisiones (estructura, máximos por sala)
- **Campos que NO se copian** (siempre se crean nuevos):
  - Nombre, descripción, temporada
  - Fechas de inicio/fin
  - Imágenes (banner, logo)
  - Pilotos/equipos (ver 8.2.6)
  - Circuitos y resultados
- **Campo `clonedFrom`**: se guarda referencia al campeonato origen para trazabilidad
- **Preview**: antes de confirmar, mostrar un resumen de qué se va a importar

**Opción avanzada: Importar también los circuitos**

- Toggle adicional: “Importar calendario de circuitos”
- Copia los circuitos con su configuración (reglas, compuestos, clima, coches) pero **sin resultados ni fechas**
- El admin solo necesita ajustar las fechas de cada ronda

#### 👥 8.2.6 Reutilización de Pilotos de Campeonatos Previos

> **Función del formulario de creación/edición** — disponible al gestionar pilotos/equipos.

Importar la lista de pilotos o equipos de un campeonato anterior:

- **Botón “Importar pilotos de campeonato anterior”** en la sección de pilotos/equipos
- **Selector** con lista de campeonatos previos
- **Para campeonatos individuales**:
  - Lista de todos los pilotos del campeonato seleccionado
  - Selección múltiple: elegir qué pilotos importar (checkboxes)
  - Se copian: nombre, PSN ID, categoría
  - Se resetean: puntos, estadísticas, posición
- **Para campeonatos por equipos**:
  - Lista de todos los equipos con sus pilotos
  - Opción de importar **equipos completos** (equipo + pilotos + colores + logo) o **solo pilotos sueltos**
  - Se copian: nombre equipo, color, logo, pilotos con sus datos básicos
  - Se resetean: puntos de pilotos y equipos
- **Detección de duplicados**: si un piloto ya existe en el nuevo campeonato, se notifica y se puede omitir o sobreescribir
- **Importación parcial**: no es obligatorio importar todos, se puede seleccionar un subconjunto
- **Importar y redistribuir**: en campeonatos multi-división, permitir reasignar pilotos a nuevas divisiones basado en los resultados anteriores (ej: ascensos/descensos)

### 8.3 Prioridad BAJA — Mejoras de UX

#### � 8.3.1 Briefing Pre-Carrera

- **Vista informativa** que resume todas las reglas de la carrera: circuito, compuestos, clima, coches, sanciones activas
- **Checklist** pre-carrera para anfitriones (sala configurada, reglas verificadas, pilotos presentes)
- **Compartir briefing** como imagen para Discord/WhatsApp
- **Notificación** a pilotos (email o push) — futuro

#### 8.3.4 Perfiles Globales de Piloto

- **Perfil persistente** entre campeonatos: nombre, PSN ID, avatar, país
- **Estadísticas históricas** acumuladas: total de carreras, victorias, podiums, poles, vueltas rápidas, DNFs
- **Historial de campeonatos** en los que participó con resultados finales
- **Historial de sanciones** acumulado (si aplica)

---

### 8.4 Mejoras para Eventos Únicos

Los eventos únicos (independientes de campeonatos) también pueden beneficiarse de varias mejoras:

#### 🎯 8.4.1 Inscripción Pública en Eventos ✅ IMPLEMENTADO COMPLETO

> **Implementado con estructura propia en el CRUD de eventos.**

- ✅ **Toggle "Inscripción abierta"** por evento (registration.enabled)
- ✅ **Modo automático o con aprobación** (registration.requiresApproval)
- ✅ **Fecha límite de inscripción** (registration.deadline)
- ✅ **Límite de participantes** (maxParticipants, 1-64)
- ✅ **Participantes con GT7 ID + PSN ID** gestionados desde el admin
- ✅ **Formulario público de inscripción** desde el lado cliente (modal con campos GT7 ID + PSN ID)
- ✅ **Lista de reservas automática** (`waitlist[]`): cuando el cupo está lleno, nuevos registros se enrutan automáticamente a la lista de espera con posición numerada
- ✅ **Admin puede mover pilotos** de reservas a inscriptos (botón "→ Inscribir" en panel admin)
- ✅ **Verificación de duplicados** en ambas listas (inscriptos y reservas) antes de agregar
- ✅ **Botón公 diferenciado**: verde "✍️ Inscribirse" cuando hay cupo; amarillo "⏳ Ir a Lista de Reservas (N)" cuando está lleno
- ✅ **Mensaje de confirmación** indica posición en lista de reservas cuando aplica
- ✅ **Contador de reservas** visible en el estado de inscripción: `X/Y · Z en reserva`

#### 🎮 8.4.2 Configuración de Reglas por Evento ✅ IMPLEMENTADO

Implementada la misma estructura de reglas detalladas de los circuitos de campeonato:

- ✅ **Circuito**: búsqueda en catálogo de 70+ pistas GT7 con modal de búsqueda
- ✅ **Reglas de carrera**: BOP, ajustes, engine swap, daños (No/Leves/Graves), penalizaciones, atajos, fantasma
- ✅ **Compuestos obligatorios**: selección múltiple de neumáticos (chips seleccionables)
- ✅ **Climatología**: hora del día, multiplicador de tiempo, slots climáticos
- ✅ **Coches permitidos**: toggle + lista de coches específicos
- ✅ **Formato**: carrera única, sprint + carrera, resistencia, time attack, drift
- ✅ **Combustible**: desgaste + velocidad de recarga
- ✅ **Duración/Vueltas**: configurables por evento

#### 📺 8.4.3 Streaming y Caster en Eventos ✅ IMPLEMENTADO

- ✅ **Caster y Host** asignados por evento (mismos campos que en campeonatos)
- ✅ **URL de stream** (opcional) con selector de plataforma (YouTube, Twitch, Kick, Facebook Gaming)
- ✅ **Badge "EN VIVO"** cuando el evento está en estado `live`
- ⚠️ **Mejora pendiente: múltiples casters** — actualmente solo 1 caster por evento (`streaming.casterName: string`). Cambiar a `casters: string[]` (array) para soportar eventos con más de un narrador

#### 🏆 8.4.4 Resultados y Premiación ✅ IMPLEMENTADO (parcial)

- ✅ **Registro de resultados** del evento (posición + nombre del piloto, solo en eventos completados)
- ✅ **Premios/descripción** de premios (campo de texto libre)
- ⬚ **Pendiente**: galería post-evento (capturas, clips, podium)
- ⬚ **Pendiente**: evento vinculado a campeonato (ronda extra)

#### 📅 8.4.5 Eventos Recurrentes y Series

- ✅ **Categorías de evento**: Casual, Competitivo, Especial, Endurance, Time Attack, Drift (implementado con `EVENT_CATEGORIES`)
- ✅ **Duplicar evento**: botón para clonar un evento existente como plantilla rápida
- ⬚ **Pendiente**: eventos recurrentes (auto-replicación semanal/quincenal/mensual)
- ⬚ **Pendiente**: series de eventos con clasificación acumulada
- ⬚ **Pendiente**: plantillas de evento guardables

#### 📊 8.4.6 Mejoras de UX en Eventos ✅ IMPLEMENTADO (parcial)

- ✅ **Filtros** por estado (upcoming/live/completed) en el admin con dashboard de estadísticas
- ✅ **Contador regresivo** visible en EventCard para eventos próximos
- ✅ **Badge EN VIVO** animado con pulso cuando el evento está en estado live
- ✅ **Búsqueda** de eventos por título en el admin
- ✅ **Botón "🔃 Refrescar Evento"** en la página de detalle público para recargar datos manualmente
- ✅ **Banner sin superposición**: título en overlay, descripción como card separada debajo
- ✅ **Corrección BOP/Penalizaciones/Coche Fantasma**: comparación `=== 'SI' || === true` (los toggles admin guardan strings `'SI'`/`'NO'`)
- ✅ **Iconos en EVENT_FORMATS**: todos los formatos (race, sprint+race, endurance, time-attack, drift) tienen campo `icon`
- ✅ **Sistema de tabs por sala**: cada sala en el detalle público tiene tabs Participantes / Resultados (tabs solo visibles si hay resultados)
- ✅ **Lista de participantes en bullet list**: `• PilotName` en lugar de badges tipo chip
- ⬚ **Pendiente**: vista calendario (mes/semana)
- ⬚ **Pendiente**: historial de eventos pasados con resultados archivados
- ⬚ **Pendiente**: compartir evento como imagen
- ⬚ **Pendiente**: recordatorio de evento (notificación push o email)

#### 🏟️ 8.4.7 Eventos Multi-Ronda ✅ IMPLEMENTADO

Soporte para eventos con múltiples rondas y salas paralelas (clasificatorias + final):

**Tipos de evento** (`eventType`):

- `standard` — Evento simple sin rondas
- `eliminatoria` — Ronda 1 clasificatoria (Sala A + Sala B) → Ronda 2 Final único
- `doble_eliminatoria` — Ronda 1 clasificatoria → Ronda 2 (Final A + Final B)

**Estructura de sala** (`rounds[].rooms[]`):

```javascript
{
  name: string,            // 'Sala A', 'Final'
  caster: string,          // Caster asignado a esta sala
  host: string,            // Host PSN de esta sala
  streamUrl: string,       // URL del stream de esta sala
  maxParticipants: number, // 0 = ilimitado; caster ocupa 1 plaza cuando asignado
  participants: [{         // Pilotos asignados
    id, gt7Id, psnId
  }],
  results: [{              // Resultados de carrera
    driverName, psnId, position,
    fastestLap, polePosition, dnf
  }]
}
```

**Capacidad por sala (caster como ocupante)**:

- Campo `maxParticipants` por sala (0 = sin límite)
- Cuando hay caster asignado, ocupa 1 plaza (capacidad efectiva = max - 1 para pilotos)
- Badge en header de sala: verde `X/max plazas`, rojo cuando llena
- El sistema bloquea la asignación si la sala está llena

**Selector de pilotos por ronda**:

- **Ronda 1**: Muestra todos los participantes inscritos del evento
- **Ronda 2+**: Usa `<optgroup>` mostrando **solo los pilotos de la ronda anterior** (filtro inteligente)
- Pilotos ya asignados aparecen como `✓ GT7ID (Asignado)` y están deshabilitados

**Promoción automática** (botón "🚀 Promover a Ronda 2"):

- Recoge todos los resultados de Ronda 1 y los ordena por posición
- `eliminatoria`: los mejores N van a la Final única
- `doble_eliminatoria`: top N → Final A, resto → Final B
- N = `Math.ceil(maxParticipants / 2)` del evento

**Resultados por sala**:

- Botón "📥 Cargar Pilotos": genera automáticamente la lista de resultados desde los participantes asignados
- Reordenar resultados con flechas ▲/▼
- Flags por resultado: ⚡ Vuelta Rápida, 🅿️ Pole Position, ✖ DNF

---

## 9. Modelo de Datos Propuesto (Unificado)

### 9.1 Estructura Firestore Mejorada

```
championships/
└── {champId}/
    ├── name, shortName, description, season
    ├── status: 'draft' | 'upcoming' | 'active' | 'completed' | 'archived'
    ├── edition: number                          ← NUEVO: número de edición
    ├── startDate, endDate
    ├── banner, logo (Firebase Storage URLs)
    ├── type: 'individual' | 'teams'
    ├── categories: ['Gr1', 'Gr2', ...]
    │
    ├── format: {                                ← NUEVO
    │   hasSprint: boolean,
    │   sprintLaps: number,
    │   hasQualify: boolean,
    │   qualifyDuration: number,
    │   hasWarmup: boolean,
    │   warmupDuration: number
    │ }
    │
    ├── scoring: {                               ← MEJORADO
    │   race: { 1: 25, 2: 18, ..., 10: 1 },
    │   sprint: { 1: 10, 2: 8, ..., 5: 2 },     ← NUEVO
    │   qualifying: { 1: 3, 2: 2, 3: 1 },
    │   polePosition: 1,
    │   fastestLap: 1,
    │   fastestLapSprint: 0                      ← NUEVO
    │ }
    │
    ├── rules: {                                 ← NUEVO: reglamento general
    │   maxDriversPerSala: 15,
    │   mandatoryLogo: boolean,
    │   eligibleCars: string[],
    │   minCarUsage: number,                     ← Uso mínimo por coche
    │   maxCars: number,
    │   registrationOpen: boolean,
    │   regulationText: string,                  ← Texto libre del reglamento
    │   regulationVersion: number
    │ }
    │
    ├── promotion: {                             ← NUEVO: ascensos/descensos
    │   enabled: boolean,
    │   promoteCount: 5,
    │   demoteCount: 5,
    │   restPeriodWeeks: 2
    │ }
    │
    ├── streaming: {                             ← MEJORADO
    │   defaultPlatform: 'youtube' | 'twitch' | 'kick' | 'facebook' | 'other',
    │   channelUrl: string | null,               ← URL del canal (opcional)
    │   casterName: string | null,               ← Nombre del caster principal
    │   hostName: string | null                  ← NUEVO: host de la sala
    │ }
    │
    ├── registration: {                           ← NUEVO: inscripción pública
    │   enabled: boolean,                         ← Toggle inscripción abierta (default: false)
    │   requiresApproval: boolean,               ← true = admin aprueba, false = auto
    │   deadline: ISO string | null,             ← Fecha límite (opcional)
    │   maxDrivers: number | null,               ← Máximo global de pilotos
    │   requiredFields: string[],                ← Campos requeridos: ['psnId', 'country']
    │   acceptRegulation: boolean                ← Deben aceptar reglamento para inscribirse
    │ }
    │
    ├── penaltyConfig: {                          ← NUEVO: configuración de sanciones
    │   enabled: boolean,                         ← Toggle sistema sanciones (default: false)
    │   claimsEnabled: boolean,                  ← Reclamaciones públicas habilitadas
    │   warningsBeforeSanction: number | null,   ← Amonestaciones antes de sanción auto
    │   warningPenalty: {                         ← Qué pasa al acumular amonestaciones
    │       type: 'points' | 'time' | 'dsq',
    │       value: number
    │   } | null,
    │   presets: [{                               ← Sanciones predefinidas editables
    │       id: string,
    │       name: string,
    │       type: 'time' | 'points' | 'dsq' | 'ban' | 'warning',
    │       defaultValue: number,
    │       severity: 'light' | 'serious' | 'very_serious',
    │       enabled: boolean,                    ← Desactivar si no aplica
    │       isCustom: boolean                    ← true = creada por admin
    │   }]
    │ }
    │
    ├── clonedFrom: string | null,                ← NUEVO: ID del campeonato del que se clonó
    │
    ├── createdAt, updatedAt
    ├── createdBy
    │
    │── divisions/                               ← NUEVO: subcolección
    │   └── {divId}/
    │       ├── name: "División 1"
    │       ├── order: 1
    │       ├── maxDrivers: 15
    │       ├── drivers: string[]
    │       ├── hostPSN: string                  ← Host de la sala GT7
    │       ├── hostName: string | null          ← NUEVO: nombre del host
    │       ├── casterName: string | null        ← NUEVO: caster asignado a esta división
    │       ├── streamUrl: string | null         ← NUEVO: URL de stream por sala
    │       └── status: 'active' | 'locked'
    │
    ├── teams/                                   (existente, mejorado)
    │   └── {teamId}/
    │       ├── name, color, logo
    │       ├── drivers: [{ name, psnId, category, divisionId }]
    │       └── createdAt, updatedAt
    │
    ├── tracks/                                  (existente, mejorado)
    │   └── {trackId}/
    │       ├── name, country, layoutImage
    │       ├── round, date, status
    │       ├── raceType: 'sprint+race' | 'race' | 'endurance'  ← MEJORADO
    │       ├── laps, duration
    │       │
    │       ├── raceConfig: {                    ← MEJORADO (de hgt_gt7)
    │       │   bop: boolean,
    │       │   adjustments: boolean,
    │       │   engineSwap: boolean,
    │       │   damage: 'none' | 'light' | 'heavy',
    │       │   penalties: boolean,
    │       │   shortcutPenalty: 'none' | 'weak' | 'strong',
    │       │   wallPenalty: boolean,
    │       │   ghostCar: boolean
    │       │ }
    │       │
    │       ├── tyres: {                         ← NUEVO
    │       │   mandatoryRace: string[],         ← ['CD', 'CM']
    │       │   mandatoryQualify: string,        ← 'CM'
    │       │   mandatorySprint: string,         ← 'CB'
    │       │   wear: number,                    ← multiplicador x1-x10
    │       │   minCompoundsUsed: number         ← ej: 2
    │       │ }
    │       │
    │       ├── fuel: {                          ← NUEVO
    │       │   wear: number,                    ← multiplicador x1-x10
    │       │   initialFuel: number | 'default',
    │       │   refillRate: number
    │       │ }
    │       │
    │       ├── weather: {                       ← MEJORADO
    │       │   timeOfDay: string,               ← 'Atardecer'
    │       │   timeMultiplier: number,          ← x5
    │       │   weatherSlots: string,            ← 'S18/C05/R07/...'
    │       │   rainProbability: string          ← 'Variable'
    │       │ }
    │       │
    │       ├── cars: {                          ← MEJORADO
    │       │   specificCars: boolean,
    │       │   allowedCars: string[],
    │       │   mandatoryCar: string | null      ← Coche Gr obligatorio
    │       │ }
    │       │
    │       ├── sprint: {                        ← NUEVO
    │       │   laps: number,
    │       │   startType: 'grid' | 'rolling',
    │       │   tyreWear: number,
    │       │   fuelWear: number
    │       │ }
    │       │
    │       ├── streamUrl: string                ← NUEVO: link al directo
    │       └── hostPSN: string                  ← NUEVO: anfitrión
    │
    ├── results/                                 ← NUEVO (inspirado en hgt_gt7)
    │   └── {resultId}/
    │       ├── trackId: string
    │       ├── divisionId: string               ← NUEVO
    │       ├── sessionType: 'race' | 'sprint' | 'qualify'
    │       ├── raceResults: [{
    │       │   driverName: string,
    │       │   position: number,
    │       │   polePosition: boolean,
    │       │   fastestLap: boolean,
    │       │   carUsed: string,                 ← NUEVO
    │       │   dnf: boolean,                    ← NUEVO
    │       │   dsq: boolean                     ← NUEVO
    │       │ }]
    │       ├── createdAt, updatedAt
    │       └── createdBy
    │
    ├── sanctions/                               ← NUEVO: subcolección
    │   └── {sanctionId}/
    │       ├── driverName: string
    │       ├── trackId: string | null           ← En qué carrera
    │       ├── type: 'time' | 'points' | 'dsq' | 'ban' | 'warning'
    │       ├── severity: 'light' | 'serious' | 'very_serious'
    │       ├── value: number                    ← +30s, -3pts, etc.
    │       ├── presetId: string | null          ← NUEVO: referencia a preset usado
    │       ├── reason: string
    │       ├── description: string
    │       ├── evidence: string[]               ← NUEVO: URLs de clips/capturas
    │       ├── status: 'active' | 'appealed' | 'resolved'
    │       ├── issuedBy: string
    │       ├── createdAt, updatedAt
    │       └── resolvedAt: Date | null
    │
    ├── registrations/                           ← NUEVO: subcolección de inscripciones
    │   └── {registrationId}/
    │       ├── driverName: string
    │       ├── psnId: string
    │       ├── country: string | null
    │       ├── preferredTeam: string | null
    │       ├── preferredDivision: string | null
    │       ├── category: string | null
    │       ├── acceptedRegulation: boolean
    │       ├── status: 'pending' | 'approved' | 'rejected'
    │       ├── reviewedBy: string | null
    │       ├── reviewedAt: Date | null
    │       ├── createdAt
    │       └── rejectionReason: string | null
    │
    └── claims/                                  ← NUEVO: subcolección
        └── {claimId}/
            ├── claimantDriver: string
            ├── accusedDriver: string
            ├── trackId: string
            ├── description: string
            ├── evidence: string[]               ← URLs de clips/capturas
            ├── status: 'pending' | 'reviewing' | 'resolved' | 'dismissed'
            ├── resolution: string | null
            ├── sanctionId: string | null        ← Si resultó en sanción
            ├── createdAt, updatedAt
            └── resolvedBy: string | null
```

### 9.2 Colecciones de Nivel Superior (adicionales)

```
drivers/                                         ← NUEVO: perfil global de piloto
└── {driverId}/
    ├── name: string
    ├── psnId: string
    ├── avatar: string
    ├── country: string
    ├── currentTeam: string | null
    ├── championships: string[]                  ← IDs de campeonatos participados
    ├── stats: {
    │   totalRaces, wins, podiums, poles,
    │   fastestLaps, dnfs, sanctions
    │ }
    └── createdAt

editions/                                        ← NUEVO: historial de ediciones
└── {editionId}/
    ├── number: 10
    ├── championshipId: string
    ├── champion: string
    ├── topThree: string[]
    └── season: string

events/                                          ← MEJORADO: eventos únicos
└── {eventId}/
    ├── title: string
    ├── description: string
    ├── date: ISO string
    ├── hour: string
    ├── track: string                            ← Nombre del circuito
    ├── eventType: 'standard' | 'eliminatoria' | 'doble_eliminatoria'  ← NUEVO
    ├── rounds: [{                               ← NUEVO: solo si eventType != 'standard'
    │   name: string,                           ← 'Ronda 1 – Clasificatoria'
    │   rooms: [{
    │       name: string,                        ← 'Sala A', 'Final'
    │       caster: string,
    │       host: string,
    │       streamUrl: string,
    │       maxParticipants: number,             ← 0 = ilimitado; caster ocupa 1 plaza
    │       participants: [{id, gt7Id, psnId}],
    │       results: [{driverName, psnId, position, fastestLap, polePosition, dnf}]
    │   }]
    │ }]                                         ← estructura de rondas anidada
    ├── trackConfig: {                           ← config completa del circuito
    │   name, country, layoutImage,
    │   laps, duration, raceType,
    │   raceConfig: { bop, damage, ... },
    │   tyres: { ... },
    │   weather: { ... },
    │   cars: { ... }
    │ } | null
    ├── registration: {
    │   enabled: boolean,
    │   requiresApproval: boolean,
    │   deadline: ISO string | null,
    │   maxParticipants: number | null
    │ }
    ├── streaming: {
    │   url: string | null,
    │   casterName: string | null,
    │   hostName: string | null,
    │   platform: string | null
    │ }
    ├── format: 'race' | 'sprint+race' | 'endurance' | 'time-attack' | 'drift'
    ├── category: 'casual' | 'competitive' | 'special' | 'endurance'
    ├── prizes: string | null
    ├── maxParticipants: number
    ├── participants: [{id, gt7Id, psnId, registeredAt}]  ← Lista principal
    ├── waitlist: [{                             ← NUEVO: lista de reservas
    │   id, gt7Id, psnId,
    │   waitlistPosition: number,               ← Posición en la cola (1, 2, 3...)
    │   registeredAt: ISO string
    │ }]
    ├── results: [{driverName, position, points, fastestLap, polePosition}] | null
    ├── status: 'upcoming' | 'live' | 'completed'
    ├── gallery: string[]                        ← URLs de capturas post-evento
    ├── createdAt, updatedAt
    └── createdBy
    ├── createdAt, updatedAt
    └── createdBy

eventSeries/                                     ← NUEVO: series de eventos
└── {seriesId}/
    ├── name: string                             ← "Noches de Endurance"
    ├── description: string
    ├── events: string[]                         ← IDs de eventos
    ├── scoring: { ... } | null                  ← Puntos acumulados (opcional)
    └── createdAt
```

---

## 10. Roadmap Priorizado

### Fase 1 — Limpieza y Unificación (1-2 semanas)

| #   | Tarea                                                                              | Esfuerzo |
| --- | ---------------------------------------------------------------------------------- | -------- |
| 1.1 | ~~Eliminar código legacy (`Dashboard.js`, `tracks.js`)~~                           | ✅ Hecho |
| 1.2 | ~~Extraer utilidades compartidas (`dateUtils`, `championshipUtils`, `constants`)~~ | ✅ Hecho |
| 1.3 | ~~Unificar formularios new/edit en un solo `ChampionshipForm.js`~~                 | ✅ Hecho |
| 1.4 | ~~Crear componentes de medalla y reemplazar 5 duplicados~~                         | ✅ Hecho |
| 1.5 | ~~Crear componente `StatusBadge` unificado~~                                       | ✅ Hecho |
| 1.6 | ~~Extraer `StandingsTable` como componente reutilizable~~                          | ✅ Hecho |
| 1.7 | ~~Corregir bug de inconsistencia de puntos~~                                       | ✅ Hecho |
| 1.8 | ~~Paralelizar `loadChampionshipsTracks` con `Promise.all`~~                        | ✅ Hecho |
| 1.9 | ~~Implementar `ErrorMessage` y `LoadingSkeleton`~~                                 | ✅ Hecho |

### Fase 2 — Inscripción, Streaming y Reutilización (1-2 semanas)

| #   | Tarea                                                                           | Esfuerzo |
| --- | ------------------------------------------------------------------------------- | -------- |
| 2.1 | ~~Toggle de inscripción pública en formulario de campeonato~~                   | ✅ Hecho |
| 2.2 | ~~Formulario público de inscripción (lado cliente) con campos configurables~~   | ✅ Hecho |
| 2.3 | ~~Panel admin de aprobación/rechazo de inscripciones (batch)~~                  | ✅ Hecho |
| 2.4 | ~~Campos Caster + Host + URL de stream a nivel de campeonato~~                  | ✅ Hecho |
| 2.5 | ~~Caster/Host/Stream por división (campeonatos multi-sala)~~                    | ✅ Hecho |
| 2.6 | ~~Selector "Basar en campeonato anterior" al crear campeonato (clonar config)~~ | ✅ Hecho |
| 2.7 | ~~Botón "Importar pilotos/equipos de campeonato anterior" con merge~~           | ✅ Hecho |
| 2.8 | ~~Botón "Ver en vivo" + badge "EN VIVO" en vista pública~~                      | ✅ Hecho |

### Fase 3 — Standings Avanzado (1 semana)

| #   | Tarea                                                                      | Esfuerzo |
| --- | -------------------------------------------------------------------------- | -------- |
| 3.1 | ~~Portar `standingsCalculator.js` de hgt_gt7 con desempate multinivel~~    | ✅ Hecho |
| 3.2 | ~~Reutilizar `track.results` inline (no subcolección) para stats~~         | ✅ Hecho |
| 3.3 | ~~Tabla de standings con puntos por carrera individual (columnas sticky)~~ | ✅ Hecho |
| 3.4 | ~~Estadísticas por piloto: wins, podiums, poles, fastest laps~~            | ✅ Hecho |
| 3.5 | ~~Comparador de pilotos (head-to-head)~~                                   | ✅ Hecho |

**Archivos creados/modificados en Fase 3:**

- `src/app/utils/standingsCalculator.js` — Motor avanzado con desempate multinivel (puntos→victorias→podiums→mejor posición), estadísticas y comparador. 3 funciones exportadas: `calculateAdvancedStandings()`, `getDriverStats()`, `compareDrivers()`
- `src/app/components/championship/DriverStatsPanel.js` — Panel de estadísticas detalladas: récords, rankings por victorias/podiums/poles/VR, tabla completa de stats
- `src/app/components/championship/DriverComparator.js` — Comparador head-to-head: selectores, cara a cara, barras de comparación, puntos por carrera
- `src/app/components/championship/StandingsTable.js` — Expandido: columnas por carrera (R1,R2...), columnas de stats (Vic/Pod), sticky columns, scroll horizontal, tooltips
- `src/app/championships/page.js` — Integrado: tab Clasificación con tabla avanzada, tab Estadísticas con DriverStatsPanel, nuevo tab ⚔️ Comparar
- `src/app/utils/index.js` — Barrel export actualizado con 3 nuevas funciones
- **Decisión arquitectónica**: Los datos de resultados detallados YA existen en `track.results` (racePositions, qualifying, fastestLap), por lo que NO se necesitó crear una subcolección separada — el motor simplemente extrae estadísticas de los datos inline existentes.

### Fase 4 — Sanciones Configurables (1-2 semanas) ✅ COMPLETADA

| #   | Tarea                                                                             | Esfuerzo | Estado   |
| --- | --------------------------------------------------------------------------------- | -------- | -------- |
| 4.1 | Toggle de sanciones + modelo de datos con presets editables                       | 4h       | ✅ Hecho |
| 4.2 | UI admin: catálogo de sanciones predefinidas (editar valores, activar/desactivar) | 4h       | ✅ Hecho |
| 4.3 | UI admin: crear sanciones personalizadas (nombre, tipo, valor, severidad)         | 4h       | ✅ Hecho |
| 4.4 | Aplicar sanción a piloto por carrera (con evidencia opcional)                     | 4h       | ✅ Hecho |
| 4.5 | Impacto automático de sanciones en clasificación                                  | 4h       | ✅ Hecho |
| 4.6 | Sistema de amonestaciones acumulativas (configurable)                             | 3h       | ✅ Hecho |
| 4.7 | Formulario público de reclamaciones (sub-toggle)                                  | 5h       | ✅ Hecho |
| 4.8 | Panel admin de resolución de reclamaciones                                        | 5h       | ✅ Hecho |
| 4.9 | Historial y exportación de sanciones                                              | 3h       | ✅ Hecho |

**Archivos creados/modificados en Fase 4:**

- `src/app/models/Penalty.js` — Modelo Penalty, Claim, 12 PENALTY_PRESETS, configs
- `src/app/components/championship/PenaltiesTab.js` — Tab admin completo (catálogo, aplicar, historial, resolver claims)
- `src/app/components/championship/ClaimForm.js` — Formulario público de reclamaciones
- `src/app/models/Championship.js` — Campo penaltiesConfig
- `src/app/services/firebaseService.js` — 7 métodos CRUD (penalties + claims)
- `src/app/utils/standingsCalculator.js` — Integración de sanciones y warnings acumulativos
- `src/app/components/championship/StandingsTable.js` — Indicador visual de penalizaciones
- `src/app/components/championship/ChampionshipForm.js` — Sección de config sanciones en Step 4
- `src/app/championshipsAdmin/page.js` — Tab ⚠️ Sanciones integrado
- `src/app/championships/page.js` — Tab público + botón reclamaciones + penalties en standings

### Fase 5 — Reglamentación y Config de Circuitos ✅ COMPLETADA

| #   | Tarea                                                          | Esfuerzo | Estado   |
| --- | -------------------------------------------------------------- | -------- | -------- |
| 5.1 | Ampliar modelo Track con `tyres`, `fuel`, `weather` detallados | 4h       | ✅ Hecho |
| 5.2 | Formulario de compuestos obligatorios por circuito             | 3h       | ✅ Hecho |
| 5.3 | Climatología avanzada (hora del día, multiplicador, slots)     | 3h       | ✅ Hecho |
| 5.4 | Sección de reglamento editable por campeonato                  | 4h       | ✅ Hecho |
| 5.5 | Formato Sprint + Carrera (dual session)                        | 6h       | ✅ Hecho |
| 5.6 | Control de uso de coches (tracking y alertas)                  | 4h       | ✅ Hecho |

**Archivos modificados/creados:**

- `src/app/models/Championship.js` — Track model con rules tipados, sprint, weatherSlots, carUsage, mandatoryPitStops; Championship con regulations + carUsageTracking
- `src/app/utils/constants.js` — WEATHER_CONDITION_OPTIONS, WEATHER_TRANSITION_OPTIONS, START_TIME_OPTIONS, TIME_MULTIPLIER_OPTIONS, DEFAULT_SPRINT_POINTS
- `src/app/components/championship/ChampionshipForm.js` — Modal de circuito con sprint+carrera, clima avanzado con slots dinámicos, pit stops obligatorios, notas; Step 4 con reglamentación y tracking de autos
- `src/app/utils/standingsCalculator.js` — Soporte sprint points (track.sprintPoints sumado al total)
- `src/app/championshipsAdmin/page.js` — Modal de resultados con sección Sprint, cálculo de puntos sprint
- `src/app/championships/page.js` — Calendar con badges de reglas y notas; Info tab con reglamentación y tracking de autos

### Fase 6 — Divisiones y Ascensos (2-3 semanas)

| #   | Tarea                                                | Esfuerzo |
| --- | ---------------------------------------------------- | -------- |
| 6.1 | ~~Modelo de divisiones (subcolección)~~              | ✅ Hecho |
| 6.2 | ~~UI admin para crear/gestionar divisiones~~         | ✅ Hecho |
| 6.3 | ~~Clasificación por división (standings separados)~~ | ✅ Hecho |
| 6.4 | ~~Sistema de ascensos/descensos entre ediciones~~    | ✅ Hecho |

**Archivos modificados/creados en Fase 6:**

- `src/app/models/Championship.js` — Clase `Division` (subcolección `divisions/`), `divisionsConfig` en Championship (enabled, promotionCount, relegationCount, maxDriversPerDivision)
- `src/app/utils/constants.js` — `DEFAULT_DIVISION_COLORS`, `DEFAULT_DIVISIONS_CONFIG`
- `src/app/services/firebaseService.js` — CRUD de divisiones (getDivisionsByChampionship, createDivision, updateDivision, deleteDivision)
- `src/app/utils/standingsCalculator.js` — Filtro `options.divisionDrivers` para calcular standings por división
- `src/app/components/championship/DivisionsTab.js` — **NUEVO**: Tab admin con CRUD de divisiones, asignación de pilotos, auto-asignación, promoción/relegación con vista previa
- `src/app/components/championship/ChampionshipForm.js` — Toggle y configuración de divisiones en Step 4
- `src/app/championshipsAdmin/page.js` — Integración tab Divisiones con estado, carga de datos y renderizado
- `src/app/championships/page.js` — Selector de división en standings públicos, filtrado dinámico
- `src/app/components/championship/StandingsTable.js` — Props `promotionZone`/`relegationZone` con indicadores visuales (▲/▼, bordes verde/rojo)

### Fase 7 — Eventos Mejorados (1-2 semanas) ✅ COMPLETADA

| #   | Tarea                                                                     | Esfuerzo | Estado   |
| --- | ------------------------------------------------------------------------- | -------- | -------- |
| 7.1 | Inscripción pública en eventos (toggle habilitación + modo aprobación)    | 3h       | ✅ Hecho |
| 7.2 | Configuración detallada de reglas por evento (raceConfig, tyres, weather) | 4h       | ✅ Hecho |
| 7.3 | Caster/Host/Stream por evento                                             | 2h       | ✅ Hecho |
| 7.4 | Resultados y premiación de eventos                                        | 3h       | ✅ Hecho |
| 7.5 | Categorías y formatos de evento                                           | 2h       | ✅ Hecho |
| 7.6 | Participantes con PSN ID + gestión visual                                 | 3h       | ✅ Hecho |
| 7.7 | Dashboard con contador regresivo + badges de estado + EN VIVO             | 3h       | ✅ Hecho |

**Archivos modificados/creados en Fase 7:**

- `src/app/eventsAdmin/page.js` — Reescritura completa (~1100 líneas): formulario con 9 secciones colapsables (CollapsibleSection), búsqueda de pistas del catálogo GT7, configuración de reglas (BOP, daños, desgaste, combustible), neumáticos obligatorios multi-select, climatología avanzada (hora del día, multiplicador, slots), coches permitidos, streaming con caster/host/URL/plataforma, inscripción pública con toggle y modo aprobación, participantes con nombre + PSN ID, resultados para eventos completados, duplicar evento, estadísticas del dashboard
- `src/app/components/EventCard.js` — Card pública mejorada: badge de estado dinámico (upcoming/live/completed), countdown al evento, badge EN VIVO animado, badge de evento especial, badges de categoría/formato, info de streaming (caster/host), indicadores de participantes e inscripción, premios, botón "Ver en vivo"
- `src/app/events/page.js` — Página de detalle público del evento con toda la info expandida
- `src/app/components/DashboardRenovated.js` — Integración de EventCard con navegación a detalle vía `/events?id=`
- `src/app/services/firebaseService.js` — Métodos `getEvent()`, `saveEvent()`, `deleteEvent()`
- `src/app/utils/constants.js` — Constantes: `EVENT_STATUSES`, `EVENT_CATEGORIES`, `EVENT_FORMATS`, `STREAMING_PLATFORMS`, `TYRE_OPTIONS`, `DAMAGE_OPTIONS`, `WEATHER_TIME_OPTIONS`, `WEATHER_CONDITION_OPTIONS`
- `src/app/models/Championship.js` — Event model actualizado

**Nota sobre Casters:** Actualmente un evento soporta 1 caster (`streaming.casterName: string`). Se contempla como mejora futura permitir **múltiples casters** por evento (`casters: string[]`), ya que un evento único con múltiples salas o una transmisión conjunta puede requerir más de un narrador.

### Fase 8 — Experiencia Avanzada (~1 semana) ✅ COMPLETADA

| #   | Tarea                                                   | Esfuerzo | Estado |
| --- | ------------------------------------------------------- | -------- | ------ |
| 8.1 | Perfiles globales de piloto con estadísticas históricas | 6h       | ✅     |
| 8.2 | Exportar clasificación como imagen PNG                  | 4h       | ✅     |
| 8.3 | Briefing pre-carrera (vista informativa + compartir)    | 4h       | ✅     |

**Archivos creados/modificados en Fase 8:**

- `src/app/pilots/page.js` — Página pública de perfiles globales de piloto: listado con tabla completa, podium top 3, vista detalle por piloto con stats históricas acumuladas de todos los campeonatos, historial de campeonatos con posición final
- `src/app/components/championship/ExportableStandings.js` — Componente para exportar clasificación como imagen PNG: modal de preview, descarga directa y copiar al clipboard, diseño optimizado para redes sociales con tabla de equipos (si aplica) y pilotos
- `src/app/components/championship/RaceBriefing.js` — Briefing pre-carrera exportable: resumen visual de la próxima carrera (circuito, fecha, countdown, formato, climatología, desgaste, neumáticos obligatorios, coches permitidos, penalizaciones, streaming), exportable como PNG
- `src/app/championships/page.js` — Integrados botones "Exportar como Imagen" y "Briefing Pre-Carrera" en el tab de clasificación
- `src/app/components/Navbar.js` — Agregado enlace "🏎️ Pilotos" en la navegación principal
- `src/app/utils/index.js` — Agregados re-exports de `calculateAdvancedStandings`, `getDriverStats`, `compareDrivers` desde standingsCalculator
- `package.json` — Agregada dependencia `html-to-image` para exportar como imagen

### Fase 9 — Gestión Avanzada de Eventos (6 de marzo 2026) ✅ COMPLETADA

Mejoras posteriores al roadmap original, enfocadas en la página de detalle de eventos y capacidad de salas:

| #    | Tarea                                                                                | Estado   |
| ---- | ------------------------------------------------------------------------------------ | -------- |
| 9.1  | Eventos multi-ronda (eliminatoria / doble eliminatoria)                              | ✅ Hecho |
| 9.2  | Capacidad máxima por sala con caster como ocupante                                   | ✅ Hecho |
| 9.3  | Lista de reservas en admin (waitlist[]) + mover a inscriptos                         | ✅ Hecho |
| 9.4  | Lista de reservas pública: auto-enrutamiento al inscribirse con cupo lleno           | ✅ Hecho |
| 9.5  | Selector inteligente de pilotos por ronda (optgroup, Ronda 2 filtra Ronda 1)         | ✅ Hecho |
| 9.6  | Promoción automática R1→R2 según tipo de evento                                      | ✅ Hecho |
| 9.7  | Sistema de tabs por sala en detalle público (Participantes / Resultados)             | ✅ Hecho |
| 9.8  | Corrección display BOP/Penalizaciones/Coche Fantasma (comparación strings 'SI'/'NO') | ✅ Hecho |
| 9.9  | Iconos en EVENT_FORMATS (constants.js)                                               | ✅ Hecho |
| 9.10 | Botón "🔃 Refrescar Evento" en detalle público                                       | ✅ Hecho |
| 9.11 | Banner sin superposición de descripción                                              | ✅ Hecho |
| 9.12 | Responsive: AdminLayout hamburger drawer + grids responsive en admin                 | ✅ Hecho |

**Archivos modificados/creados en Fase 9:**

- `src/app/eventsAdmin/page.js` — Añadidos:
  - **`eventType`**: selector `standard / eliminatoria / doble_eliminatoria`
  - **`rounds[]` con `rooms[]`**: estructura multi-sala con caster, host, streamUrl, maxParticipants
  - **`room.maxParticipants`** (0 = ∞): campo en UI; caster cuenta como 1 plaza en validación
  - **`waitlist[]`**: array a nivel de evento; cuando cupo lleno, nuevos pilotos van aquí automáticamente
  - Sección "⏳ Lista de Reservas" con botón "→ Inscribir" por piloto
  - Botón ➕ cambia a "⏳ Añadir a Reservas" cuando el cupo está lleno
  - Badge del header de sala muestra `X/max plazas` (rojo cuando llena)
  - Badge de la sección Participantes muestra `N/max · ⏳K en reserva`
  - Selector de piloto por sala: `<optgroup>` diferencia ronda anterior vs. todos
  - `addParticipantToRoom`: bloquea con alert si sala llena (caster incluido)
  - Botón "🚀 Promover a Ronda 2": mueve resultados R1 → participantes R2
  - `generateRoomResultsFromParticipants`: genera resultados desde participantes ("📥 Cargar Pilotos")
  - `moveRoomResult`: reordenar resultados con ▲/▼
  - Flags por resultado: ⚡ Vuelta Rápida, 🅿️ Pole Position, ✖ DNF

- `src/app/events/page.js` — Actualizaciones:
  - **Sistema de tabs por sala**: `roomTabs` state keyed `${activeRound}-${rmIdx}`
  - Tabs Participantes/Resultados visibles solo si la sala tiene resultados
  - Lista de participantes en bullet list (`• PilotName`)
  - `waitlistCount` calculado desde `event.waitlist?.length`
  - Contador de participantes: `X / max · Z en reserva`
  - Estado inscripción: `"Abierta (en reserva)"` cuando llena pero abierta
  - Botón público diferenciado: verde cuando hay cupo, amarillo/naranja cuando lleno
  - Mensaje de confirmación incluye posición en la lista de reservas
  - Descripción movida fuera del overlay del banner (card separada)
  - Botón "🔃 Refrescar Evento"
  - Corrección: BOP/Penalizaciones/Coche Fantasma comparan `=== 'SI' || === true`
  - Protección: `fmt?.icon ? \`${fmt.icon} ${fmt.label}\` : fmt.label`

- `src/app/services/firebaseService.js` — `addEventParticipant` mejorado:
  - Verifica duplicados en `participants` Y `waitlist` antes de agregar
  - Si `isFull`: agrega a `waitlist[]` con `waitlistPosition` y retorna `{ waitlisted: true, position: N }`
  - Si hay cupo: agrega a `participants[]` y retorna `{ waitlisted: false }`
  - El modal de inscripción público muestra el mensaje adecuado según `result.waitlisted`

- `src/app/utils/constants.js` — `EVENT_FORMATS` ahora incluye campo `icon` en todas las entradas; `getDefaultRounds()` añade `maxParticipants: 0` al modelo de sala

**Patrones técnicos clave de esta fase:**

```javascript
// Capacidad de sala considerando caster
const getRoomFull = (room) => {
  if (!room.maxParticipants) return false; // 0 = ilimitado
  const casterSlots = room.caster ? 1 : 0;
  return (room.participants?.length || 0) + casterSlots >= room.maxParticipants;
};

// Guardar strings 'SI'/'NO' en admin; comparar correctamente en display
const isBopActive = event.rules.bop === "SI" || event.rules.bop === true;

// waitlist con posición
await updateDoc(eventRef, {
  waitlist: [...currentWaitlist, { ...newParticipant, waitlistPosition }],
});
```

---

## Resumen Final

| Métrica                                       | Valor                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Funcionalidades actuales**                  | ~25 features funcionales                                                                              |
| **Funcionalidades nuevas propuestas**         | ~35 features (todas opcionales)                                                                       |
| **Bugs detectados**                           | 4 (1 crítico) — **todos corregidos**                                                                  |
| **Duplicaciones de código**                   | 6 patrones — **6 resueltos (todos)**                                                                  |
| **Líneas de código duplicadas** (new vs edit) | ✅ Unificado: ~4,200 → ~850 líneas (`ChampionshipForm.js`) — reducción del 79%                        |
| **Módulos opcionales propuestos**             | 8 (sanciones, inscripción, divisiones, streaming, sprint, compuestos, reglamento, reclamaciones)      |
| **Mejoras para eventos únicos**               | 7 subsecciones (incluye multi-ronda con salas, waitlist y UX del detalle)                             |
| **Recomendaciones adicionales**               | Descartadas (roles, Discord, PWA, audit, temas) — solo se implementan: perfiles, export PNG, briefing |
| **Fases del roadmap**                         | 9 fases — **todas completadas** ✅                                                                    |
| **Esfuerzo total estimado**                   | ~12-16 semanas (1 desarrollador)                                                                      |
| **Principio de diseño clave**                 | Todo es opcional por campeonato                                                                       |

El sistema actual tiene una base sólida en `imsa_gt7` tras las correcciones realizadas (bugs corregidos, utilidades centralizadas, código legacy deprecado). Las **Fases 1-8 están completadas**, cubriendo: limpieza y unificación de código, inscripción y streaming, standings avanzados con estadísticas y comparador, sistema de sanciones configurables, reglamentación y configuración de circuitos, divisiones con ascensos/descensos, eventos mejorados con CRUD completo, y experiencia avanzada (perfiles, export PNG, briefing). La **Fase 9** (6 de marzo 2026) añadió: eventos multi-ronda (eliminatoria/doble eliminatoria) con salas paralelas, promoción automática R1→R2, capacidad máxima por sala con caster como ocupante, lista de reservas pública y de admin (`waitlist[]`), selector inteligente de pilotos por ronda, sistema de tabs por sala en el detalle público, y correcciones de display. Las nuevas propuestas siguen el **principio de opcionalidad**: cada módulo se activa independientemente. **Todas las 9 fases del roadmap están completadas.**

---

## 11. Reglamento Unificado Público

> **Fecha de implementación:** 1 de marzo de 2026  
> **Ruta:** `/reglamento`  
> **Basado en:** PDF "WORLD SERIES LEAGUE RR 10°MA EDICIÓN", PDF "Normativa DAS 2.3", reglas comunes de sim racing competitivo

### 11.1 Motivación

Los pilotos necesitan un punto de referencia claro y accesible antes de participar en campeonatos o eventos. Las reclamaciones y quejas suelen ocurrir cuando las reglas no están disponibles o son ambiguas. Una página pública de reglamento unificado:

- Reduce reclamaciones innecesarias
- Establece expectativas claras antes de inscribirse
- Sirve como referencia para la resolución de disputas
- Se puede referenciar desde el formulario de inscripción (checkbox "Acepto el reglamento")

### 11.2 Estructura del Reglamento

El reglamento público (`/reglamento`) se divide en las siguientes secciones:

| Sección                       | Contenido                                                              |
| ----------------------------- | ---------------------------------------------------------------------- |
| **1. Conducta General**       | Deportividad, respeto entre pilotos, comunicación                      |
| **2. Configuración de Sala**  | Cómo se configura la sala GT7, quién es host, tiempos de apertura      |
| **3. Clasificación**          | Normas de qualify, respeto en pista, banderas azules                   |
| **4. Carrera**                | Salidas, adelantamientos, pit stops, banderas azules, límites de pista |
| **5. Incidentes y Contactos** | Qué se considera incidente, niveles de gravedad, procedimiento         |
| **6. Sanciones**              | Tabla de sanciones con tipos y valores, amonestaciones acumulativas    |
| **7. Reclamaciones**          | Cómo presentar una reclamación, evidencia requerida, plazos            |
| **8. Desconexiones y Lag**    | Qué pasa si un piloto se desconecta, criterios de reinicio             |
| **9. Reglas Específicas**     | BOP, neumáticos obligatorios, coches elegibles, logos                  |

### 11.3 Referencia a Reglamentos Externos

El contenido del reglamento unificado incorpora las mejores prácticas extraídas de:

- **World Series League RR (10ᵐᵃ Edición)**: Sistema de divisiones, sanciones por compuestos, uso obligatorio de coches, banderas azules, formulario de reclamaciones, penalizaciones por no presentarse
- **Normativa DAS 2.3**: Reglas de conducta, niveles de severidad de incidentes, procedimientos de reclamación, gestión de lag y desconexiones

### 11.4 Archivos Creados

- `src/app/reglamento/page.js` — Página pública del reglamento unificado
- `src/app/components/Navbar.js` — Enlace "📜 Reglamento" en navegación
