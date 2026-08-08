---
name: informe-detalle-csv
description: Descarga el CSV "Ventas Detalladas" de informes/ directamente vía API (POST /apiV2/informe/generarInformeDetalle), sin pasar por la UI. Usar cuando el usuario pida el CSV de detalle de un informe personalizado (empresa + máquina + rango de fechas), por ejemplo para investigar un descuadre entre el informe y el detalle de pedidos.
---

# Informe detalle CSV

Automatiza lo que hace el botón "Exportar detalle a csv" de `informes/` (pestaña
Ventas Comparativas, intervalo Personalizado): hace login, resuelve
empresa/máquina por nombre, llama a `generarInformeDetalle` y arma el CSV con el
mismo formato exacto que genera `exportarCsvVentasDetalle()` en
[app/pages/informes/index.vue](../../../app/pages/informes/index.vue).

## Requisitos

- El servidor dev debe estar corriendo en `http://localhost:3001` (o pasar
  `--base <url>` para apuntar a otro ambiente).
- Variables de entorno con credenciales de un usuario del portal admin (nunca
  hardcodear ni pedirlas como argumento de línea de comandos):
  - `SIMA_ADMIN_EMAIL`
  - `SIMA_ADMIN_PASSWORD`

## Cómo usarlo

1. Si no hay un dev server corriendo, levantarlo con `preview_start` (`name`
   del launch.json) antes de llamar al script — el script solo hace requests
   HTTP, no arranca nada.
2. Ejecutar el script con Bash:

```bash
node .claude/skills/informe-detalle-csv/fetch-detalle-csv.mjs \
  --empresa "General Cook S.A." \
  --maquina "INACAP Apoquindo" \
  --desde 28-07-2026 \
  --hasta 28-07-2026
```

Parámetros:
- `--empresa`: nombre (o parte del nombre) tal como aparece en el selector de
  informes — el script resuelve el id contra `listaEmpresasPortal`. Si hay
  más de una coincidencia parcial, el script falla listando las opciones —
  hay que afinar el nombre.
- `--maquina` (opcional): igual, resuelto contra `getMaquinasByEmpresaId`. Si
  se omite, no filtra por máquina (`maquinaId: 0`), igual que "Todas" en el
  selector de la UI.
- `--desde` / `--hasta`: fechas en formato `DD-MM-YYYY` (igual que el date
  picker de informes). Siempre arma el request con `intervalo: 16`
  (Personalizado), igual que hace la UI.
- `--out <ruta>` (opcional): dónde guardar el CSV. Por defecto lo guarda en
  el directorio actual con un nombre derivado de empresa/máquina/fechas.
- `--base <url>` (opcional): API base, default `http://localhost:3001`.

3. Si el usuario que loguea el script NO tiene el permiso `seleccionarEmpresa`
   (push), el servidor igual fuerza el filtro a la empresa de ese usuario — el
   script avisa por stderr si la empresa pedida no coincide con la del login.
4. Reportar al usuario la ruta del CSV generado y el total de líneas/monto que
   imprime el script (stderr). Si el usuario quiere verlo, usar `SendUserFile`
   con la ruta devuelta.

## Notas

- `generarInformeDetalle.post.ts` bindea `fechaInicio`/`fechaFin` directo a
  `get_ventas_detalladas($1 date, $2 date, ...)` sin `TO_DATE(...,'DD-MM-YYYY')`
  como el resto de los informes, así que Postgres las interpreta según el
  `DateStyle` de la sesión (en dev: `ISO, MDY`) — rompe con día > 12 y puede
  invertir día/mes en silencio con día ≤ 12. En vez de tocar el endpoint, el
  script convierte `--desde`/`--hasta` a formato ISO (`YYYY-MM-DD`) antes de
  mandarlas (`ddmmyyyyToIso()`), que Postgres reconoce sin ambigüedad sea cual
  sea el `DateStyle`. Si algún día se corrige el endpoint con `TO_DATE`
  explícito, esta conversión deja de ser necesaria pero no hace daño dejarla.

- El script replica exactamente las columnas y el formato de moneda
  (`Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" })`) que
  usa `exportarCsvVentasDetalle()`, separando con `;` y sin comillas — si ese
  formato cambia en `app/pages/informes/index.vue`, hay que actualizar
  `fetch-detalle-csv.mjs` en paralelo para que no diverjan.
- No cachea el token en disco: hace login en cada corrida y lo usa solo en
  memoria durante la ejecución.
- Si el login falla o faltan las variables de entorno, el script termina con
  código de salida 1 y un mensaje explicando qué falta — no reintentar con
  credenciales hardcodeadas ni pedirlas por otro canal.
