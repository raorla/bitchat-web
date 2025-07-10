# BitChat PWA - Déploiement Vercel

## Résumé

BitChat est une Progressive Web App (PWA) de messagerie P2P décentralisée qui simule un réseau mesh Bluetooth via WebRTC dans le navigateur.

## Déploiement sur Vercel

### Option 1: Déployer seulement le dossier web-app

```bash
# Naviguez dans le dossier web-app
cd web-app

# Initialisez un nouveau repo git si nécessaire
git init
git add .
git commit -m "Initial BitChat PWA"

# Connectez à GitHub et déployez sur Vercel
vercel --prod
```

### Option 2: Déployer depuis ce repo

Si vous déployez depuis le repo parent, Vercel détectera automatiquement le dossier `web-app` grâce au `vercel.json`.

## Fonctionnalités après déploiement

✅ **Communication multi-onglets** : Les messages apparaissent instantanément dans tous les onglets ouverts
✅ **WebRTC P2P** : Communication directe entre différents appareils/navigateurs  
✅ **Fallback intelligent** : Si WebRTC échoue, simulation locale de pairs
✅ **PWA complète** : Installation, mode hors ligne, notifications
✅ **Chiffrement E2E** : Messages chiffrés avec Web Crypto API

## Test du déploiement

1. **Test multi-onglets** : Ouvrez plusieurs onglets, écrivez dans l'un → apparaît dans tous
2. **Test multi-appareils** : Partagez l'URL, testez la communication P2P
3. **Test PWA** : Installez l'app via le navigateur

## Configuration automatique

- ✅ Service Worker pour mode hors ligne
- ✅ Manifest.json pour l'installation PWA
- ✅ Serveur WebSocket pour signaling WebRTC
- ✅ HTTPS automatique via Vercel
- ✅ Compression et cache optimisés

## URLs importantes après déploiement

- `/` : Application principale
- `/debug.html` : Console de debug et tests
- `/signaling` : Endpoint WebSocket pour WebRTC

## Dépendances

Toutes les dépendances sont incluses dans `package.json`. Aucun autre fichier du repo parent n'est nécessaire.
