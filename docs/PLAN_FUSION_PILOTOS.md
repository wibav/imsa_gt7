# Plan — Fusión de identidades de piloto

Sección de administración, solo para el Administrador de Plataforma, que
permite unificar los distintos nombres bajo los que ha corrido un mismo piloto
y propagar la unificación a campeonatos y eventos.

Estado: **propuesta, sin implementar**. La fase 0 (inventario) ya existe.

> **Quién decide.** El sistema solo *propone* candidatos; ninguna fusión ocurre
> sin confirmación explícita del Administrador de Plataforma. No hay fusión
> automática ni acción masiva, en ninguna fase. El heurístico se equivoca
> —hay falsos positivos demostrados en §5— y una fusión errónea corrompe una
> clasificación ya publicada, así que la lista de candidatos es un punto de
> partida para el ojo humano, no un veredicto. También se puede fusionar a mano
> lo que el heurístico no detectó: si alguien cambió su GT7 ID por otro sin
> parecido alguno, no hay similitud que lo delate y solo lo sabe el organizador.

---

## 1. El problema, con números

GT7 permite cambiar el GT7 ID tres veces. El PSN ID sí es estable, pero solo se
recoge cuando el piloto se inscribe con él: en eventos y en algunos campeonatos
solo queda el GT7 ID. Resultado: el mismo piloto acaba escrito de varias formas
y sus estadísticas se parten entre varias fichas.

`scripts/audit-pilot-identities.js` mide el alcance real (ejecución del
2026-09-06, 6 campeonatos y 23 eventos):

| | |
|---|---|
| Nombres distintos | **440** |
| Apariciones totales | **3950** |
| Ubicaciones distintas donde vive un nombre | **72** |
| Grupos candidatos a fusión | **99** |
| Documentos recorridos | 509 (6 campeonatos, 23 eventos) |

Casos reales detectados:

```
── núcleo "dayo21"
   HGT_dayo21 (19)  ·  Hgt_dayo21 (15)  ·  HGT_Dayo21 (7)  ·  Dayo21 (5)  ·  Dayo (2)  ·  HGT_Dayo (1)
── núcleo "chak"
   o0Chak0o (14)  ·  o0chak0o (11)  ·  HPR_Chak (7)  ·  Aam chak (4)  ·  Hpr-chak (4)  ·  …
── núcleo "tony"
   Tony (34)  ·  MR-Tony (29)  ·  A77_tony (21)  ·  tonyy1122 (7)  ·  ULR-Tony (3)  ·  …
```

Obsérvese que el problema no es solo el cambio de GT7 ID: también hay cambio de
etiqueta de equipo (`HPR_` → `AAM `), diferencias de mayúsculas y erratas.

### 1.1. Inscripciones: campeonatos **y** eventos

Una fusión que no cubra las dos vías de inscripción deja al piloto partido
igualmente, así que el inventario recorre ambas. Estas son las ubicaciones de
inscripción y participación, con sus apariciones reales:

| Ubicación | Apar. |
|---|---|
| `events/*/participants/*` (`gt7Id`, `psnId`, `name`) | 554 |
| `events/*/rounds/*.rooms[].participants[]` (`gt7Id`, `psnId`) | 372 |
| `championships/*.drivers[].name` | 133 |
| `championships/*.registrations[]` (`gt7Id`, `psnId`) | 211 |
| `championships/*/divisions/*.drivers[]` | 86 |
| `championships/*.preQualy.results[]` (`driverName`, `gt7Id`) | 115 |
| `events/*.participants[]` (estructura antigua, en el propio documento) | 94 |
| `championships/*/teams/*.drivers[].name` | 16 |
| **`events/*/waitlist/*`** (`gt7Id`, `psnId`) | 4 |
| `championships/*/events/*.participants[]` (eventos internos de un campeonato) | — |

Dos avisos que salen de aquí:

- **La lista de espera cuenta.** Son solo 4 entradas hoy, pero un piloto que
  únicamente esté en lista de espera es invisible para cualquier inventario que
  no la mire — y de hecho lo fue para la primera versión de este análisis.
- **Hay dos estructuras conviviendo.** Los eventos antiguos guardan los
  participantes dentro del propio documento (`events/*.participants[]`) y los
  nuevos en una subcolección. La fusión tiene que contemplar las dos.

Además de los pilotos hay **personas con rol**: `casterName`, `hostName`,
`caster` y `host`, tanto en campeonatos como en eventos y en cada sala. A
menudo son también pilotos (`o0CHAK0o` aparece como host de un evento). Se
inventarían aparte porque fusionarlos es opcional: afecta a quién aparece
acreditado, no a ninguna clasificación.

### 1.2. El detalle que condiciona todo el diseño

**El nombre no es una referencia, es el dato.** No hay ids relacionales: la
cadena está copiada en 72 ubicaciones distintas, y en varias de ellas es la
**clave de un objeto**, no un valor:

| Ubicación | Forma |
|---|---|
| `championships/*/tracks/*.points{}` | clave de objeto |
| `…/results.divisions.*.racePositions{}` · `racePoints{}` | clave de objeto |
| `…/results.divisions.*.qualifying.points{}` · `fastestLap.points{}` | clave de objeto |
| `…/results.divisions.*.qualifying.top3` · `fastestLap.driver` | valor |
| `championships/*.registrations[]` (`gt7Id`, `psnId`, `name`) | valor |
| `championships/*.drivers[].name` | valor |
| `championships/*/divisions/*.drivers[]` | elemento de array |
| `championships/*/penalties/*.driverName` | valor |
| `championships/*/claims/*.reporterName` · `accusedNames[]` | valor / array |
| `championships/*/teams/*.drivers[].name` | valor |
| `championships/*/tracks/*.carsUsed{}` | clave de objeto |
| `championships/*.preQualy.results[]` | valor |
| `events/*/participants` · `events/*/waitlist` (`gt7Id`, `psnId`) | valor |
| `events/*/results` · `rounds.rooms[].results[]` (`driverName`, `psnId`) | valor |
| `events/*/rounds.rooms[].participants[]` | valor |
| `events/*.streaming.casterName` · `hostName`, `rooms[].caster` · `host` | valor (rol, no piloto) |

Renombrar una clave de objeto es borrar una y crear otra. Si las dos claves de
un mismo objeto pertenecen al piloto que se fusiona (por ejemplo, corrió una
carrera como `Dayo` y otra como `HGT_dayo21` y ambas están en el mismo
`points{}`), **hay una colisión de valores** que ninguna regla automática puede
resolver bien. Es el caso que obliga a una previsualización con intervención
humana.

---

## 2. Enfoque elegido: alias, no reescritura

Hay dos formas de resolverlo:

**A. Reescribir los datos.** Sustituir la cadena vieja por la nueva en los 3950
sitios. Irreversible en la práctica, obliga a tocar documentos históricos
(incluidos campeonatos cerrados y resultados ya publicados) y una fusión
equivocada no se deshace.

**B. Una capa de alias.** Una colección `pilotIdentities` que dice "estos
nombres son la misma persona"; la lectura resuelve el alias al vuelo, como ya
hace `buildGt7IdMap()` con las inscripciones.

**Se elige B**, con reescritura opcional y posterior. Razones:

- **Reversible.** Deshacer una fusión es borrar un documento, no restaurar 3950
  campos.
- **La infraestructura ya existe.** `buildGt7IdMap()` +
  `displayDriverName()` ya normalizan nombres al GT7 ID en clasificaciones,
  pilotos y eventos. La fusión es alimentar ese mismo mapa desde otra fuente.
- **No toca resultados publicados.** Un campeonato cerrado sigue conteniendo
  literalmente lo que se publicó en su día.
- **El histórico se conserva.** Interesa saber que un piloto corrió como
  `HPR_Chak` en 2025 y como `AAM Chak` en 2026.

La reescritura (opción A) queda como acción explícita y separada de la fusión
—fase 5, opcional—, para cuando se quiera consolidar de verdad.

---

## 3. Modelo de datos

```
pilotIdentities/{identityId}
  canonical:  "HGT_dayo21"        // nombre a mostrar en toda la web
  psnId:      "hgt_dayo21"        // ancla estable, si se conoce
  aliases:    ["Dayo", "Dayo21", "Hgt_dayo21", "HGT_Dayo21", "HGT_Dayo"]
  note:       "Cambió de GT7 ID en marzo 2026"
  mergedAt:   "2026-09-06T…"
  mergedBy:   "wolcutor@gmail.com"
  history:    [ { at, by, action: "merge"|"split", aliases: [...] } ]
```

Un alias pertenece **como mucho a una identidad**: es la invariante que impide
que dos fusiones se contradigan, y se valida al guardar.

### Reglas de seguridad

```
match /pilotIdentities/{id} {
  allow read: if true;                      // la web pública resuelve nombres
  allow write: if isPlatformOwner();        // solo wolcutor@gmail.com
}
```

Consistente con `tracks` y `cars`, que ya son lectura pública / escritura solo
del Administrador de Plataforma. `isPlatformOwner()` ya existe en las reglas y
en `AuthContext`, y hoy solo lo tiene `wolcutor@gmail.com`.

---

## 4. Fases

### Fase 0 — Inventario ✅ hecho

`scripts/audit-pilot-identities.js`. Recorre campeonatos y eventos, anota dónde
aparece cada nombre y agrupa los candidatos por similitud del *núcleo* del
nombre (quitando etiqueta de equipo, acentos, signos y mayúsculas). Solo
informa; no escribe nada.

```bash
node scripts/audit-pilot-identities.js --json informe.json --min-score 0.82
```

### Fase 1 — Resolución de alias en lectura

- `FirebaseService.getPilotIdentities()`, cacheada en memoria como `getCars()`.
- Extender `buildGt7IdMap()` para que acepte las identidades además de las
  inscripciones, con **prioridad para la identidad** (una fusión manual manda
  sobre lo que diga una inscripción).
- Un solo punto de cambio: todo lo que ya usa `buildGt7IdMap` / `displayDriverName`
  —clasificaciones, `/pilots`, eventos, sanciones— hereda la fusión sin tocarse.

**Verificable:** creando la identidad de `dayo21` a mano, su ficha de piloto
pasa de 3 perfiles partidos a 1 con las estadísticas sumadas.

### Fase 2 — La pantalla `/pilotsAdmin`

Guardada por `isPlatformOwner()`, igual que `/tracksAdmin`.

**Columna izquierda — candidatos.** Los grupos de la fase 0, calculados en el
cliente sobre los nombres ya cargados, ordenados por número de apariciones.
Cada grupo muestra los nombres, cuántas veces aparece cada uno y en cuántos
sitios. Buscador para fusionar a mano dos nombres que el heurístico no juntó.

**Columna derecha — previsualización de la fusión.** Antes de confirmar:

- nombre canónico propuesto (editable; por defecto, el de más apariciones);
- qué campeonatos y eventos se ven afectados;
- estadísticas antes y después (carreras, puntos, victorias);
- **avisos de colisión**: los objetos donde dos alias del grupo son claves del
  mismo `points{}` o `racePositions{}`, es decir, donde el piloto aparecería
  dos veces en la misma carrera. Es el caso que hay que mirar a ojo.

**Lista de fusiones existentes**, con deshacer.

Sobre el símil de los contactos del teléfono: la parte que se copia es la
**sugerencia con confirmación** (el teléfono nunca fusiona solo). La diferencia
es que aquí una fusión equivocada corrompe una clasificación publicada, así que
la previsualización es obligatoria, no un extra.

### Fase 3 — Escritura de la fusión

`FirebaseService.mergePilotIdentity({ canonical, psnId, aliases, note })`:

1. valida que ningún alias pertenezca ya a otra identidad;
2. escribe el documento con `mergedBy` y una entrada en `history`;
3. invalida la caché de identidades.

Deshacer = borrar el documento. Nada más, porque no se ha tocado ningún dato.

### Fase 4 — Prevención

Que el problema deje de crecer:

- Al inscribirse, si el GT7 ID o el PSN ID se parece mucho a uno ya conocido,
  avisar al piloto ("¿eres tú?") antes de crear una entrada nueva.
- En el alta de inscripciones del admin, el mismo aviso.
- Recomendar PSN ID obligatorio en el formulario de inscripción: es el único
  identificador que no cambia.

### Fase 5 — Consolidación (opcional, más adelante)

Un script que reescribe de verdad las 3950 apariciones a partir de las
identidades ya confirmadas, con `--dry-run` obligatorio primero y copia de
seguridad de los documentos afectados. Solo tiene sentido si en algún momento
se quiere retirar la capa de alias.

---

## 5. Riesgos

**Falsos positivos del heurístico.** El propio inventario los produce ya:
`HPR_FRANCIS126` y `HPR_FRANCIS125` salen en el mismo grupo y probablemente son
dos personas (o una errata); `Dani`, `gonzalezdanielo` y `Daniireina1` casi
seguro no son la misma. **Por eso el heurístico solo sugiere y nunca fusiona
solo.** La lista es un punto de partida para el ojo humano, no un veredicto.

**Nombres genéricos.** `Tony`, `Dani`, `Leo` pueden ser dos personas distintas.
La previsualización debe mostrar si los alias coincidieron alguna vez en la
misma carrera: si dos nombres corrieron la misma carrera, son dos personas.
Esta comprobación es el mejor discriminante disponible y debería salir marcada
en rojo automáticamente.

**Nombres de equipo en el mismo campo.** Se ha visto `Luis THC Racing Team` en
un `racePositions{}`. Conviene revisar si es un piloto o una entrada de equipo
antes de fusionarlo con `Luis ThcRacing`.

**Coste de lectura.** El inventario recorre todas las subcolecciones de los 23
eventos y 6 campeonatos: ~1 minuto y unas 400 lecturas. En la pantalla admin se
calcula sobre datos ya cargados, sin lecturas extra.

---

## 6. Orden sugerido

1. Fase 1 (resolución en lectura) — pequeña, y ya se puede probar creando
   identidades a mano desde la consola de Firebase.
2. Fase 2 + 3 (pantalla y escritura) — el grueso.
3. Fase 4 (prevención) — evita que el trabajo se repita.
4. Fase 5 — solo si hace falta.

Las fases 1 y 2/3 son independientes: la 1 ya aporta valor sin pantalla, y la
pantalla sin la 1 no serviría de nada.
