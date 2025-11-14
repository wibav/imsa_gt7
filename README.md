# IMSA GT7 - Next.js Racing Championship Platform

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## 🚀 Firebase Hosting Static Export Architecture

**IMPORTANTE**: Este proyecto está configurado para **Firebase Hosting con exportación estática**. Esto significa que **NO se deben usar rutas dinámicas** (`[id]`).

### ✅ Arquitectura Correcta (Query Parameters)

```javascript
// ✅ CORRECTO - Usa query parameters
// Archivo: src/app/championships/page.js
const searchParams = useSearchParams();
const championshipId = searchParams.get("id");

// URL: /championships?id=ABC123
```

### ❌ Arquitectura Incorrecta (Rutas Dinámicas)

```javascript
// ❌ INCORRECTO - NO usar carpetas [id]
// Archivo: src/app/championships/[id]/page.js
const params = useParams();
const championshipId = params.id;

// URL: /championships/ABC123
// Requiere pre-generar todas las rutas en build time
```

### 📋 Reglas para Nuevas Funcionalidades

Cuando agregues nuevas páginas que requieran IDs dinámicos:

1. **NO crear carpetas** con corchetes `[id]`
2. **USAR query parameters**: `/ruta?id=valor`
3. **USAR `useSearchParams()`** en lugar de `useParams()`
4. **Enlaces con query params**: `router.push('/ruta?id=123')`

### 🔧 Configuración

- **next.config.mjs**: `output: 'export'` habilitado
- **Firebase Hosting**: Sirve archivos estáticos desde `/out`
- **Datos dinámicos**: Se cargan desde Firebase Firestore en el cliente

### 🎯 Beneficios

- ✅ Sin limitaciones de IDs pre-generados
- ✅ Nuevos datos disponibles inmediatamente sin rebuild
- ✅ Build más rápido y simple
- ✅ Compatible con Firebase Hosting gratuito

## Google AdSense Integration

This project includes Google AdSense integration for monetization. The implementation includes:

- **Global AdSense Script**: Loaded via Next.js Script component in `layout.js`
- **Ad Components**: Reusable components for different ad formats in `src/app/components/ads/`
- **Strategic Placement**: Ads placed in the dashboard with responsive design

### Configuring Ad Slots

To configure your AdSense ad slots, update the following files:

1. **Banner Ad** (`src/app/components/ads/AdComponents.js`):

   ```javascript
   export function BannerAd({ className = "" }) {
     return (
       <AdSense
         adSlot="YOUR_BANNER_SLOT_ID" // Replace with your actual slot ID
         adFormat="horizontal"
         className={`banner-ad ${className}`}
         style={{ minHeight: "90px" }}
       />
     );
   }
   ```

2. **Rectangle Ad** (`src/app/components/ads/AdComponents.js`):
   ```javascript
   export function RectangleAd({ className = "" }) {
     return (
       <AdSense
         adSlot="YOUR_RECTANGLE_SLOT_ID" // Replace with your actual slot ID
         adFormat="rectangle"
         className={`rectangle-ad ${className}`}
         style={{ minHeight: "250px", minWidth: "300px" }}
       />
     );
   }
   ```

### AdSense Publisher ID

The publisher ID is configured in:

- `src/app/components/ads/AdSense.js` (data-ad-client attribute)
- `src/app/components/ads/AdSense.js` (AdSenseScript component)

Make sure to replace `ca-pub-3229768467294527` with your actual AdSense publisher ID.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
