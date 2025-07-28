# 🔐 Configuración de Variables de Entorno para Firebase Hosting

## Configuración Inicial

### 1. Variables de Entorno Locales

Las variables de entorno están configuradas en:

- `.env.local` (para desarrollo)
- `.env.production` (para producción)

**⚠️ IMPORTANTE:** Estos archivos están en `.gitignore` y NO se suben al repositorio.

### 2. Configuración de Firebase

Para desplegar con variables de entorno seguras:

```bash
# 1. Instalar Firebase CLI (si no está instalado)
npm install -g firebase-tools

# 2. Iniciar sesión en Firebase
firebase login

# 3. Seleccionar el proyecto correcto
firebase use imsa-bd5b6

# 4. Deploy usando el script personalizado
npm run deploy
```

### 3. Scripts Disponibles

```bash
# Deploy completo (build + deploy)
npm run deploy

# Solo build
npm run build

# Desarrollo local
npm run dev
```

### 4. Variables de Entorno Configuradas

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

### 5. Seguridad

✅ Los datos sensibles están en variables de entorno
✅ Los archivos `.env.*` están en `.gitignore`
✅ Solo se exponen variables con `NEXT_PUBLIC_` prefix
✅ El repositorio no contiene datos sensibles

### 6. Troubleshooting

Si hay problemas con el deploy:

1. Verificar que estás logueado: `firebase login`
2. Verificar el proyecto: `firebase projects:list`
3. Verificar configuración: `firebase hosting:channel:list`

### 7. URLs del Proyecto

- **Desarrollo:** http://localhost:3000
- **Producción:** https://imsa-bd5b6.web.app
- **Custom Domain:** https://imsa.trenkit.com (si está configurado)
