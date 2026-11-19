# ActuScout — source officielle et règles de déploiement

## Source de vérité

Le dépôt GitHub `rigobertmumbere2018-art/actuscout`, branche `main`, est la source officielle du projet.

- `src/index.js` : logique du Worker, API, sécurité, routage et transformations de compatibilité.
- `public/` : pages HTML, styles, scripts et ressources statiques canoniques.
- `migrations/` : historique versionné des évolutions D1.
- `wrangler.toml` : références de configuration des ressources Cloudflare.

Le Worker `actuscout` utilise aussi des copies de pages dans le bucket R2 `actuscout-galeries` pour certaines routes :

- `site/index.html` : copie de production de `public/index.html`.
- `site/actualites.html` : copie de production de `public/actualites.html`.
- `site/admin.html` : copie de production de `public/admin.html`.

Ces trois objets R2 sont des miroirs de déploiement, pas des sources indépendantes. Toute modification doit d'abord être enregistrée dans GitHub, puis synchronisée vers l'objet R2 correspondant. Ne jamais modifier uniquement la copie R2 sans reporter le changement dans GitHub.

Le reste du bucket R2 est réservé aux médias publiés, aux documents et aux sauvegardes.

## Règles de préservation

1. Ne jamais supprimer un article, un album, une image, un commentaire ou une donnée financière lors d'une réorganisation.
2. Toute migration d'image suit le cycle : copie dans R2, vérification du fichier et de son type, vérification de l'URL publique, puis seulement remplacement de la référence en base.
3. Ne jamais supprimer l'ancienne image Blogger après migration.
4. Avant toute modification D1, effectuer une sauvegarde vérifiable.
5. Avant un déploiement Worker, conserver le binding `ASSETS`, D1 `DB`, R2 `GALLERY` et tous les secrets existants.
6. Avant de remplacer un miroir R2, sauvegarder sa version précédente.
7. Après déploiement, vérifier le numéro de version, le déploiement actif, les bindings, les objets R2 et les routes HTTP lorsqu'elles sont accessibles.
8. Une réponse HTTP 403 depuis un environnement de contrôle externe ne doit pas être interprétée comme une panne confirmée du site.

## État de la synchronisation — 19 novembre 2026

- `public/index.html` est synchronisé avec `site/index.html`.
- `public/actualites.html` est synchronisé avec `site/actualites.html`.
- `public/admin.html` est synchronisé avec `site/admin.html`.
- Le Worker `actuscout` est déployé en version 296.
- Les bindings D1, R2, ASSETS et les secrets existants ont été conservés.
- Les anciennes copies R2 de l'accueil et de l'administration sont archivées dans `backups/`.
- Une sauvegarde logique de la base D1 est conservée dans `backups/actuscout-d1-logical-snapshot-2026-11-19.json`.

## Procédure de mise à jour

1. Modifier et valider les fichiers dans le dépôt GitHub `main`.
2. Sauvegarder la copie R2 qui sera remplacée.
3. Synchroniser les pages modifiées dans `site/` sans toucher aux autres objets.
4. Si le routage ou le code Worker change, créer une nouvelle version en conservant les assets, les bindings et les secrets.
5. Vérifier la version déployée, les bindings, les pages R2 et les routes disponibles.
6. Conserver l'ancienne version du Worker et les sauvegardes R2 pour permettre un retour arrière.

Ne pas recréer le Worker, la base D1 ou le bucket R2.
