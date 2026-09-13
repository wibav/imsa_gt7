# Plan — Equipos de la comunidad

Ficha permanente para cada equipo (HGT, RRT…), confirmada por el Administrador
de Plataforma a partir de las siglas que los pilotos llevan en su GT7 ID, y
sección pública hermana de «Pilotos». Maqueta y plan visual:
https://claude.ai/code/artifact/d95e989d-d364-49bc-ab0e-690b59dd7e88

Estado (2026-09-13): **fases 0 a 4 y pendientes implementados.**

> **Quién decide.** Las siglas solo PROPONEN equipos y miembros. GT7 solo deja
> cambiar el GT7 ID tres veces, así que quien se va de un equipo puede seguir
> llevando sus siglas. El equipo de un piloto es el que confirma el
> administrador, nunca el que dice su nombre.

## Decisiones

| Pregunta | Decisión |
|---|---|
| Quién gestiona | Solo el Administrador de Plataforma. Más adelante, quizá cada organización el suyo. |
| `/teamsAdmin` | Son los 4 equipos de 4 pilotos inventados solo para el campeonato por equipos IMSA GT7 2025. Se conserva como «Equipos del campeonato IMSA 2025». Equipos va aparte. |
| Nombre del piloto | GT7 ID unificado, como hoy. Delante, el avatar del equipo confirmado. |
| Qué suma el equipo | Todo el historial de sus miembros actuales. Los ex-miembros se muestran pero no suman. |
| Nombre del equipo | Lo escribe el administrador: el significado real de las siglas. |

## Modelo

No confundir con los equipos de un campeonato por equipos
(`championships/{id}/teams`) ni con la colección raíz `teams` (editor antiguo).

```
racingTeams/{id}
  name, tag, tagVariants[], color, avatarUrl, bannerUrl, description
  members[]:    { pilot, from, to|null, source: 'siglas'|'manual' }
  notMembers[]: { pilot, note }   // llevan las siglas pero no son del equipo
  history[], createdAt, updatedAt, updatedBy

teamTagDismissals/{TAG}           // "no es un equipo" (p. ej. MR)
```

- `pilot` es el GT7 ID unificado (buildGt7IdMap + Identidad de pilotos).
- Invariante: un piloto es miembro actual (sin `to`) de como mucho un equipo
  (`conflictosDeMiembros`, comprobado al guardar).
- Reglas: `racingTeams` lectura pública, escritura isPlatformOwner;
  `teamTagDismissals` solo isPlatformOwner.
- Imágenes: avatar 512×512 y banner 1600×500, en PNG vía `uploadImageDeduped`
  (carpeta `teams/`).

## Fases

**0 — Medir.** `node scripts/audit-team-tags.mjs`. Ejecución del 2026-09-13:
277 nombres, 63 fusiones, 14 siglas con 2 o más pilotos (HGT 7, RRT 7, AAM 4,
SFRT 4, GRT21 3, HPR 3, LTR 3…). Casos que marcaron el diseño:
- Nombres unificados que conservan siglas antiguas: `AAM_Francis` corrió
  como HPR. Aparece propuesto en las dos siglas y se decide a mano.
- Falsos equipos: `MR` (MR-Tony es un piloto suelto), `JOSE`.

**1 — Datos.** `utils/teamTagMatcher.js` (lógica pura, `node scripts/test-team-tags.mjs`),
servicio en `firebaseService.js`, reglas en `firestore.rules`.

**2 — Admin.** `/equiposAdmin`: sugeridos, confirmados (con «por revisar» cuando
aparecen pilotos nuevos con las siglas) y descartados. Cada piloto se marca
Miembro / Ex-miembro / No es del equipo / Sin decidir. Búsqueda para añadir
pilotos sin siglas. Enlace en el menú lateral, dentro de Catálogo Global.

**3 — Público.** `/equipos` (listado) y `/equipos?id=` (ficha con banner,
avatar, totales, plantilla y trayectoria). Estadísticas desde
`utils/globalPilotStats.js`, extraído de la página de Pilotos para que los
totales cuadren con cada perfil. Entrada en la barra de navegación, OG propia
y sitemap.

**4 — Enlazar.** `components/common/PilotTeamAvatar.js` delante del nombre en:
clasificaciones (StandingsTable), salas, pilotos sin sala, Pre-Qualy
(clasificados, no clasificados, elegibles), autos declarados, uso de autos,
listado y ficha de Pilotos, participantes y resultados de eventos. Sin ningún
equipo publicado no cambia nada visualmente.

## Completado después (2026-09-13)

- **Imágenes exportables** (clasificación y resultados de eventos): llevan las
  siglas sobre el color del equipo, no el avatar. Firebase Storage no devuelve
  cabeceras CORS en este bucket y `html-to-image` no puede incrustar imágenes
  externas sin ellas (comprobado con curl).
- **Comparador de pilotos y panel de estadísticas**: avatar junto al nombre.
- **Compartir la ficha de un equipo**: `/share/team/{id}` en `share_page`
  (functions/main.py), con el banner, o el avatar, o `og-equipos.png`.
- **Inscripción**: si el GT7 ID empieza por las siglas de un equipo publicado,
  se avisa de a qué equipo corresponden. Solo informa: el piloto aparece en
  /equiposAdmin como «por revisar» y el administrador decide.
- **Pilotos que aún no han corrido** (2026-09-13): en /equiposAdmin, si lo buscado
  no coincide con ningún GT7 ID conocido, se ofrece añadirlo tal cual. Sale
  «sin carreras todavía» en el admin y en la ficha pública (sin enlace a
  Pilotos, donde aún no tiene perfil). Al inscribirse con el mismo GT7 ID sus
  carreras suman solas; con otro, se unifica en Identidad de pilotos.
