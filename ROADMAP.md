# 🏆 ROADMAP - IMSA GT7 Platform

**Última actualización:** 14 de noviembre de 2025  
**Versión:** 4.0  
**Estado:** ✅ Producción (Firebase Hosting con arquitectura estática)

---

## ⚠️ ARQUITECTURA CRÍTICA: Query Parameters

**IMPORTANTE**: Este proyecto usa **Firebase Hosting con exportación estática**.

### ✅ Arquitectura Correcta (Query Parameters)

```javascript
// ✅ CORRECTO - Usa query parameters
const searchParams = useSearchParams();
const id = searchParams.get("id");
router.push("/ruta?id=123");

// URL: /championships?id=ABC123
```

### ❌ NO USAR Rutas Dinámicas

```javascript
// ❌ INCORRECTO - NO crear carpetas [id]
const params = useParams();
const id = params.id;
router.push("/ruta/123");

// URL: /championships/ABC123
// Requiere pre-generar rutas en build time
```

**Razón**: Firebase Hosting es estático y no puede generar rutas dinámicamente. Query parameters cargan datos del cliente desde Firestore sin restricciones.

---

## 📋 Resumen Ejecutivo

Sistema completo de gestión de campeonatos de GT7 que soporta **múltiples campeonatos simultáneos**, cada uno con su propia configuración, equipos, pilotos, circuitos y sistema de puntos personalizable.

---

## 📊 Estado General de Progreso

| Fase                                      | Estado        | Progreso | Prioridad  |
| ----------------------------------------- | ------------- | -------- | ---------- |
| **FASE 1**: Fundamentos y Migración       | ✅ COMPLETADA | 100%     | 🔴 CRÍTICA |
| **FASE 2**: Administración de Campeonatos | ✅ COMPLETADA | 100%     | 🔴 CRÍTICA |
| **FASE 2.5**: Sistema de Resultados       | ✅ COMPLETADA | 100%     | 🔴 CRÍTICA |
| **FASE 3**: Admin de Eventos Únicos       | ✅ COMPLETADA | 100%     | 🟠 ALTA    |
| **FASE 4**: Dashboard Público Renovado    | ✅ COMPLETADA | 100%     | 🔴 CRÍTICA |
| **FASE 5**: Navegación y UX Pública       | ✅ COMPLETADA | 100%     | 🟡 MEDIA   |
| **FASE 6**: Testing y Optimización        | 🚧 PENDIENTE  | 20%      | 🟡 MEDIA   |
| **FASE 7**: Migración a Query Parameters  | ✅ COMPLETADA | 100%     | 🔴 CRÍTICA |

**Progreso Total:** 6 de 8 fases completadas (75%)

---

## ✅ FASE 1: Fundamentos y Migración - **COMPLETADA**

### 1.1 Modelo de Datos ✅

- [x] Crear esquema para Championships, Teams, Tracks, Events
- [x] Diseñar estructura de subcollections en Firebase
- [x] Definir sistema de permisos por campeonato
- [x] Crear utilidades de validación de datos
- [x] Implementar servicio de Firebase Storage

**Archivos creados:**

```
/src/app/models/
  - Championship.js ✅
  - Team.js ✅
  - Track.js ✅ (con campo points)
  - Event.js ✅
```

### 1.2 Servicio de Firebase ✅

- [x] Extender `firebaseService.js` con 40+ métodos CRUD
- [x] Operaciones para championships, teams, tracks, events
- [x] Queries para campeonatos activos
- [x] Métodos de migración de datos
- [x] Servicio de Firebase Storage para imágenes

### 1.3 Script de Migración ✅

- [x] Script `migrate-to-championships.js`
- [x] Campeonato legacy creado: **IMSA GT7 2025** (ID: `uG5rQTAHsZgVDmcgipF8`)
- [x] 4 equipos migrados con 16 pilotos totales
- [x] 15 pistas migradas con campos `round` y `points`
- [x] 4 eventos migrados
- [x] 240 registros de puntajes (16 pilotos × 15 pistas)
- [x] Backups automáticos creados

**Scripts creados:**

```
/scripts/
  - migrate-to-championships.js ✅
  - fix-tracks-fields.js ✅
  - migrate-points-to-tracks.js ✅
  - check-tracks.js ✅
  - inspect-track.js ✅
  - inspect-team.js ✅
```

---

## ✅ FASE 2: Administración de Campeonatos - **COMPLETADA**

### 2.1 Vista de Administrador ✅

**Ruta:** `/championshipsAdmin`

- [x] Listado de campeonatos con cards
- [x] **Wizard de creación** (5 pasos):

  1. **Información Básica**: nombre, temporada, fechas, banner
  2. **Categorías**: Gr1, Gr2, Gr3, Gr4, GrB, Street (selector múltiple)
  3. **Sistema de Puntos**:
     - Carrera: grid 16 posiciones (25,22,20...)
     - Vuelta Rápida: toggle + puntos (+1 por defecto)
     - Clasificación: toggle + top 3 (5/3/1 por defecto)
  4. **Configuración**:
     - Tipo: Individual 👤 vs Por Equipos 👥
     - Equipos: máximo de equipos, pilotos por equipo
     - **Circuitos**: agregador con modal completo
       - Selector inteligente (Firebase + GT7)
       - Fecha, ronda, país, categoría
       - Reglas completas (paridad con EventsAdmin)
       - Carros específicos
  5. **Resumen**: vista previa completa

- [x] **Wizard de edición** (mismo flujo)
- [x] Sistema de estados: draft, active, completed, archived
- [x] Confirmación de eliminación

### 2.2 Página de Detalle con Tabs ✅

**Ruta:** `/championshipsAdmin/[id]`

- [x] **Tab "Información"**: Edición inline de datos generales
- [x] **Tab "Equipos"**: Clasificación con puntajes totales ordenados
- [x] **Tab "Pilotos"**: Clasificación individual con categorías
- [x] **Tab "Pistas"**: Calendario con puntajes, ordenamiento por fecha

### 2.3 Context y Selector ✅

- [x] `ChampionshipContext` implementado
- [x] Hook `useChampionship()` con API completa
- [x] `ChampionshipSelector` con 3 variantes
- [x] Persistencia en localStorage
- [x] Auto-selección del campeonato activo

**API del Context:**

```javascript
const {
  championships,
  currentChampionship,
  setCurrentChampionship,
  createChampionship,
  updateChampionship,
  deleteChampionship,
  refreshChampionships,
  loading,
} = useChampionship();
```

---

## ✅ FASE 2.5: Sistema de Resultados - **COMPLETADA**

### Sistema de Asignación de Resultados ✅

**Ubicación:** Tab "Pistas" en `/championshipsAdmin/[id]`

#### Funcionalidades Implementadas:

- [x] **Modal de asignación de resultados** con 3 secciones:

  1. **Posiciones de carrera**: Asignación manual + cálculo automático de puntos
  2. **Clasificación (Qualy)**: Top 3 con puntos bonus (condicional)
  3. **Vuelta Rápida**: Selección de piloto + puntos bonus (condicional)

- [x] **Cálculo automático de puntos**:

  - Usa tabla de puntajes del campeonato
  - Suma puntos de carrera + qualy + vuelta rápida
  - Actualiza clasificación en tiempo real

- [x] **Botón de reset**:

  - Elimina todos los resultados de una pista
  - Confirmación antes de borrar
  - Solo visible cuando hay resultados

- [x] **Ordenamiento de pistas**: Por fecha (cronológico)

- [x] **Display de resultados**:
  - Puntajes por piloto ordenados de mayor a menor
  - Desglose de puntos (carrera, qualy, FL)
  - Actualización de clasificaciones generales

#### Estructura de Datos:

```javascript
// En championship/tracks/{trackId}
{
  points: {
    "pilotName": totalPoints
  },
  results: {
    racePositions: ["piloto1", "piloto2", ...],
    racePoints: {"piloto1": 25, "piloto2": 22, ...},
    qualifying: {
      top3: ["piloto1", "piloto2", "piloto3"],
      points: {"piloto1": 5, "piloto2": 3, "piloto3": 1}
    },
    fastestLap: {
      driver: "pilotoX",
      points: 1
    }
  }
}
```

#### Validaciones:

- [x] Secciones condicionales según settings del campeonato
- [x] Settings structure correcta: `pointsSystem.qualifying.enabled`, `.positions`, `.fastestLap`
- [x] No permite duplicados en posiciones
- [x] Confirmación antes de reset
- [x] Recarga de datos después de guardar

---

## 🚧 FASE 3: Admin de Eventos Únicos - **PENDIENTE**

**Prioridad: ALTA** 🟠

> **Enfoque:** Los eventos únicos son independientes de los campeonatos.
> Solo se mejora la administración existente agregando gestión de imágenes.

### 3.1 Modificar EventsAdmin

- [ ] Integrar componente `ImageUploader` para banner del evento
- [ ] Subir banners a Firebase Storage
- [ ] Preview de banner en el formulario
- [ ] Mantener eventos completamente independientes (NO vincular a campeonatos)
- [ ] Conservar estructura actual de reglas y configuración
- [ ] Mantener sistema actual de carros específicos

**Cambios mínimos:**

- ✅ Agregar campo `banner` (URL de Firebase Storage)
- ✅ Componente de subida con preview
- ❌ NO agregar selector de campeonato
- ❌ NO cambiar estructura de datos
- ❌ NO vincular con circuitos de campeonatos

---

## 🚧 FASE 4: Dashboard Público Renovado - **PENDIENTE**

**Prioridad: CRÍTICA** 🔴

> **Enfoque:** Rediseño completo del Dashboard público para mostrar
> tanto eventos únicos como múltiples campeonatos con su información detallada.

### 4.1 Sección de Eventos Únicos de la Semana

- [ ] Widget `WeeklyEventsWidget` para eventos únicos
- [ ] Mostrar eventos activos de la semana actual
- [ ] Información de cada evento:
  - Banner del evento
  - Título y descripción
  - Fecha y hora
  - Circuito
  - Participantes inscritos / máximo
  - Carros específicos (si aplica)
  - Botón "Ver detalles" / "Inscribirse"

### 4.2 Sección de Campeonatos

- [ ] Grid/Lista de campeonatos activos
- [ ] Card de cada campeonato con:
  - **Banner del campeonato**
  - **Nombre y temporada**
  - **% de progreso**: Carreras completadas / total
    - Ejemplo: "12/15 carreras (80%)"
    - Barra de progreso visual
  - **Información básica**:
    - Categorías del campeonato
    - Número de equipos/pilotos
    - Tipo (Individual/Por Equipos)
    - Estado (Activo/Completado)
  - **Botón "Ver Campeonato"** → Navega a vista detallada

### 4.3 Vista Detallada de Campeonato (Nueva)

**Ruta propuesta:** `/championships/[id]` (vista pública)

- [ ] Header con banner y datos del campeonato
- [ ] Tabs de navegación:

  - **📊 Clasificación**: Standings actuales (equipos o pilotos)
  - **🏁 Calendario**: Lista de carreras (pasadas y futuras)
  - **📈 Estadísticas**: Gráficos de rendimiento
  - **ℹ️ Información**: Reglas, sistema de puntos

- [ ] Sección de próxima carrera destacada:
  - Circuito con imagen de trazado
  - Fecha y hora
  - Countdown si está próxima
  - Carros específicos permitidos
  - Reglas de la carrera

### 4.4 Componentes Reutilizables

- [ ] `ChampionshipCard` - Card con info y progreso
- [ ] `ChampionshipProgress` - Barra de progreso visual
- [ ] `EventCard` - Card para eventos únicos
- [ ] `RaceCalendar` - Calendario de carreras
- [ ] `StandingsTable` - Tabla de clasificación

### 4.5 Sistema de Navegación

- [ ] Selector de campeonato (dropdown o tabs)
- [ ] Breadcrumbs: Home > Campeonatos > [Nombre]
- [ ] Botón "Volver a Inicio" en vista detallada
- [ ] Links directos a clasificación, calendario, etc.

### 4.6 Cálculo de Progreso

```javascript
// Calcular % de progreso del campeonato
const calculateProgress = (tracks) => {
  const completed = tracks.filter((t) => t.status === "completed").length;
  const total = tracks.length;
  const percentage = Math.round((completed / total) * 100);
  return { completed, total, percentage };
};
```

### 4.7 Diseño Propuesto

```
┌─────────────────────────────────────────────────────────┐
│                    🏁 Dashboard GT7                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📅 EVENTOS ÚNICOS DE LA SEMANA                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │ [Banner] Gran Premio Especial de Spa              │ │
│  │ 📍 Spa-Francorchamps  📅 15 Nov, 22:30           │ │
│  │ 👥 15/20 participantes                            │ │
│  │ [Ver Detalles] [Inscribirse]                      │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  🏆 CAMPEONATOS ACTIVOS                                │
│  ┌─────────────────┐ ┌─────────────────┐              │
│  │ [Banner IMSA]   │ │ [Banner Liga]   │              │
│  │ IMSA GT7 2025   │ │ Liga Nacional   │              │
│  │ ████████░░ 80%  │ │ ███░░░░░░░ 30%  │              │
│  │ 12/15 carreras  │ │ 3/10 carreras   │              │
│  │                 │ │                 │              │
│  │ 📊 4 Equipos    │ │ 📊 Individual   │              │
│  │ 🏎️ Gr3         │ │ 🏎️ Gr1, Gr2    │              │
│  │                 │ │                 │              │
│  │ [Ver Campeonato]│ │ [Ver Campeonato]│              │
│  └─────────────────┘ └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ FASE 7: Migración a Query Parameters - **COMPLETADA**

**Fecha:** 14 de noviembre de 2025  
**Prioridad:** 🔴 CRÍTICA

### 7.1 Problema Identificado ✅

- Firebase Hosting solo soporta archivos estáticos
- Rutas dinámicas `[id]` requieren pre-generar todas las páginas en build time
- Cada nuevo campeonato requería rebuild + redeploy
- Script `fetch-static-ids.js` consultaba Firebase antes de cada build

### 7.2 Solución Implementada ✅

**Migración completa de rutas dinámicas a query parameters:**

- [x] Convertir `/championships/[id]` → `/championships?id=xxx`
- [x] Convertir `/championshipsAdmin/[id]` → `/championshipsAdmin?id=xxx`
- [x] Convertir `/championshipsAdmin/edit/[id]` → `/championshipsAdmin/edit?id=xxx`
- [x] Actualizar `ChampionshipCard.js` para usar query params
- [x] Cambiar `useParams()` por `useSearchParams()` en todos los archivos
- [x] Agregar lógica condicional para mostrar lista vs detalle en `championshipsAdmin/page.js`
- [x] Eliminar directorios `[id]` y layouts innecesarios
- [x] Remover `fetch-static-ids.js` y dependencias
- [x] Corregir imports después de mover archivos
- [x] Actualizar `package.json` (remover script de pre-build)
- [x] Build y deploy exitoso

### 7.3 Archivos Eliminados ✅

```
src/app/championships/[id]/
src/app/championships/[id]/layout.js
src/app/championships/[id]/static-ids.json
src/app/championshipsAdmin/[id]/
src/app/championshipsAdmin/[id]/layout.js
src/app/championshipsAdmin/edit/[id]/
src/app/championshipsAdmin/edit/[id]/layout.js
scripts/fetch-static-ids.js
```

### 7.4 Archivos Modificados ✅

```javascript
// championships/page.js
- const params = useParams();
+ const searchParams = useSearchParams();
- const id = params.id;
+ const id = searchParams.get('id');

// championshipsAdmin/page.js
+ if (!championshipId) {
+   // Mostrar lista de campeonatos
+ }
+ // Mostrar detalle del campeonato

// ChampionshipCard.js
- router.push(`/championships/${championship.id}`);
+ router.push(`/championships?id=${championship.id}`);

// package.json
- "build": "node scripts/fetch-static-ids.js && node scripts/prepare-og.js && next build && node scripts/inject-meta.js"
+ "build": "node scripts/prepare-og.js && next build && node scripts/inject-meta.js"
```

### 7.5 Resultados ✅

**Antes de la migración:**

- 15 archivos HTML generados (con rutas pre-generadas)
- Limitación: Nuevos campeonatos requieren rebuild
- Script de pre-build consulta Firebase cada vez

**Después de la migración:**

- 11 archivos HTML generados (solo páginas estáticas)
- ✅ Sin limitaciones: Nuevos campeonatos funcionan inmediatamente
- ✅ Build más rápido (sin consulta a Firebase)
- ✅ Arquitectura simple compatible con Firebase Hosting

### 7.6 Beneficios ✅

- **Sin rebuild requerido**: Crear nuevo campeonato → disponible inmediatamente
- **Carga dinámica**: Datos se cargan desde Firestore en el cliente
- **Build más rápido**: No pre-genera rutas dinámicas
- **Mantenimiento simple**: Menos configuración y scripts
- **Compatible con Firebase Hosting gratuito**: Sin costos adicionales

### 7.7 Guía para Futuras Funcionalidades ✅

**Documentado en README.md:**

```javascript
// ✅ SIEMPRE usar query parameters
const searchParams = useSearchParams();
const id = searchParams.get("id");
router.push("/ruta?id=123");

// ❌ NUNCA usar rutas dinámicas [id]
// NO crear carpetas con corchetes
// NO usar useParams()
```

---

## 🚧 FASE 8: Próximas Mejoras - **PLANIFICADAS**

**Prioridad: MEDIA** 🟡

- [ ] Página `/championships` pública
- [ ] Breadcrumbs y navegación contextual
- [ ] Unit tests y E2E tests
- [ ] Optimización de queries
- [ ] Caching y lazy loading

---

## 🏗️ Arquitectura de Datos (Firebase)

### Estructura Principal:

```javascript
/championships/{championshipId}
{
  id: string,
  name: "IMSA GT7 2025",
  shortName: "IMSA25",
  season: "2025",
  status: "draft" | "active" | "completed" | "archived",
  categories: ["Gr1", "Gr2", "Gr3", ...],

  settings: {
    pointsSystem: {
      race: { 1: 25, 2: 22, 3: 20, ... },
      fastestLap: { enabled: true, points: 1 },
      qualifying: { enabled: true, positions: { 1: 5, 2: 3, 3: 1 } }
    },
    isTeamChampionship: true,
    maxTeams: 10,
    maxDriversPerTeam: 2
  }
}

/championships/{championshipId}/teams/{teamId}
{
  id: string,
  name: "Mazda Racing",
  color: "#FF5733",
  drivers: [
    { id, name, category, points: { "trackId": points } }
  ]
}

/championships/{championshipId}/tracks/{trackId}
{
  id: string,
  name: "Spa-Francorchamps",
  date: timestamp,
  round: 5,
  category: "Gr3",

  // Resultados de la carrera
  points: { "pilotName": totalPoints },
  results: {
    racePositions: [...],
    racePoints: {...},
    qualifying: { top3: [...], points: {...} },
    fastestLap: { driver: "...", points: 1 }
  },

  // Configuración
  specificCars: true,
  allowedCars: ["Mazda RX-Vision GT3", ...],
  layoutImage: "url",
  status: "upcoming" | "completed"
}

// Eventos únicos (colección global, NO dentro de campeonatos)
/events/{eventId}
{
  id: string,
  title: "Gran Premio Especial de Spa",
  description: "...",
  date: timestamp,
  hour: "22:30",
  track: "Spa-Francorchamps",
  banner: "url-from-storage", // NUEVO

  // Reglas (mantiene estructura actual)
  rules: { laps: 10, weather: "dynamic", ... },

  // Carros específicos (mantiene estructura actual)
  specificCars: true,
  allowedCars: ["Mazda RX-Vision GT3", ...],

  maxParticipants: 20,
  participants: [...],
  isSpecialEvent: false
}
```

---

## 📈 Métricas de Éxito

### Completado:

- ✅ **100%** de infraestructura base
- ✅ **100%** de administración de campeonatos
- ✅ **100%** sistema de resultados y puntos
- ✅ **40+** métodos de Firebase Service
- ✅ **Wizard completo** de 5 pasos
- ✅ **4 tabs funcionales** en detalle
- ✅ **Sistema de puntos flexible** (race + FL + qualy)
- ✅ **Asignación de resultados** con modal completo
- ✅ **Cálculo automático** de clasificaciones

### Pendiente:

- 🚧 Admin de eventos únicos con banners
- 🚧 Dashboard público renovado con:
  - Eventos únicos de la semana
  - Cards de campeonatos con % de progreso
  - Vista detallada de cada campeonato
- 🚧 Navegación y UX pública
- 🚧 Testing completo

---

## 🎯 Próximos Pasos

1. **FASE 3**: Admin de Eventos Únicos

   - Crear componente `ImageUploader.js`
   - Integrar en EventsAdmin para subir banners
   - Conservar toda la funcionalidad actual

2. **FASE 4**: Dashboard Público Renovado
   - Sección de eventos únicos de la semana
   - Grid de campeonatos con cards informativas
   - Cálculo de % de progreso por campeonato
   - Vista detallada de campeonato seleccionado
   - Calendario de carreras
   - Clasificaciones en tiempo real

````

---

## 📈 Métricas de Éxito

### Completado:

- ✅ **100%** de infraestructura base
- ✅ **100%** de administración de campeonatos
- ✅ **100%** sistema de resultados y puntos
- ✅ **40+** métodos de Firebase Service
- ✅ **Wizard completo** de 5 pasos
- ✅ **4 tabs funcionales** en detalle
- ✅ **Sistema de puntos flexible** (race + FL + qualy)
- ✅ **Asignación de resultados** con modal completo
- ✅ **Cálculo automático** de clasificaciones

### Pendiente:

- 🚧 Adaptación de páginas admin existentes
- 🚧 Dashboard público multi-campeonato
- 🚧 Navegación y UX pública
- 🚧 Testing completo

---

## 🎯 Próximos Pasos

1. **FASE 3**: Crear componentes reutilizables

   - `CarSelector.js`
   - `ImageUploader.js`

2. **FASE 3**: Adaptar páginas admin

   - TeamsAdmin con selector de campeonato
   - TracksAdmin con carros e imágenes
   - EventsAdmin con banner

3. **FASE 4**: Dashboard público
   - Filtrado por campeonato
   - Widgets semanales

---

## 🔑 Logros Clave

### Infraestructura

✅ Sistema completo de múltiples campeonatos
✅ Migración exitosa sin pérdida de datos
✅ Modelos validados y testeados
✅ 40+ métodos de Firebase Service

### Administración

✅ CRUD completo de campeonatos
✅ Wizard de 5 pasos (new + edit)
✅ Sistema de puntos personalizable
✅ Tipo de campeonato (individual/equipos)
✅ Agregador de circuitos en wizard
✅ Página de detalle con 4 tabs

### Sistema de Resultados

✅ Modal de asignación con 3 secciones
✅ Cálculo automático de puntos
✅ Condicionales según settings (qualy, FL)
✅ Botón de reset con confirmación
✅ Ordenamiento cronológico de pistas
✅ Actualización de clasificaciones en tiempo real

### Datos Migrados

✅ 1 campeonato legacy (IMSA GT7 2025)
✅ 4 equipos con 16 pilotos
✅ 15 pistas con rounds y puntajes
✅ 4 eventos
✅ 240 registros de puntajes individuales

---

## 📝 Notas Técnicas

### Sistema de Puntos

**Configuración flexible en wizard:**

- Puntos de carrera: 16 posiciones personalizables
- Vuelta rápida: opcional, puntos configurables
- Clasificación: opcional, top 3 con puntos personalizables

**Estructura en Firebase:**

```javascript
settings: {
  pointsSystem: {
    race: { 1: 25, 2: 22, 3: 20, ... },
    fastestLap: { enabled: true, points: 1 },
    qualifying: { enabled: true, positions: { 1: 5, 2: 3, 3: 1 } }
  }
}
````

### Asignación de Resultados

**Modal con 3 secciones condicionales:**

1. Carrera (siempre visible)
2. Clasificación (si `qualifying.enabled === true`)
3. Vuelta rápida (si `fastestLap.enabled === true`)

**Cálculo de puntos:**

```javascript
totalPoints = racePoints + (qualyPoints || 0) + (fastestLapPoints || 0);
```

**Guardado en pista:**

```javascript
{
  points: { "piloto": total },
  results: {
    racePositions, racePoints,
    qualifying: { top3, points },
    fastestLap: { driver, points }
  }
}
```

---

## 🎉 Resultado Esperado Final

✅ **Sistema robusto de múltiples campeonatos**  
✅ **Wizard completo de configuración (5 pasos)**  
✅ **Sistema de puntos flexible**  
✅ **Asignación de resultados completa**  
✅ **Cálculo automático de clasificaciones**  
🚧 **Admin de eventos únicos mejorado**  
🚧 **Dashboard público renovado** con:

- Eventos únicos de la semana
- Campeonatos con % de progreso
- Vista detallada por campeonato
- Calendario y clasificaciones en vivo  
  ✅ **Administración completa**  
  ✅ **Escalabilidad garantizada**

---

**Última actualización:** 14 de noviembre de 2025  
**Versión:** 3.1  
**Cambios principales:**

- 🔄 **FASE 3 redefinida**: Solo admin de eventos únicos
- 🔄 **FASE 4 redefinida**: Dashboard público renovado
- ✨ Nueva estructura: Eventos únicos + Campeonatos con progreso
- ✨ Vista detallada de campeonato con tabs
- ✨ Cálculo de % de progreso (carreras completadas/total)
- 📋 Documentación actualizada con arquitectura de eventos únicos
