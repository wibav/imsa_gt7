# Plan de Monetización — Plataforma SaaS Multi-Tenant para Ligas de GT7

> Objetivo: convertir la plataforma actual (single-tenant, para tu comunidad)
> en un producto que se "alquila" a organizadores de ligas/eventos, cada uno
> con sus propios campeonatos, eventos, administradores y comisarios, aislados
> entre sí.

Fecha: 2026-07-02

> **Actualización 2026-07-20 (ADR-007):** el mecanismo de cobro descrito en
> §1.3/§1.4/§3 (suscripción mensual/anual recurrente) fue reemplazado por
> **venta de lotes prepagados de campeonatos/eventos** — se compran, se
> consumen 1 a 1 al crear cada campeonato/evento, y no caducan por tiempo.
> El resto del documento (segmentos, roles, arquitectura multi-tenant,
> routing, branding) sigue vigente sin cambios. Detalle técnico completo en
> `Notas/Proyectos/GT7 Championships/ADR/ADR-007-lotes-prepagados-vs-
> suscripcion.md`.
>
> **Actualización 2026-07-24 — estado real de implementación:**
> - **Pasarela elegida: Paddle** (MoR, resuelve el punto abierto del §3.2/§8).
>   Checkout (Paddle.js) + `functions/main.py:paddle_webhook` + promoción de
>   `organizations/{id}.plan` en Firestore ya están **implementados y probados
>   de punta a punta**. El botón de upgrade en `/facturacion` está apagado a
>   propósito (`UPGRADE_ENABLED = false`) hasta definir los **paquetes/lotes
>   concretos y sus precios** — hoy solo existe un único `priceId` de prueba.
>   Es el único punto pendiente de este documento (ver §8bis).
> - **Modelo de créditos implementado**: `organizations/{id}.championshipCredits`
>   se descuenta 1 al crear cada campeonato/evento (Cloud Function con Admin
>   SDK, `firestore.rules` bloquea la creación en 0). El plan Free arranca con
>   1 crédito. `billingExempt: true` (GT7 ESP) omite el descuento.
> - **Nueva función de pago: sugerencias de reclamaciones con IA (Gemini)**,
>   ver §9 — no estaba prevista en el plan original y se añade aquí porque
>   tiene coste variable real por llamada (facturado a nosotros por Google),
>   así que se restringe a organizaciones en plan de pago (Starter/Pro) o
>   `billingExempt`, igual que el resto de features de pago del documento.

---

## 0. Resumen ejecutivo

La app hoy es **single-tenant**: una sola comunidad, colecciones globales
(`championships`, `events`, `teams`, `tracks`, `userRoles`), roles decididos en
el cliente (lista `ADMIN_EMAILS` hardcodeada) y **sin `firestore.rules`**.

Para monetizar alquilándola necesitamos **multi-tenancy real**: un concepto de
**Organización** (tenant) que aísle datos, usuarios y permisos, más un sistema
de **suscripciones** que active/limite/suspenda cada organización.

El mayor riesgo NO es el cobro: es el **aislamiento y la seguridad**. Vender
acceso a terceros sobre la arquitectura actual expondría los datos de un cliente
a otro. Por eso el trabajo se ordena en fases y la **Fase 0 (blindaje) es
obligatoria** antes de aceptar el primer cliente de pago.

---

## 1. Modelo de negocio

### 1.1 Propuesta de valor
"Monta y gestiona tu liga de sim racing en minutos: campeonatos, calendario,
inscripciones, clasificaciones automáticas, sanciones, comisarios y
notificaciones — sin planillas de Excel ni bots caseros."

### 1.2 Segmentos de cliente
- **Clubes / comunidades de sim racing** (Discord/WhatsApp) que hoy usan Excel.
- **Ligas amateur organizadas** con calendario y reglamento.
- **Organizadores de torneos puntuales** (eventos únicos, copas de fin de semana).
- **Patrocinadores / tiendas gaming** que corren ligas como marketing.
- (Futuro) **Otros juegos** (ACC, iRacing, F1) reusando el motor.

### 1.3 Modelo: SaaS por suscripción (alquiler mensual/anual)
Cada organización paga una cuota recurrente. Los límites del plan (nº de
campeonatos activos, pilotos, admins, comisarios, branding) definen el precio.

### 1.4 Planes sugeridos

| Plan | Precio ref. (EUR/mes) | Campeonatos/eventos | Pilotos | Admins | Comisarios | Branding | URL propia |
|------|----------------------|---------------------|---------|--------|-----------|----------|-----------|
| **Free (prueba única)** | 0 € — **una sola vez** | **1 campeonato O 1 evento** | **15** (máx.) | 1 | 1 | "Powered by" visible | No |
| **Starter** | 9–15 € | 3 activos | 60 | 3 | 5 | "Powered by" visible | No |
| **Pro** | 29–39 € | Ilimitados | 200 | 10 | 15 | **Logo + colores propios** | **Sí: `trenkit.com/l/mi-liga`** |

- **Moneda: EUR** (resides en Portugal). **Ciclos: mensual y anual** (anual con
  descuento, ~2 meses gratis).

**Notas de diseño de planes:**
- **Free = prueba única, no recurrente.** Cada cuenta/organización puede usar el
  plan Free **una sola vez** (crear 1 campeonato **o** 1 evento). Al terminar o
  para crear otro, debe pasar a un plan de pago. Objetivo: que prueben el
  producto real, no un free tier permanente que compita con los de pago.
- **Límite de 15 pilotos en Free** por diseño de GT7: las **salas de GT7 admiten
  16 jugadores** (15 pilotos + el host/organizador). Así una liga Free cabe en
  una sola sala/carrera. Los planes de pago permiten más pilotos porque soportan
  **divisiones/múltiples salas** dentro de un mismo campeonato.
- **Pro** desbloquea **branding propio** (logo + colores) y **URL con el nombre
  del equipo/liga** en formato path: `imsa.trenkit.com/hispania-game-team`
  (ver §2.5 para la viabilidad técnica en el export estático actual).
- **Elite / dominio propio: descartado** por ahora (no aplica al alcance actual).
- **Anual**: 2 meses gratis (~17% descuento) para mejorar retención y caja.
- **Add-ons** (futuro): notificaciones Discord/Telegram propias, almacenamiento
  extra de imágenes, exportaciones con marca.
- **LATAM**: considerar precios locales y Mercado Pago además de tarjeta.

### 1.5 Unit economics (aproximado)
- **Costo variable por tenant**: bajo (Firestore + Hosting + Functions). El punto
  caro es el patrón actual de **lecturas client-side** (se carga mucho en cada
  visita); a escala hay que optimizar (paginación, caché, agregados).
- Con Pro a ~$35/mes y costo de infra por tenant < $2/mes, el margen bruto es
  alto (>90%). El límite real es **adquisición y soporte**, no la infra.
- **Meta inicial realista**: 10–20 ligas de pago = $350–$800 MRR con el mismo
  código, sin costos marginales relevantes.

---

## 2. Arquitectura multi-tenant (el gran reto técnico)

### 2.1 Concepto central: Organización (tenant)
Nueva entidad raíz `organizations/{orgId}` con: nombre, slug, plan, estado
(`trial|active|past_due|suspended`), branding (logo, colores), dominio, owner,
límites del plan, fechas de suscripción.

### 2.2 Modelo de datos — scoping por `orgId`
Dos estrategias:

**A) Colecciones planas + campo `orgId`** (recomendado para migrar rápido)
- `championships/{id}` gana `orgId`. Todas las queries filtran `where('orgId','==',X)`.
- Pros: cambio incremental, reusa el código actual. Contras: exige rules estrictas
  y buenos índices; riesgo de "olvidar el filtro" en alguna query.

**B) Subcolecciones por organización** (`organizations/{orgId}/championships/...`)
- Pros: aislamiento natural, rules más simples. Contras: refactor más grande de
  `FirebaseService` y de todas las páginas.

> Recomendación: empezar con **A** para el motor existente, con `firestore.rules`
> que **obliguen** el `orgId` correcto (defensa real, no de fachada).

Colecciones a scopear: `championships`, `events`, `teams`, `tracks`,
`registrations` (viven dentro de championship), `penalties`, `userRoles` →
pasa a `memberships`.

### 2.2bis Migración de la data actual — garantía de cero pérdida

**Requisito no negociable**: nada de lo que existe hoy (campeonatos, eventos,
equipos, pistas, inscripciones, sanciones, reclamaciones, roles) puede perderse,
corromperse ni quedar huérfano al introducir `orgId`.

**Enfoque de migración (script de backfill, no reescritura manual):**
1. Se crea la organización `GT7 ESP` como **org #1**, con `wolcutor@gmail.com`
   como su Organizador.
2. Un script (Cloud Function o script one-off con Admin SDK) recorre **todas**
   las colecciones existentes y les añade `orgId: "gt7-esp"` a cada documento,
   **sin tocar ningún otro campo** — es un `update` aditivo, no una migración
   destructiva.
3. Antes de correrlo en producción: **backup completo de Firestore** (export a
   Cloud Storage) — reversible en minutos si algo sale mal.
4. Se corre primero contra un **proyecto/entorno de prueba** (o export local)
   para validar que el conteo de documentos migrados coincide exactamente con
   el conteo previo, y que ninguna query del frontend rompe (smoke test manual
   de: ver campeonatos, ver standings, entrar al admin, ver inscripciones).
5. Solo después de validar, se aplica en producción y se despliegan las
   `firestore.rules` que ya exigen `orgId`. Hasta ese punto, la app sigue
   funcionando exactamente igual que hoy (nada rompe a mitad de camino).

> Este script y su validación son el primer entregable técnico de la Fase 1 —
> antes de tocar rules ni roles, la prioridad es que la migración sea
> **verificablemente completa y reversible**.

### 2.3 Identidad y roles — org-scoped con Custom Claims
Hoy: `isAdmin` = email en lista hardcodeada; `comisario` en `userRoles` global.

**Nomenclatura de roles (definida):**

- **Administrador de Plataforma** (👑 *tú, dueño de la web*): super-admin global,
  **por encima de todas las organizaciones**. Gestiona las orgs, el billing, y
  puede suspender/reactivar. Es un rol de plataforma, no pertenece a ninguna org.

Dentro de cada organización (liga/club):
- **Organizador**: dueño de la liga/club (quien paga la suscripción). Gestiona su
  organización, su branding, su facturación y a su equipo.
- **Director de liga**: administra campeonatos/eventos dentro de la org (equivale
  al "admin" actual, pero acotado a su organización).
- **Comisario**: revisa resultados, sanciones y reclamaciones de su org.
- **Piloto / usuario**: se inscribe y consulta.

> Jerarquía: **Administrador de Plataforma (tú)** › Organizador › Director de liga
> › Comisario › Piloto.

**Tu doble rol (`wolcutor@gmail.com`)**: eres **Administrador de Plataforma**
(único, con visibilidad y control sobre todas las organizaciones incluidas las
de clientes) **Y ADEMÁS** Organizador de tu propia organización (`GT7 ESP`, la
comunidad actual). Es decir, con el mismo email tienes el claim de plataforma
más la membresía de Organizador en `org #1`. Técnicamente: el custom claim
`platformOwner: true` es independiente y adicional a tu `membership` en `GT7 ESP`.

**Tu equipo actual (admins y comisarios de GT7 ESP) queda fuera del modelo
comercial**: no son "invitados" a través del flujo de onboarding self-service
de un cliente que paga — son directamente **miembros de la organización GT7 ESP**
(tu propia liga), migrados 1:1 desde `userRoles` a `memberships` con
`orgId: "gt7-esp"` en el mismo script de la Fase 1 (§2.2bis). Conservan
exactamente los mismos permisos que tienen hoy (Director de liga / Comisario),
solo que ahora acotados formalmente a `orgId: "gt7-esp"` en vez de ser globales.
No pagan suscripción ni pasan por Stripe/MoR — `GT7 ESP` puede marcarse
internamente como organización exenta de facturación (un flag
`billingExempt: true` o plan especial "house", visible solo para ti como
Administrador de Plataforma).

Implementación: `memberships/{uid}_{orgId}` con `{ uid, orgId, role }` + **Firebase
Custom Claims** (`{ orgId, role }`) inyectados por Cloud Function al invitar/loguear.
Los claims permiten que las **Security Rules** validen permiso sin leer otra doc.

**Firebase Admin SDK (parte de la Fase 0)**: los custom claims y las operaciones
privilegiadas (crear org, asignar roles, suspender por impago) **solo pueden
ejecutarse en el servidor con el Admin SDK**, nunca desde el cliente. Hoy ya
existe `src/app/api/firebase/services.js` (Admin SDK), pero como el sitio es
export estático esa ruta **no corre en producción**; por eso el Admin SDK debe
vivir en **Cloud Functions** (igual que hicimos con `notify`). Fase 0 incluye
montar esa base: funciones con Admin SDK para gestionar usuarios/claims/roles de
forma segura. Esto además reemplaza la lista `ADMIN_EMAILS` hardcodeada del
cliente por roles reales verificables en el backend.

### 2.4 Firestore Security Rules — CRÍTICO (hoy inexistentes)
Como el sitio es static export y el cliente lee/escribe Firestore directo, **las
rules son la única barrera real**. Sin ellas, con la API key pública (que es
pública por diseño) cualquiera puede leer/escribir todo. Reglas base:
- Todo doc lleva `orgId`; una lectura/escritura solo se permite si el custom
  claim `orgId` del usuario coincide.
- Escrituras de configuración (crear campeonato, sanciones) exigen rol
  `admin`/`comisario` de esa org.
- Datos públicos de solo lectura (clasificaciones visibles) se exponen con
  cuidado y solo campos necesarios.

### 2.5 Routing del tenant — URL propia `imsa.trenkit.com/mi-liga` (plan Pro)

**Objetivo**: que una liga Pro tenga una URL limpia con su nombre, ej.
`imsa.trenkit.com/hispania-game-team`.

**Buena noticia: es viable con el export estático actual, sin migrar a SSR.**
El `firebase.json` ya reescribe `** → /index.html` (SPA fallback), así que
`imsa.trenkit.com/hispania-game-team` **ya sirve la app**. Solo falta que el
cliente:
1. Lea el primer segmento del path (`hispania-game-team`).
2. Lo resuelva contra `organizations` (buscar por `slug`).
3. Cargue esa organización como tenant activo (y aplique su branding).

**Decisión: URL con prefijo** — `trenkit.com/l/hispania-game-team`.
Se usa un prefijo (`/l/`) para que el slug **nunca colisione** con las rutas del
sistema (`/pilots`, `/events`, `/championships`, `/admin`, `/api`, …). Es la
opción más segura de implementar sobre el export estático: un rewrite del tipo
`/l/** → /index.html` y el cliente lee el slug tras `/l/` y resuelve la
organización. (El prefijo exacto `/l/` es cosmético y ajustable.)

**Slug elegido por el cliente** (decidido): al crear su organización, el
Organizador escribe su propio slug (típicamente el nombre de su equipo/club, ej.
`hispania-game-team`). Validaciones al crear:
- **Unicidad** global (no puede haber dos orgs con el mismo slug).
- **Formato**: minúsculas, números y guiones; sin espacios ni acentos.
- **Longitud** mínima/máxima y lista de slugs prohibidos (marca, insultos, etc.).

> A futuro, si se quisieran **subdominios** (`hispania.trenkit.com`) o **dominios
> propios**, ahí sí convendría evaluar migrar a **SSR (Firebase App Hosting /
> Cloud Run)**. Fuera del alcance actual (Elite descartado).

### 2.6 Operaciones privilegiadas → Cloud Functions
Crear org, invitar miembros, asignar roles/claims, y **webhooks de billing** NO
pueden vivir en el cliente. Van en Functions (ya tienes infra Python:
`convert_to_gt_svg`, `notify`). Añadir: `createOrg`, `inviteMember`, `setClaims`,
`stripeWebhook`.

### 2.7 Almacenamiento de imágenes (banners) — control de peso
Los banners de campeonatos/eventos hoy se suben a Firebase Storage sin límite,
lo que a escala multi-tenant **satura Storage y dispara costos y tiempos de
carga**. Requisito: controlar el peso de cada imagen. Enfoques (combinables):

1. **Compresión en el cliente antes de subir** (recomendado, más simple con
   export estático): redimensionar a un ancho máx. (p.ej. 1600px) y recomprimir
   a JPEG/WebP usando `<canvas>` o una librería ligera
   (`browser-image-compression`). El usuario sube "pesado", pero se guarda
   liviano. **Objetivo de peso final: entre 500 KB y 800 KB** (buen equilibrio
   entre calidad visual del banner y consumo de Storage/ancho de banda); se ajusta
   iterando la calidad hasta caer en ese rango. Ya se usa un patrón de subida en
   `TrackFormModal`/`eventsAdmin`; se centraliza en un helper `compressImage()`.
2. **Límite duro de tamaño**: rechazar > N MB antes de subir (hoy ya hay checks
   de 5 MB en algunos formularios; unificarlos y bajarlos).
3. **Límite por plan**: cuota de almacenamiento por organización (Free/Starter/Pro)
   validada al subir; avisar y bloquear al excederla.
4. (Opcional, más adelante) **Storage trigger** (Cloud Function) que
   redimensione/optimice server-side como red de seguridad.

> Este ítem es concreto y de bajo riesgo: conviene implementarlo pronto (incluso
> antes del multi-tenant) porque protege tu Storage actual. Entra en Fase 0.

---

## 3. Cobro y suscripciones

### 3.1 Mecánica técnica (actualizado — ver nota ADR-007 al inicio del documento)

> Esta sección describía originalmente Stripe + suscripción recurrente. Con
> ADR-007 el cobro pasó a ser **venta de lotes prepagados vía Paddle (MoR)**,
> ya implementado:

- **Paddle** (Merchant of Record): `Paddle.Checkout.open()` en `/facturacion`
  (`src/app/facturacion/page.js`) abre el checkout con `customData: { orgId }`.
  Paddle cobra, calcula y remite el IVA/impuestos por nosotros.
- **Webhook** (Cloud Function `paddle_webhook` en `functions/main.py`):
  verifica la firma con `PADDLE_WEBHOOK_SECRET` (Secret Manager, antirreplay
  de 5 min), promueve `organizations/{id}.plan` y **recarga
  `championshipCredits`** según el lote comprado.
- **No hay suscripción recurrente que cancelar/renovar**: los créditos no
  caducan por tiempo. `status` (`trial|active|past_due|suspended`) queda para
  uso futuro si se reintroduce algo recurrente (p. ej. un add-on mensual como
  las sugerencias de IA, ver §9).
- **Free de un solo uso**: se marca consumiendo el crédito inicial
  (`championshipCredits` pasa de 1 a 0 al crear el primer campeonato/evento);
  para crear más hace falta comprar un lote (plan de pago).
- **Enforcement de límites**: doble capa — UI (ocultar/avisar en
  `/facturacion` y formularios) + `firestore.rules` (`canCreateInOrg`, impide
  crear con `championshipCredits <= 0` salvo `billingExempt`) + Cloud
  Functions con Admin SDK para lo que las rules no pueden validar (contadores
  agregados, límites de pilotos por evento).

### 3.2 Situación fiscal/legal (Portugal, sin empresa) — importante
> Nota: orientación general, **no es asesoría fiscal**. Confirmar con un
> *contabilista certificado* en Portugal.

**¿Necesitas una empresa para usar Stripe? No.** Stripe opera en Portugal y
acepta **cuentas de particular / trabajador independiente** (no exige sociedad).
Te registras con tu **NIF** e **IBAN**. Pero hay dos capas distintas:

1. **Cobrar** (Stripe): puede hacerlo un particular. Fácil.
2. **Facturar y declarar legalmente** ese ingreso en Portugal: como particular
   necesitarías **"abrir atividade"** como *trabalhador independente* (categoria
   B) para emitir facturas/recibos, y gestionar **IVA**. Vender un SaaS digital a
   clientes de otros países de la UE activa obligaciones de **IVA transfronterizo
   (régimen OSS)** aunque debajo de cierto umbral haya exenciones internas. Aquí
   es donde la carga administrativa crece para un solo dev.

**Recomendación pragmática — Merchant of Record (MoR):** para empezar en solitario
y sin empresa, una pasarela tipo **Merchant of Record** simplifica enormemente lo
fiscal. El MoR es *el vendedor legal* ante tu cliente: **cobra, calcula y remite
el IVA/impuestos de cada país por ti, emite las facturas** y te paga a ti como
proveedor. Opciones:
- **Lemon Squeezy** (hoy parte de Stripe) — MoR, ideal para SaaS indie.
- **Paddle** — MoR consolidado para software/SaaS.
- Coste: comisión mayor que Stripe puro (~5% + fees vs ~2.9% + €0,25), a cambio
  de **quitarte el IVA internacional y la facturación de encima**.

**Camino sugerido:**
- **Fase inicial (solo, sin empresa):** usar un **MoR (Lemon Squeezy/Paddle)** →
  cobras global sin lidiar con IVA-OSS ni facturación multi-país. Igual conviene
  "abrir atividade" para declarar en Portugal el ingreso que el MoR te paga.
- **Más adelante (con volumen/empresa):** migrar a **Stripe directo** para bajar
  comisiones, ya con contabilista y estructura (particular con atividade o
  sociedad unipessoal, según recomiende el contabilista).

> **Estado (a resolver por ti):** revisar los requisitos de registro de
> **Lemon Squeezy** y **Paddle** (qué datos/entidad piden a un residente en
> Portugal sin empresa) para elegir. Como el lanzamiento es **validar primero**
> (ver §6), el billing self-service no es urgente: se puede cobrar el piloto de
> forma **manual** (link de pago) mientras se decide la pasarela definitiva.

---

## 4. Onboarding self-service
Flujo: registro → crea organización (slug) → **activa su prueba Free (un solo
uso)** → asistente de configuración (branding, primera categoría, primer
campeonato/evento) → invitar admins y comisarios por email → publicar. Para un
segundo campeonato/evento o seguir activo, se suscribe a un plan de pago. Todo
sin intervención tuya.

Panel **Platform Owner**: listado de orgs, estado de suscripción, uso vs límites,
suspender/reactivar, métricas (MRR, churn, activación).

---

## 5. Branding (plan Pro)
- **Pro**: logo y colores propios, nombre, favicon, imágenes OG dinámicas, y
  **URL propia por path** (`trenkit.com/l/mi-liga`, ver §2.5).
- **Free/Starter**: mantienen el "Powered by" y la URL genérica.
- El generador de OG (ya existe pipeline) se parametriza por org.
- Dominio propio / subdominio: **fuera de alcance** (Elite descartado).

---

## 6. Roadmap por fases (ordenado por dependencia)

| Fase | Objetivo | Entregable clave | Esfuerzo aprox. |
|------|----------|------------------|-----------------|
| **0. Blindaje** *(obligatorio)* | Cerrar el hueco de seguridad actual | `firestore.rules` + índices + **Firebase Admin en Cloud Functions** (claims/roles) + quitar `ADMIN_EMAILS` del cliente + **compresión/límite de banners** | Alto |
| **1. Modelo de Org** | Introducir tenant sin perder data | Entidad `organizations`, script de backfill `orgId` verificado contra backup (§2.2bis), tu comunidad migrada como "org #1" con tu equipo actual intacto | Alto |
| **2. Auth org-scoped** | Permisos aislados | `memberships`, custom claims, rules que validan `orgId`+rol, invitaciones | Alto |
| **3. Routing + Branding** | Cada liga se ve como suya | Resolución de tenant por path (`/mi-liga` con palabras reservadas), branding por org (logo+colores, plan Pro), OG dinámico | Medio |
| **4. Billing** | Cobrar | ✅ Implementado: Paddle Checkout + `paddle_webhook`, créditos por lote, Free de un solo uso. Pendiente solo definir paquetes/precios finales y activar `UPGRADE_ENABLED` (§8, §9) | Medio-Alto |
| **5. Onboarding self-service** | Escalar sin ti | Registro→crea org→prueba→asistente, panel Platform Owner | Medio |

> **Estrategia decidida: VALIDAR PRIMERO.** No construir billing self-service de
> entrada. Secuencia:
> 1. **Fase 0** (blindaje: rules, Firebase Admin, banners) — base y beneficio hoy.
> 2. **Fase 1–2** (modelo de Org + auth aislada) — poder tener varias ligas.
> 3. **Piloto manual** con 1–2 ligas conocidas: onboarding a mano y **cobro
>    manual** (link de pago), para validar que pagan y que el aislamiento aguanta.
> 4. Solo si el piloto valida: **Fase 3 (branding/URL)**, luego **Fase 4 (billing
>    self-service)** y **Fase 5 (onboarding self-service)**.

---

## 7. Riesgos y consideraciones

- **Aislamiento de datos (máximo riesgo)**: un bug de scoping = fuga entre
  clientes. Mitigación: rules estrictas + tests de seguridad + revisión de cada
  query. No vender hasta cerrar Fase 0–2.
- **Costo Firebase a escala**: el patrón client-side actual multiplica lecturas.
  Optimizar (paginación, caché, documentos agregados de standings) antes de
  crecer, o el margen se erosiona.
- **Migración sin romper tu comunidad**: tu liga actual debe seguir funcionando
  y **sin perder ni un dato**; se migra como la primera organización (`GT7 ESP`) con
  un script de backfill de `orgId` validado contra backup antes de aplicarse
  (ver §2.2bis). Tus admins/comisarios actuales pasan a ser miembros de esa org
  con los mismos permisos, sin pasar por el flujo comercial ni facturación.
- **Static export es suficiente**: la URL por path (`/mi-liga`) funciona con el
  export estático actual (§2.5), así que **no hace falta migrar a SSR** para el
  alcance acordado. Solo se reconsideraría si en el futuro se quisieran
  subdominios o dominios propios (hoy fuera de alcance).
- **Legal**: Términos de Servicio, Política de Privacidad, tratamiento de datos
  personales (emails/PSN IDs), y procesamiento de pagos (PCI lo cubre Stripe).
- **Soporte y SLA**: definir canal y expectativas por plan; el soporte es el
  costo humano real del SaaS.
- **Marca / IP**: el producto se comercializa **bajo "trenkit"** (decidido). La
  comunidad actual (GT7 ESP) pasa a ser la **organización #1** dentro de trenkit.
- **Alcance de juego**: **solo GT7** por ahora (decidido). No se invierte en
  soportar otros juegos, aunque el modelo de datos no debería impedirlo a futuro.

---

## 8. Decisiones ya tomadas y pendientes

**Todo decidido:**
1. **Estrategia: validar primero** (Fase 0–2 → piloto manual con 1–2 ligas →
   luego billing/self-service). Ver §6.
2. **Planes: Free (prueba única, 1 campeonato/evento, 15 pilotos) + Starter +
   Pro.** Elite descartado. Se mantiene Starter.
3. **Moneda EUR**, ciclos **mensual y anual**.
4. **Routing: URL con prefijo** `trenkit.com/l/mi-liga`. **Slug elegido por el
   cliente** (su equipo/club), validado (único, formato, prohibidos).
5. **Roles: Administrador de Plataforma (tú) › Organizador › Director de liga ›
   Comisario › Piloto.**
6. **Marca: trenkit.** GT7 ESP será la organización #1.
7. **Solo GT7** por ahora.
8. **Fase 0** incluye `firestore.rules` + **Firebase Admin** (claims/roles,
   reemplaza `ADMIN_EMAILS`) + **compresión de banners a 500–800 KB**.
9. **Continuidad de datos garantizada**: la migración a multi-tenant se hace
   con backfill aditivo + backup + validación previa, **cero pérdida de data**
   (§2.2bis). Tus admins/comisarios actuales de GT7 ESP se migran como miembros de
   la organización `GT7 ESP` (`org #1`), fuera del flujo comercial, sin facturación.
10. **`wolcutor@gmail.com` es propietario de todo**: Administrador de Plataforma
    (control global) y además Organizador de `GT7 ESP` (§2.3).

11. **Pasarela definitiva: Paddle** (MoR). Checkout + webhook + Firestore
    probados de punta a punta. Solo falta definir los **paquetes/lotes y sus
    precios reales** para activar el botón de upgrade (`UPGRADE_ENABLED` en
    `/facturacion`).
12. **Sugerencias de reclamaciones con IA (Gemini) son función de pago**: no
    entran en el plan Free porque Gemini tiene coste variable real por
    llamada. Ver §9.

**Único punto abierto:**
- **Paquetes/lotes y precios concretos** (cuántos campeonatos/eventos por
  lote, EUR por lote, si el add-on de IA del §9 va incluido en Pro o se cobra
  aparte). No bloquea nada más: el resto de la infraestructura de cobro ya
  está lista y probada.

---

## 9. Add-on de pago: sugerencia de reclamaciones con IA (Gemini)

> Añadido 2026-07-24, no estaba en el plan original — se documenta aquí
> porque introduce el primer caso real de **coste variable por uso** de la
> plataforma (a diferencia del resto, que es coste fijo de infra por tenant,
> §1.5).

### 9.1 Qué hace
En el modal de resolver una reclamación, el comisario puede pedir una
sugerencia: la Cloud Function `suggest_claim_resolution`
(`functions/main.py`) toma la evidencia en video (URLs de YouTube) de la
reclamación, se la pasa a Gemini (`gemini-3.6-flash`, análisis nativo de URL
de YouTube sin descarga/subida) junto con el contexto de la reclamación
(reclamante, acusado, carrera, descripción), y devuelve una sugerencia en
español (qué se observa, evaluación, sugerencia de resolución y severidad).
El comisario decide siempre — no es un fallo automático.

### 9.2 Por qué es de pago
A diferencia de casi todo lo demás en esta plataforma (Firestore, Hosting,
Functions con costo marginal por tenant muy bajo, §1.5), **cada llamada a
Gemini tiene un coste real que pagamos nosotros a Google**, no el organizador.
Ofrecerlo gratis en el plan Free rompería la unit economics del §1.5 sin
límite (cualquier organización Free podría generar llamadas ilimitadas).

### 9.3 Implementación del gating (hecho)
- **Backend (fuente de verdad)**: `suggest_claim_resolution` resuelve el
  `orgId` del campeonato de la reclamación, lee `organizations/{orgId}` y
  rechaza con `402` si `plan == 'free'` y no tiene `billingExempt: true`. Esto
  se evalúa **después** del chequeo de rol (comisario+/platformOwner) — un rol
  válido no basta si el plan de su organización no lo incluye.
- **Frontend (UX, no seguridad)**: `ResolveClaimModal`
  (`src/app/components/championship/PenaltiesTab.js`) recibe `org` y calcula
  `aiAvailable = org.billingExempt || org.plan !== 'free'`; si es falso, el
  botón "Pedir sugerencia" queda deshabilitado y muestra
  "🔒 Sugerencia IA (plan de pago)" con tooltip explicando que hay que
  actualizar el plan. Esto solo evita una llamada inútil al backend — el
  gating real está en la Cloud Function.
- **`GEMINI_API_KEY`** vive en Secret Manager (mismo patrón que
  `TELEGRAM_BOT_TOKEN`/`PADDLE_WEBHOOK_SECRET`), nunca en el cliente.

### 9.4 Pendiente de decidir (junto al punto abierto del §8)
- ¿Incluida en **Starter** también, o exclusiva de **Pro**? Hoy el gating del
  backend permite cualquier plan pagado (`plan != 'free'`), es decir Starter
  y Pro por igual — habría que ajustar el `if` en
  `functions/main.py:suggest_claim_resolution` si se decide restringirla solo
  a Pro.
- ¿Límite de llamadas por organización/mes (para acotar el coste de Gemini
  incluso en planes de pago) o coste ilimitado dentro del plan? Hoy no hay
  ningún tope de uso, solo el gating binario por plan.

> Siguiente paso técnico recomendado: arrancar **Fase 0**, empezando por el
> **control de peso de banners (500–800 KB)** —bajo riesgo y útil desde hoy— y
> luego `firestore.rules` + Firebase Admin para roles.
