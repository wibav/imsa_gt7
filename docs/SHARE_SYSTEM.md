# Sistema de Compartición Social - GT7 Championships

## Resumen

Sistema de compartición social que genera páginas estáticas optimizadas para crawlers (Facebook, WhatsApp, Twitter, Telegram) con metadata Open Graph y Twitter Cards pre-renderizada en build-time.

## Arquitectura

### URLs de Compartición

Las URLs de compartición siguen el patrón:

- **Campeonatos**: `https://imsa.trenkit.com/share/championship/{id}/`
- **Eventos**: `https://imsa.trenkit.com/share/event/{id}/`

Estas URLs:

1. Contienen metadata OG/Twitter en el HTML inicial (sin dependencia de JS)
2. Redirigen automáticamente a la página de navegación normal de la SPA (solo para navegadores, no crawlers)
3. Incluyen contenido `<noscript>` para crawlers sin JS

### Componentes Principales

#### 1. Script de Generación (`scripts/generate-share-pages.js`)

**Ejecución**: Parte del pipeline de build, después de `next build`

**Responsabilidades**:

- Conecta a Firestore usando firebase-admin
- Lee todos los campeonatos y eventos publicados (excluye `status: 'draft'`)
- Por cada entidad, genera una página HTML estática con:
  - Metadata OG/Twitter completa en `<head>`
  - Banner validado o imagen de fallback
  - Contenido `<noscript>` con información básica
  - Redirect automático (JS) a la página de la app
- Genera páginas de fallback para IDs no encontrados

**Validación de Banners**:

```javascript
function isValidOGBanner(banner) {
  if (!banner || typeof banner !== "string") return false;
  const cleaned = banner.trim();
  // Data URI o vacío → no apto
  if (cleaned.startsWith("data:") || cleaned === "") return false;
  // Debe empezar con http:// o https://
  return cleaned.startsWith("http://") || cleaned.startsWith("https://");
}
```

**Fallbacks**:

- Campeonato sin banner válido → `/og-championships.png`
- Evento sin banner válido → `/og-events.png`
- ID no encontrado → página genérica con metadata de fallback

**Salida**:

```
out/
  share/
    championship/
      {id}/
        index.html
      not-found/
        index.html
    event/
      {id}/
        index.html
      not-found/
        index.html
```

#### 2. Componente UI (`src/app/components/ShareButton.js`)

**Props**:

- `type`: `"championship"` | `"event"`
- `id`: ID de la entidad
- `title`: Título para compartir (opcional)

**Comportamiento**:

1. Intenta usar Web Share API nativa (móviles)
2. Fallback: copia URL al portapapeles
3. Feedback visual (✓ Copiado)

**Integración**:

- **Campeonatos**: En el header, junto al botón de Admin
- **Eventos**: Debajo del título, en el overlay del banner

### Pipeline de Build

```bash
npm run build
# Ejecuta en secuencia:
1. python3 scripts/generate-og-images.py      # Genera imágenes OG base
2. node scripts/prepare-og.js                 # Prepara assets OG
3. next build                                 # Build de Next.js → /out
4. node scripts/inject-meta.js                # Inyecta metadata en HTML
5. node scripts/prerender-content.js          # Pre-renderiza contenido SEO
6. node scripts/generate-share-pages.js       # ← NUEVO: Genera páginas share
```

### Flujo de Usuario

#### Compartir desde la app:

1. Usuario hace clic en botón "Compartir"
2. Se copia URL `/share/{type}/{id}/` al portapapeles
3. Usuario pega en red social
4. Crawler social:
   - Hace GET a `/share/{type}/{id}/`
   - Lee metadata OG/Twitter del HTML
   - Genera preview con banner/título/descripción
5. Usuario real (navegador):
   - Hace GET a `/share/{type}/{id}/`
   - JS detecta que no es crawler
   - Redirige a `/{type}s?id={id}` (navegación normal de la app)

#### Detección de Crawlers:

```javascript
// Solo redirigir si es un navegador real (no crawler)
if (!/bot|crawler|spider|crawling/i.test(navigator.userAgent)) {
  window.location.replace(redirectUrl);
}
```

### Metadata Generada

**Campeonato**:

```html
<title>{championship.name}</title>
<meta name="description" content="{description}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="{championship.name}" />
<meta property="og:description" content="{description}" />
<meta property="og:image" content="{banner_or_fallback}" />
<meta
  property="og:url"
  content="https://imsa.trenkit.com/share/championship/{id}/"
/>
<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image" />
...
```

**Evento**:

```html
<title>{event.name}</title>
<meta name="description" content="{description}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="{event.name}" />
<meta property="og:description" content="{description}" />
<meta property="og:image" content="{banner_or_fallback}" />
<meta property="og:url" content="https://imsa.trenkit.com/share/event/{id}/" />
<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image" />
...
```

### Degradación Elegante

El sistema maneja varios escenarios de error:

1. **Firestore no disponible en build**:
   - Script genera solo páginas de fallback
   - Build continúa sin fallar
   - Log: `[generate-share-pages] Firestore no disponible, generando solo páginas de fallback.`

2. **ID no encontrado**:
   - Genera página `/share/{type}/not-found/`
   - Metadata genérica sin datos reales
   - Redirige a lista de entidades

3. **Banner inválido** (data URI, vacío):
   - Usa imagen de fallback (`og-championships.png` o `og-events.png`)
   - No expone data URIs en metadata OG

## Archivos Modificados

### Nuevos Archivos

- `scripts/generate-share-pages.js` - Script de generación de páginas
- `src/app/components/ShareButton.js` - Componente UI de compartir
- `docs/SHARE_SYSTEM.md` - Esta documentación

### Archivos Modificados

- `package.json` - Actualizado build script para incluir generación de share pages
- `src/app/championships/page.js` - Agregado ShareButton en header
- `src/app/events/page.js` - Agregado ShareButton en título

## Criterios de Aceptación

✅ **Share de campeonato con banner válido** → Preview usa ese banner  
✅ **Share de evento con banner válido** → Preview usa ese banner  
✅ **Sin banner o inválido** → Fallback consistente (`og-{type}.png`)  
✅ **URL share inválida** → Metadata de not-found/fallback, sin fuga de datos  
✅ **Navegación actual preservada** → App sigue usando query params, share usa rutas dedicadas  
✅ **UI de compartir** → Botón visible en páginas de detalle  
✅ **Build-time generation** → Páginas pre-generadas en static export  
✅ **Metadata en HTML inicial** → Sin dependencia de DynamicOGTags para crawlers

## Pruebas

### Validar Generación Local

```bash
# Build completo
npm run build

# Verificar estructura generada
ls -la out/share/championship/
ls -la out/share/event/

# Ver metadata de una página
cat out/share/championship/{id}/index.html | grep -A 5 "og:image"
```

### Probar en Crawlers Sociales

**Facebook Sharing Debugger**:
https://developers.facebook.com/tools/debug/

**Twitter Card Validator**:
https://cards-dev.twitter.com/validator

**LinkedIn Post Inspector**:
https://www.linkedin.com/post-inspector/

**WhatsApp** (solo producción):
Enviar URL en chat, WhatsApp hará request y mostrará preview

### Ejemplo de Test

```bash
# 1. Build
npm run build

# 2. Servir build localmente
npx serve out -p 3001

# 3. En otra terminal, simular crawler
curl http://localhost:3001/share/championship/ALGUNA_ID/ | grep "og:image"

# Debe retornar:
# <meta property="og:image" content="https://imsa.trenkit.com/...">
```

## Notas de Implementación

### Por qué rutas `/share/` en lugar de query params

Next.js static export no permite rutas dinámicas tipo `[id]`, pero **sí** permite generar cualquier estructura de carpetas estática en build-time. El script crea la estructura de carpetas directamente:

```
out/share/championship/{id}/index.html
```

Esto es compatible con Firebase Hosting y cualquier host estático.

### Por qué no usar DynamicOGTags

`DynamicOGTags` actualiza metadata **client-side** (después de que React hidrata). Los crawlers sociales:

1. Hacen request HTTP
2. Leen el HTML inicial
3. NO ejecutan JavaScript
4. Generan preview

Por eso necesitamos metadata **bakeada en el HTML inicial** en build-time.

### Diferencia vs. páginas de navegación

| Aspecto   | Páginas normales (`/championships?id=X`)  | Páginas share (`/share/championship/X/`) |
| --------- | ----------------------------------------- | ---------------------------------------- |
| Propósito | Navegación en la app                      | Preview social                           |
| Metadata  | Genérica (inyectada por `inject-meta.js`) | Específica de la entidad                 |
| Contenido | Cargado client-side desde Firestore       | Pre-renderizado en build                 |
| Redirect  | No                                        | Sí (a página normal)                     |

## Mantenimiento

### Agregar nuevo tipo de entidad

1. Crear funciones de generación en `scripts/generate-share-pages.js`:

   ```javascript
   function generateXSharePage(entity) { ... }
   async function loadXs(db) { ... }
   ```

2. Agregar generación en `main()`:

   ```javascript
   const xs = await loadXs(db);
   for (const x of xs) {
     // generar página
   }
   ```

3. Crear fallback OG image: `public/og-xs.png`

4. Agregar ShareButton donde corresponda

### Actualizar campos mostrados

Editar funciones `generate{Type}SharePage()` en el script de generación para ajustar:

- `description` (texto del preview)
- `noscriptContent` (contenido para crawlers)
- Lógica de validación de banner

## Referencias

- **Open Graph Protocol**: https://ogp.me/
- **Twitter Cards**: https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards
- **Next.js Static Export**: https://nextjs.org/docs/app/building-your-application/deploying/static-exports
