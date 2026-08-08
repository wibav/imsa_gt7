#!/usr/bin/env node
/**
 * Descarga el CSV "Ventas Detalladas" (informes/index.vue -> exportarCsvVentasDetalle)
 * llamando directamente a la API, sin pasar por la UI.
 *
 * Uso:
 *   node fetch-detalle-csv.mjs --empresa "General Cook S.A." --maquina "INACAP Apoquindo" \
 *     --desde 28-07-2026 --hasta 28-07-2026 [--out ruta.csv] [--base http://localhost:3001]
 *
 * Requiere las variables de entorno SIMA_ADMIN_EMAIL / SIMA_ADMIN_PASSWORD
 * (credenciales de un usuario del portal admin, nunca hardcodear). Ejemplo:
 *   node --env-file=.env fetch-detalle-csv.mjs --empresa ... --maquina ... --desde ... --hasta ...
 */

const ACCION_PUSH = 1;
const SUBJECT_SELECCIONAR_EMPRESAS = 15;
const INTERVALO_PERSONALIZADO = 16;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function normalize(str) {
  return String(str ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// get_ventas_detalladas declara p_fecha_inicio/p_fecha_fin como `date` y
// generarInformeDetalle.post.ts los bindea directo, sin TO_DATE(...,'DD-MM-YYYY')
// como el resto de los informes — Postgres los interpreta según el DateStyle
// de la sesión (acá "ISO, MDY"), lo que rompe con día > 12 y puede leer mal
// día/mes en silencio para día <= 12. El formato ISO (YYYY-MM-DD) es el único
// que Postgres reconoce sin ambigüedad sin importar el DateStyle, así que el
// skill manda las fechas así en vez de tocar el endpoint.
function ddmmyyyyToIso(str) {
  const [d, m, y] = str.split("-");
  return `${y}-${m}-${d}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

async function callApi(base, path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}`);
  }
  return res.json();
}

function findByName(list, nameField, query, label) {
  const q = normalize(query);
  const exact = list.find((item) => normalize(item[nameField]) === q);
  if (exact) return exact;
  const partial = list.filter((item) => normalize(item[nameField]).includes(q));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    fail(
      `"${query}" es ambiguo para ${label}, coincide con: ${partial
        .map((i) => i[nameField])
        .join(", ")}`,
    );
  }
  fail(`No se encontró ${label} que coincida con "${query}"`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const empresaNombre = args.empresa;
  const maquinaNombre = args.maquina;
  const fechaInicio = args.desde;
  const fechaFin = args.hasta;
  const base = args.base || process.env.SIMA_API_BASE || "http://localhost:3001";

  if (!empresaNombre || !fechaInicio || !fechaFin) {
    fail(
      "faltan parámetros. Uso: --empresa <nombre> [--maquina <nombre>] --desde DD-MM-YYYY --hasta DD-MM-YYYY [--out ruta.csv] [--base url]",
    );
  }
  if (!/^\d{2}-\d{2}-\d{4}$/.test(fechaInicio) || !/^\d{2}-\d{2}-\d{4}$/.test(fechaFin)) {
    fail("--desde/--hasta deben tener formato DD-MM-YYYY (igual que el date picker de informes)");
  }

  const email = process.env.SIMA_ADMIN_EMAIL;
  const password = process.env.SIMA_ADMIN_PASSWORD;
  if (!email || !password) {
    fail(
      "faltan credenciales: define SIMA_ADMIN_EMAIL y SIMA_ADMIN_PASSWORD (nunca las pases por línea de comando ni las hardcodees)",
    );
  }

  console.error(`Login contra ${base} ...`);
  const login = await callApi(base, "/apiV2/usuario/loginPortalUsuario", {
    method: "POST",
    body: { usuario_correo: email, usuario_pass: password },
  });
  if (login.status !== "success" || !login.token) {
    fail(login.message || "login falló");
  }
  const { token, user, permisos } = login;

  const canSelEmpresa = (permisos ?? []).some(
    (p) => p.subject_id === SUBJECT_SELECCIONAR_EMPRESAS && p.accion_id === ACCION_PUSH,
  );

  let empresaId = user.empresa_id;
  if (canSelEmpresa) {
    const empresasRes = await callApi(base, "/apiV2/empresa/listaEmpresasPortal", { token });
    const empresa = findByName(empresasRes.data ?? [], "empresa_nombre", empresaNombre, "empresa");
    empresaId = empresa.empresa_id;
  } else if (normalize(empresaNombre) !== normalize(user.empresa_nombre)) {
    console.error(
      `Aviso: el usuario ${email} no puede seleccionar otras empresas (permiso seleccionarEmpresa) ` +
        `— se usará su propia empresa "${user.empresa_nombre}" en vez de "${empresaNombre}".`,
    );
  }

  // Sin --maquina: "Todas", igual que filtroMaquina=0 en la UI (sin filtro).
  let maquinaId = 0;
  if (maquinaNombre) {
    const maquinasRes = await callApi(
      base,
      `/apiV2/empresa/getMaquinasByEmpresaId/${empresaId}`,
      { token },
    );
    const maquina = findByName(maquinasRes.data ?? [], "maquina_nombre", maquinaNombre, "máquina");
    maquinaId = maquina.maquina_id;
  }

  const body = {
    intervalo: INTERVALO_PERSONALIZADO,
    empresaId,
    maquinaId,
    tipoUsuario: user.usuariotipo_id,
    admFiltroEmpresa: canSelEmpresa,
    fechaInicio: ddmmyyyyToIso(fechaInicio),
    fechaFin: ddmmyyyyToIso(fechaFin),
  };

  console.error(
    `Pidiendo detalle: empresa_id=${empresaId} maquina_id=${maquinaId || "todas"} (${fechaInicio} a ${fechaFin}) ...`,
  );
  const detalle = await callApi(base, "/apiV2/informe/generarInformeDetalle", {
    method: "POST",
    token,
    body,
  });
  if (detalle.status !== "success") {
    fail(detalle.message || "generarInformeDetalle falló");
  }
  const rows = detalle.data?.actual ?? [];

  const headers = [
    "Id_pedido",
    "Fecha_Pedido",
    "Código_Producto",
    "Producto",
    "Cantidad",
    "Precio_Unitario",
    "Slot",
    "2x1",
    "%_Descuento",
    "Subtotal",
    "MontoFijo",
    "Descuento",
    "Total",
    "Usuario",
    "Usuario_rut",
    "maquina_direccion",
    "medio_de_pago",
    "Estado_Pedido",
  ];
  const lines = rows.map((d) =>
    [
      d.id_pedido,
      d.fecha_pedido,
      d.código_producto,
      d.nombre_producto,
      d.cantidad,
      formatCurrency(d.precio_unitario),
      d.slot,
      d.dosxuno,
      d.porcentajedescuento,
      formatCurrency(d.subtotal),
      formatCurrency(d.monto_fijo),
      formatCurrency(d.descuento),
      formatCurrency(d.precio_total),
      d.usuario,
      d.usuario_rut,
      d.maquina_direccion,
      d.medio_de_pago,
      d.estado_nombre,
    ].join(";"),
  );
  const csv = [headers.join(";"), ...lines].join("\r\n");

  const { writeFileSync } = await import("node:fs");
  const maquinaSlug = maquinaNombre ? normalize(maquinaNombre).replace(/\s+/g, "_") : "todas";
  const outPath =
    args.out ||
    `ventas_detalladas_${normalize(empresaNombre).replace(/\s+/g, "_")}_${maquinaSlug}_${fechaInicio}_${fechaFin}.csv`;
  writeFileSync(outPath, csv, "utf8");

  const totalNeto = rows.reduce((s, r) => s + (Number(r.precio_total) || 0), 0);
  console.error(
    `OK: ${rows.length} líneas, total ${formatCurrency(totalNeto)} -> ${outPath}`,
  );
}

main().catch((err) => fail(err.message || String(err)));
