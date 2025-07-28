#!/bin/bash

# Script para configurar variables de entorno en Firebase Hosting
# Ejecuta este script antes de hacer deploy

echo "🔧 Configurando variables de entorno en Firebase..."

# Configurar las variables de entorno en Firebase Functions (si las usas)
firebase functions:config:set \
  firebase.api_key="AIzaSyAkwr4sH48c2syY_BAfjWaaOTHl4nhqVmo" \
  firebase.auth_domain="imsa.trenit.com" \
  firebase.project_id="imsa-bd5b6" \
  firebase.storage_bucket="imsa-bd5b6.firebasestorage.app" \
  firebase.messaging_sender_id="144914068113" \
  firebase.app_id="1:144914068113:web:f45004e5cba1d614204530" \
  firebase.measurement_id="G-K4DPRDLWLK"

echo "✅ Variables de entorno configuradas"
echo "💡 Ahora puedes ejecutar: firebase deploy"
