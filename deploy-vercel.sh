#!/bin/bash

# Script de déploiement rapide sur Vercel
echo "🚀 Déploiement BitChat Web sur Vercel..."

# Vérifier si vercel CLI est installé
if ! command -v vercel &> /dev/null; then
    echo "📦 Installation de Vercel CLI..."
    npm install -g vercel
fi

echo "🔄 Déploiement en cours..."
vercel --prod

echo "✅ BitChat Web déployé avec succès !"
echo "🌐 Votre app est maintenant accessible publiquement"
echo "📱 Testez sur plusieurs appareils pour voir la magie du P2P !"
