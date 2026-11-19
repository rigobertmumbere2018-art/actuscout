# ActuScout — source officielle et règles de déploiement

## Source de vérité

Le dépôt GitHub `rigobertmumbere2018-art/actuscout`, branche `main`, est la source officielle du projet.

- `src/index.js` : logique du Worker, API, sécurité, routage et transformations de compatibilité.
- `public/` : pages HTML, styles, scripts et ressources statiques à déployer avec le Worker.
- `migrations/` : historique versionné des évolutions D1.
- `wrangler.toml` : références de configuration des ressources Cloudflare.

Le Worker de production sert les pages depuis le binding Cloudflare `ASSETS`. Les objets `site/index.html` et `site/admin.html` présents dans R2 sont des copies historiques et ne doivent plus être modifiés comme source principale. Le bucket R2 `actuscout-galeries` est réservé aux médias publiés, aux documents et aux sauvegardes.

## Règles de préservation

1. Ne jamais supprimer un article, un album, une image, un commentaire ou une donnée financière lors d'une réorganisation.
2. Toute migration d'image suit le cycle : copie dans R2, vérification du fichier et de son type, vérification de l'URL publique, puis seulement remplacement de la référence en base.
3. Ne jamais supprimer l'ancienne image Blogger après migration.
4. Avant toute modification D1, effectuer une sauvegarde vérifiable.
5. Avant un déploiement Worker, conserver le binding `ASSETS`, D1 `DB`, R2 `GALLERY` et tous les secrets existants.
6. Après déploiement, vérifier le numéro de version, le déploiement actif, les bindings et les routes HTTP disponibles.

## État de la synchronisation

Le Worker peut appliquer des transformations de compatibilité sur certaines pages lorsque le bundle statique n'a pas encore été remplacé. Dès qu'une version statique complète est déployée depuis `public/`, ces transformations doivent rester idempotentes et ne pas dupliquer les sections déjà présentes.

## Procédure

Les mises à jour de code se font dans ce dépôt, puis sont déployées sur le Worker `actuscout` en conservant ses ressources existantes. Ne pas recréer le Worker, la base D1 ou le bucket R2.
