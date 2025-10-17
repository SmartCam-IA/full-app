
# SmartCam-ImagesAnalysis

Plateforme intelligente de vidéosurveillance pour l’analyse en temps réel des flux de caméras grâce à l’IA.

## 🎯 Présentation

SmartCam-ImagesAnalysis est un système complet de vidéosurveillance basé sur Node.js qui :
- Se connecte aux flux RTSP des caméras
- Effectue la détection de mouvement en temps réel
- Analyse les images via des modèles IA (Hugging Face)
- Détecte la violence, le feu et les urgences médicales
- Stocke les résultats dans MariaDB
- Fournit une API REST pour la gestion et le monitoring
- **Inclut une interface web (Express + Nunjucks) pour une gestion facile**

## 📋 Fonctionnalités

### Traitement vidéo
- **Connexion RTSP** : Connexion aux caméras via le protocole RTSP
- **Détection de mouvement** : Analyse uniquement les images où un mouvement est détecté
- **Extraction d’images** : Intervalle configurable par type d’analyse
- **Identifiants chiffrés** : Stockage sécurisé des mots de passe caméras (AES-256)

### Modules d’analyse
- **Détection de violence** : Identifie les comportements violents (Police)
- **Détection d’incendie** : Détecte feu et fumée (Pompiers)
- **Urgence médicale** : Détecte les situations médicales critiques (Ambulance)
- **Architecture extensible** : Ajout facile de nouveaux modules

## 🚀 Installation

### Prérequis
- Node.js (v16 ou supérieur)
- MariaDB (v10.5 ou supérieur)
- FFmpeg (pour le traitement vidéo)

### Installation

1. **Cloner le dépôt**
```bash
git clone https://github.com/SmartCam-IA/SmartCam-ImagesAnalysis.git
cd SmartCam-ImagesAnalysis
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer l’environnement**
```bash
cp .env.example .env
# Modifier .env selon votre configuration
```

4. **Initialiser la base de données**

**Option A : Automatique (recommandé)**
La base et les tables sont créées automatiquement au premier lancement si l’utilisateur a les droits nécessaires.

**Option B : Manuel**
```bash
# Créer la base
mysql -u root -p -e "CREATE DATABASE smartcam_db;"

# Importer le schéma (optionnel)
mysql -u root -p smartcam_db < database/schema.sql
```

5. **Générer une clé de chiffrement**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copier la valeur dans ENCRYPTION_KEY du .env
```

## 🔧 Configuration

**Important :** Les tables sont créées automatiquement au premier démarrage si elles n’existent pas.

Modifier le fichier `.env` :

```env
# Serveur
PORT=3000
NODE_ENV=development

# Base de données
DB_HOST=localhost
DB_PORT=3306
DB_USER=smartcam
DB_PASSWORD=motdepasse
DB_NAME=smartcam_db

# Chiffrement (clé hexadécimale 32 octets)
ENCRYPTION_KEY=clé_hexadécimale_64_caractères

# Stockage
STORAGE_PATH=./storage/images
STORAGE_TYPE=local

# API Hugging Face
HUGGINGFACE_API_KEY=ma_cle_api

# Caméras
MOTION_DETECTION_THRESHOLD=30
CAMERA_RECONNECT_INTERVAL=30000
CAMERA_TIMEOUT=60000
```

## 📊 Schéma de la base de données

### Tables principales

- **camera** : Informations caméras (identifiants chiffrés)
- **position** : Localisation géographique des caméras
- **analyse** : Types d’analyse (violence, feu, médical)
- **image** : Images capturées (horodatage, caméra)
- **resultat_analyse** : Résultats d’analyse (score, gravité, vérification humaine, rejet)

## 🔌 API REST

### Caméras

```
GET    /api/cameras              # Lister les caméras
GET    /api/cameras/:id          # Détail caméra
POST   /api/cameras              # Créer une caméra
PUT    /api/cameras/:id          # Modifier une caméra
DELETE /api/cameras/:id          # Supprimer une caméra
POST   /api/cameras/:id/start    # Démarrer la surveillance
POST   /api/cameras/:id/stop     # Arrêter la surveillance
GET    /api/cameras/stats        # Statistiques
```

### Analyses

```
GET    /api/analyses             # Lister les analyses
GET    /api/analyses/:id         # Détail analyse
POST   /api/analyses             # Créer une analyse
PUT    /api/analyses/:id         # Modifier une analyse
DELETE /api/analyses/:id         # Supprimer une analyse
```

### Résultats / Alertes

```
GET    /api/results              # Lister les résultats
GET    /api/results/:id          # Détail résultat
GET    /api/results/stats        # Statistiques alertes
PUT    /api/results/:id/verify   # Vérification humaine (accepter/rejeter)
PUT    /api/results/:id/resolve  # Marquer comme résolu
```

## 🎮 Utilisation

### Interface web

Accéder à l’interface sur `http://localhost:3000` après démarrage.

Fonctionnalités principales :
- **Tableau de bord** (`/`) : Statut caméras, alertes récentes
- **Caméras** (`/cameras`) : Gestion (ajout, édition, suppression, démarrage, arrêt)
- **Détail caméra** (`/cameras/:id`) : Détail, alertes/images récentes
- **Alertes** (`/alerts`) : Liste et gestion des alertes (par gravité)
- **Détail alerte** (`/alerts/:id`) : Détail complet, vérification humaine, résolution
- **Validation** (`/validation`) : Interface de validation humaine (accepter/rejeter)
- **Analyses** (`/analyses`) : Configuration des modules d’analyse
- **Carte** (`/map`) : Carte interactive des caméras
- **Détail image** (`/images/:id`) : Image et résultats associés

### Démarrer le serveur

```bash
# Mode développement (auto-reload)
   mysql -u root -p

# Mode production
npm start
```

Ouvrir le navigateur sur `http://localhost:3000`

### Utilisation de l’API (exemples)

#### Ajouter une caméra

```bash
curl -X POST http://localhost:3000/api/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.100",
    "username": "admin",
    "password": "password123",
    "model": "Hikvision DS-2CD2142FWD-I",
    "fk_position": 1
  }'
```

#### Démarrer la surveillance d’une caméra

```bash
curl -X POST http://localhost:3000/api/cameras/1/start
```

#### Récupérer les alertes récentes

```bash
curl http://localhost:3000/api/results?is_resolved=false&limit=10
```

## 🔒 Sécurité

- **Identifiants chiffrés** : Mots de passe caméras chiffrés AES-256
- **Helmet.js** : Protection des headers HTTP
- **CORS** : Cross-origin paramétrable
- **Validation des entrées** : Toutes les entrées API sont validées
- **Base de données sécurisée** : Requêtes paramétrées (anti-injection)

## 🛠️ Développement

### Ajouter un module d’analyse

1. Créer un fichier dans `src/analysis/` :

```javascript
// src/analysis/monAnalyse.js
const axios = require('axios');
const config = require('../config');

class MonAnalyse {
  constructor() {
    this.name = 'Mon Analyse Personnalisée';
    this.type = 'Police'; // ou 'Pompier', 'Ambulance'
    this.endpoint = 'https://api-inference.huggingface.co/models/mon-modele';
  }

  async analyze(imageBuffer) {
    // Logique d’analyse
  }
}

module.exports = new MonAnalyse();
```

2. Ajouter dans la base :

```sql
INSERT INTO analyse (name, type_analyse, nbr_positive_necessary, api_endpoint)
VALUES ('Mon Analyse Personnalisée', 'Police', 2, 'https://api-inference.huggingface.co/models/mon-modele');
```

## 📈 Monitoring

- **Health Check** : `GET /health`
- **Statistiques caméras** : `GET /api/cameras/stats`
- **Statistiques alertes** : `GET /api/results/stats`

## 🧪 Tests

```bash
npm test
```

## 🐛 Dépannage

### Problèmes de connexion BDD

**Erreur : "Table 'xxx.camera' doesn't exist"**

Cette erreur survient si l’initialisation de la base a échoué. Causes fréquentes :

1. **Droits insuffisants**
   ```bash
   # Donner les droits nécessaires à l’utilisateur
   mysql -u root -p
   GRANT ALL PRIVILEGES ON *.* TO 'utilisateur'@'localhost';
   FLUSH PRIVILEGES;
   ```

2. **Nom de base incorrect**
   - Vérifier le `.env` (DB_NAME)
   - La base sera créée automatiquement si l’utilisateur a les droits

3. **MariaDB/MySQL non démarré**
   ```bash
   # Vérifier le statut
   sudo systemctl status mariadb
   # Ou pour MySQL
   sudo systemctl status mysql
   ```

**Erreur : "Database connection failed"**
- Vérifier que MariaDB/MySQL tourne
- Vérifier les identifiants dans `.env`
- Vérifier que le port 3306 n’est pas bloqué
- Tester la connexion : `mysql -h localhost -u utilisateur -p`

### Port déjà utilisé

**Erreur : "Port 3000 already in use"**
- Modifier `PORT=3001` dans `.env`
- Ou stopper le processus sur 3000 :
  ```bash
  # Trouver le process
  lsof -ti:3000
  # Tuer le process
  kill $(lsof -ti:3000)
  ```

### FFmpeg non trouvé

**Erreur : "FFmpeg not found"**
- Installer FFmpeg :
  ```bash
  # Ubuntu/Debian
  sudo apt-get install ffmpeg
  
  # macOS
  brew install ffmpeg
  
  # Windows
  # Télécharger depuis https://ffmpeg.org/download.html
  ```

## 📝 Licence

MIT

## 👥 Contributeurs

SmartCam-IA Team

## 🙏 Remerciements

- Hugging Face pour les modèles IA
- FFmpeg pour le traitement vidéo
- MariaDB pour la gestion de base de données
   GRANT ALL PRIVILEGES ON *.* TO 'your_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

2. **Incorrect database name**
   - Check your `.env` file and ensure `DB_NAME` matches your setup
   - The database will be created automatically if the user has privileges

3. **MariaDB/MySQL not running**
   ```bash
   # Check if MariaDB is running
   sudo systemctl status mariadb
   # Or for MySQL
   sudo systemctl status mysql
   ```

**Error: "Database connection failed"**
- Verify MariaDB/MySQL is running
- Check credentials in `.env` file
- Ensure port 3306 is not blocked by firewall
- Test connection: `mysql -h localhost -u your_user -p`

### Port Already in Use

**Error: "Port 3000 already in use"**
- Change `PORT=3001` in `.env` file
- Or stop the process using port 3000:
  ```bash
  # Find process
  lsof -ti:3000
  # Kill process
  kill $(lsof -ti:3000)
  ```

### FFmpeg Not Found

**Error: "FFmpeg not found"**
- Install FFmpeg:
  ```bash
  # Ubuntu/Debian
  sudo apt-get install ffmpeg
  
  # macOS
  brew install ffmpeg
  
  # Windows
  # Download from https://ffmpeg.org/download.html
  ```

## 👥 Contributors

SmartCam-IA Team

## 🙏 Acknowledgments

- Hugging Face for AI models
- FFmpeg for video processing
- MariaDB for database management