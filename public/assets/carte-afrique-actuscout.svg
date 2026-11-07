# ActuScout — projet Cloudflare Worker

Ce dépôt contient le Worker Cloudflare, les pages publiques et d'administration, ainsi que les migrations D1 et la configuration R2/Google Photos Picker.

## Structure

- `src/index.js` : Worker Cloudflare
- `public/` : interface publique et administration
- `migrations/` : migrations de la base D1
- `wrangler.toml` : configuration Cloudflare
- `DEPLOIEMENT_FR.txt` : procédure de déploiement
- `GOOGLE_PHOTOS_CONFIGURATION_FR.txt` : configuration Google Photos Picker

## Avant le déploiement

1. Installer les dépendances avec `npm install`.
2. Vérifier `wrangler.toml` et les identifiants des ressources Cloudflare.
3. Configurer les secrets du Worker depuis Cloudflare ou Wrangler. Ne jamais committer les secrets, mots de passe ou fichiers `.dev.vars`.
4. Appliquer les migrations D1 selon les instructions de `DEPLOIEMENT_FR.txt`.
5. Configurer Google Photos Picker selon `GOOGLE_PHOTOS_CONFIGURATION_FR.txt`.

Le dépôt ne contient volontairement aucun identifiant OAuth secret, mot de passe d'administration ou clé de chiffrement.
