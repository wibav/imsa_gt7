---
name: desh-resolve
description: Lleva una idea de feature o una incidencia/bug desde requerimientos hasta QA (unit + UI/UX end-to-end), pasando por planificación, implementación y code review, usando un pipeline de sub-agentes senior especializados. Úsalo cuando el usuario pida crear o corregir un feature "de punta a punta" con revisión y pruebas automáticas, o pida explícitamente correr el pipeline/workflow desh-resolve.
---

# desh-resolve — pipeline de sub-agentes

Este skill orquesta 6 sub-agentes especializados (definidos en `~/.claude/agents/`) para llevar una idea o incidencia desde el requerimiento hasta la validación de QA, sin que el usuario tenga que ir pidiendo cada paso por separado:

1. **requirements-analyst** (opus) — convierte el pedido crudo del usuario en un documento de requerimientos verificable, anclado en el código real.
2. **feature-planner** (opus) — convierte los requerimientos en un plan de implementación concreto.
3. **feature-developer** (sonnet) — implementa el plan.
4. **feature-code-reviewer** (sonnet) — audita el diff (no corrige).
5. **qa-unit-skeptic** (sonnet) — escribe y corre unit/integration tests adversariales, en paralelo con el paso 6.
6. **qa-ui-ux-e2e** (sonnet) — ejercita el flujo en la UI real (o el framework E2E del repo), en paralelo con el paso 5.

Si el review o cualquiera de los dos QA marca algo bloqueante, se dispara **una ronda de remediación** (vuelve a `feature-developer` solo con lo bloqueante) antes de cerrar. No hay más de una ronda automática — si tras la remediación sigue bloqueado, se reporta así al usuario en vez de loopear indefinidamente.

## Cuándo usar este skill

- El usuario describe una idea de feature o un bug/incidencia y quiere que se resuelva de punta a punta con requerimientos, plan, implementación, review y pruebas automáticas.
- El usuario pide explícitamente correr "el pipeline de desh-resolve" o equivalente.

## Cuándo NO usarlo

- Cambios triviales de una línea, typos, o tareas puramente mecánicas — usa las herramientas normales directamente, este pipeline tiene overhead real (6+ llamadas a sub-agentes).
- El usuario ya tiene un plan claro y solo quiere que se implemente — puedes saltar directo a `feature-developer` vía el tool `Agent` si de verdad no hace falta todo el pipeline (pero por defecto, si no estás seguro, corre el pipeline completo: es más barato re-hacer un paso barato que descubrir tarde que faltó).
- El proyecto no tiene forma de correr tests o no hay UI que probar — igual puedes correr el pipeline; el QA de UI/UX está diseñado para reportar "no aplica" si no hay superficie visual (ver su propia definición), y no falla el pipeline por eso.

## Cómo ejecutarlo

Este skill se ejecuta con la herramienta `Workflow`, pasando el script de más abajo tal cual en el parámetro `script`, y la idea/incidencia del usuario (como string, en su propio idioma, con todo el detalle que haya dado) en el parámetro `args`.

**Antes de invocar Workflow**, si el pedido del usuario es ambiguo sobre alcance (¿es un bug puntual o quiere que también se generalice?), es válido pedir una aclaración rápida al usuario primero — el analista de requerimientos no puede preguntarte de vuelta a mitad del workflow.

Después de que el workflow termine, **sintetiza un resumen legible para el usuario** a partir del objeto que retorna (no le pegues el JSON crudo): qué se implementó, qué dijo el review, el veredicto de cada QA, y si hubo remediación. Si el veredicto final es "no listo" en algo, dilo con claridad y no lo suavices.

```javascript
export const meta = {
  name: 'desh-resolve',
  description: 'Requerimientos -> plan -> implementación -> code review -> QA (unit + UI/UX) para un feature o fix',
  phases: [
    { title: 'Requirements', detail: 'analista de requerimientos senior (opus)' },
    { title: 'Planning', detail: 'planificador técnico senior (opus)' },
    { title: 'Implementation', detail: 'programador senior implementa el plan (sonnet)' },
    { title: 'Review + QA', detail: 'code review, QA unit y QA UI/UX en paralelo (sonnet)' },
    { title: 'Remediation', detail: 'programador corrige hallazgos bloqueantes, si los hay (sonnet)' },
  ],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    acceptance_criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterio: { type: 'string' },
          estado: { type: 'string', enum: ['cumplido', 'parcial', 'no_cumplido'] },
          razon: { type: 'string' },
        },
        required: ['criterio', 'estado'],
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severidad: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] },
          archivo: { type: 'string' },
          linea: { type: 'number' },
          resumen: { type: 'string' },
          escenario_falla: { type: 'string' },
        },
        required: ['severidad', 'resumen'],
      },
    },
    veredicto: { type: 'string', enum: ['bloqueante', 'aprobado'] },
  },
  required: ['findings', 'veredicto'],
}

const QA_UNIT_SCHEMA = {
  type: 'object',
  properties: {
    cobertura: { type: 'array', items: { type: 'object' } },
    bugs_encontrados: { type: 'array', items: { type: 'object' } },
    tests_agregados: { type: 'array', items: { type: 'string' } },
    huecos_cobertura: { type: 'array', items: { type: 'string' } },
    veredicto: { type: 'string', enum: ['listo', 'no_listo'] },
  },
  required: ['veredicto'],
}

const QA_UIUX_SCHEMA = {
  type: 'object',
  properties: {
    cobertura: { type: 'array', items: { type: 'object' } },
    pasos_realizados: { type: 'array', items: { type: 'string' } },
    hallazgos_ux: { type: 'array', items: { type: 'object' } },
    hallazgos_funcionales: { type: 'array', items: { type: 'object' } },
    no_aplica: { type: 'boolean' },
    veredicto: { type: 'string', enum: ['listo', 'no_listo'] },
  },
  required: ['veredicto'],
}

const pedido = typeof args === 'string' ? args : JSON.stringify(args ?? '')

phase('Requirements')
const requirements = await agent(
  `Idea o incidencia del usuario, tal cual la escribió: ${pedido}\n\nExplora el repo y produce el documento de requerimientos completo.`,
  { agentType: 'requirements-analyst' },
)

phase('Planning')
const plan = await agent(
  `Documento de requerimientos:\n\n${requirements}\n\nGenera el plan de implementación.`,
  { agentType: 'feature-planner' },
)

phase('Implementation')
let implementation = await agent(
  `Documento de requerimientos:\n\n${requirements}\n\nPlan de implementación:\n\n${plan}\n\nImplementa el plan completo y verifica tu propio trabajo antes de terminar.`,
  { agentType: 'feature-developer' },
)

phase('Review + QA')
let [review, qaUnit, qaUiUx] = await parallel([
  () => agent(
    `Documento de requerimientos:\n\n${requirements}\n\nPlan:\n\n${plan}\n\nReporte del programador (incluye qué cambió):\n\n${implementation}\n\nHaz code review escéptico contra el diff real en el working tree.`,
    { agentType: 'feature-code-reviewer', phase: 'Review + QA', schema: REVIEW_SCHEMA },
  ),
  () => agent(
    `Documento de requerimientos:\n\n${requirements}\n\nReporte del programador:\n\n${implementation}\n\nEscribe y corre tests unitarios/integración escépticos contra el diff real en el working tree.`,
    { agentType: 'qa-unit-skeptic', phase: 'Review + QA', schema: QA_UNIT_SCHEMA },
  ),
  () => agent(
    `Documento de requerimientos:\n\n${requirements}\n\nReporte del programador:\n\n${implementation}\n\nEjercita el flujo end-to-end en la UI real (o el framework E2E del repo) contra el diff real en el working tree.`,
    { agentType: 'qa-ui-ux-e2e', phase: 'Review + QA', schema: QA_UIUX_SCHEMA },
  ),
])

const hayBloqueantes =
  review?.veredicto === 'bloqueante' ||
  qaUnit?.veredicto === 'no_listo' ||
  (qaUiUx?.veredicto === 'no_listo' && !qaUiUx?.no_aplica)

let remediation = null
if (hayBloqueantes) {
  phase('Remediation')
  remediation = await agent(
    `Esto es una ronda de remediación, no una implementación nueva. Corrige SOLO lo bloqueante, sin tocar nada más.\n\nHallazgos de code review:\n${JSON.stringify(review?.findings ?? [])}\n\nReporte QA unit (bugs encontrados):\n${JSON.stringify(qaUnit?.bugs_encontrados ?? [])}\n\nReporte QA UI/UX (hallazgos funcionales):\n${JSON.stringify(qaUiUx?.hallazgos_funcionales ?? [])}\n\nVerifica tu corrección antes de terminar.`,
    { agentType: 'feature-developer' },
  )
  log('Ronda de remediación completada — no se re-corre QA automáticamente; revisa el resultado antes de dar por cerrado el feature.')
}

return {
  requirements,
  plan,
  implementation,
  review,
  qaUnit,
  qaUiUx,
  hayBloqueantes,
  remediation,
}
```
