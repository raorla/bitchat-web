# BitChat Web App

Cette version web de BitChat est une Progressive Web App (PWA) qui reproduit les fonctionnalités de l'application native en utilisant les technologies web modernes.

## Fonctionnalités

- **Interface utilisateur** : Interface terminal vert sur noir, fidèle à l'original
- **Messagerie P2P** : Simulation de réseau mesh via WebRTC
- **Chiffrement** : Chiffrement end-to-end avec Web Crypto API
- **Canaux** : Système de canaux avec mots de passe
- **Commandes IRC** : Toutes les commandes de l'original (/join, /msg, etc.)
- **PWA** : Installation sur bureau et mobile
- **Mode hors ligne** : Fonctionne sans connexion internet

## Limitations

- **Bluetooth Web** : L'API Web Bluetooth ne permet pas les réseaux mesh complets
- **WebRTC** : Utilisé comme alternative pour les connexions P2P
- **Signaling** : Nécessite un serveur de signaling pour découverte initiale
- **Portée** : Limitée par WebRTC vs Bluetooth natif

## Structure

```
web-app/
├── index.html          # Page principale
├── manifest.json       # Manifeste PWA
├── sw.js              # Service Worker
├── styles/
│   └── main.css       # Styles CSS
├── js/
│   ├── crypto.js      # Service cryptographique
│   ├── bluetooth-service.js  # Service Bluetooth/WebRTC
│   ├── chat-service.js       # Logique de chat
│   ├── ui.js          # Contrôleur UI
│   └── app.js         # Point d'entrée
└── icons/             # Icônes PWA
```

## Technologies utilisées

- **HTML5** : Structure de base
- **CSS3** : Interface utilisateur responsive
- **JavaScript ES6+** : Logique applicative
- **Web Crypto API** : Chiffrement
- **WebRTC** : Communication P2P
- **Service Worker** : Fonctionnalités PWA
- **IndexedDB** : Stockage local
- **Web Notifications** : Notifications push

## Installation

1. Servir les fichiers via un serveur HTTP
2. Ouvrir dans un navigateur moderne
3. Installer comme PWA via le menu du navigateur

## Sécurité

- Chiffrement AES-256-GCM
- Échange de clés via ECDH P-256
- Dérivation de clés PBKDF2
- Pas de stockage des clés privées

## Commandes

- `/help` - Aide
- `/join #canal` - Rejoindre un canal
- `/msg @user message` - Message privé
- `/who` - Lister les utilisateurs
- `/clear` - Effacer le chat
- `/nick nouveau_nom` - Changer de pseudo

## Développement

Pour tester localement :

```bash
# Serveur Python simple
python -m http.server 8000

# Ou avec Node.js
npx serve .

# Puis ouvrir http://localhost:8000
```
