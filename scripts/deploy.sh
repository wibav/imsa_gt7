#!/bin/bash

echo "🚀 Iniciando proceso de deploy a Firebase Hosting..."

# Verificar que Firebase CLI esté instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI no está instalado. Instálalo con: npm install -g firebase-tools"
    exit 1
fi

# Verificar que estamos logueados en Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ No estás logueado en Firebase. Ejecuta: firebase login"
    exit 1
fi

# Construir el proyecto con variables de entorno de producción
echo "🔨 Construyendo el proyecto..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build completado exitosamente"
    
    # Deploy a Firebase Hosting
    echo "📤 Desplegando a Firebase Hosting..."
    firebase deploy --only hosting
    
    if [ $? -eq 0 ]; then
        echo "🎉 Deploy completado exitosamente!"
        echo "🌐 Tu sitio está disponible en: https://imsa-bd5b6.web.app"
    else
        echo "❌ Error durante el deploy"
        exit 1
    fi
else
    echo "❌ Error durante el build"
    exit 1
fi
