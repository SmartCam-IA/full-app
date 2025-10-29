# RTSP Sender (Node.js + Docker)

Petit serveur piloté par une interface web pour diffuser un flux RTSP à 30 fps d'une image choisie dans le dossier `images/`.

- Web UI: liste les images et permet d'en choisir une
- RTSP: diffuse l'image sélectionnée 30 fois/seconde (H.264, faible latence)

## Pré-requis

- Docker Desktop (recommandé) ou Node.js + FFmpeg si vous lancez en local
- Placez vos images dans le dossier `images/` (extensions autorisées: `.jpg`, `.jpeg`, `.png`, `.bmp`, `.gif`)

## Démarrage avec Docker

```powershell
# Depuis le dossier du projet
docker compose up --build
```

- UI: <http://localhost:3333>
- RTSP: rtsp://root:root@localhost:8554/stream

Montez vos images automatiquement via le volume `./images:/app/images:ro` (déjà configuré dans `docker-compose.yml`).

## Utilisation

1. Ouvrez l'UI (<http://localhost:3333>). Les images du dossier `images/` s'affichent.
2. Cliquez sur une image pour que le serveur change la source du flux RTSP.
3. Dans votre lecteur/outil (VLC, ffplay, application), utilisez l'URL `rtsp://root:root@localhost:8554/stream` (username: root, password: root).

Changer d'image redémarre très brièvement le processus ffmpeg (le flux sera rétabli quasi immédiatement).

## Lancer en local (sans Docker)

Vous devez disposer de FFmpeg installé sur votre système (disponible dans le PATH) et Node.js.

```powershell
npm install
npm start
```

- UI: <http://localhost:3333>
- RTSP: rtsp://root:root@localhost:8554/stream

## Notes techniques

- Le serveur Node.js alimente en continu un processus `ffmpeg` unique via un flux MJPEG (stdin), encodé en H.264.
- Chaque image est redimensionnée à 1280x720 (par défaut) et envoyée 30 fois/s; le changement d'image est transparent (sans redémarrage ffmpeg).

## Dépannage

- Aucune image n'apparaît dans l'UI: vérifiez que des images sont présentes dans le dossier `images/` et qu'elles ont une extension autorisée.
- Le flux ne démarre pas: vérifiez que le port 8554 n'est pas occupé par un autre service.
- FFmpeg introuvable (en local): installez FFmpeg et redémarrez le serveur. Avec Docker, FFmpeg est déjà installé dans l'image.
