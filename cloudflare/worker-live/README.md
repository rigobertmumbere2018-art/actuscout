# Snapshot du Worker ActuScout actif

- Date de capture : 2026-11-09
- Déploiement actif lors de la capture : `cef7f339-31ea-492d-b46a-7e54c8a807e5`
- Version active à 100 % : `41b4761c-dcac-4dab-8ebf-263948e8f3a9`
- Date de compatibilité : `2026-11-04`
- Source de vérité : script réellement déployé sur Cloudflare Worker `actuscout`.
- Fichier capturé : `index.js` (bundle compilé récupéré depuis l'API Cloudflare).
- Ce snapshot est une sauvegarde fidèle du code actif, pas une reconstruction depuis `src/index.js`.

## Liaisons Cloudflare constatées

| Nom | Type | Ressource |
|---|---|---|
| ADMIN_PASSWORD | secret_text | Secret existant, valeur non exportée |
| ADMIN_USERNAME | secret_text | Secret existant, valeur non exportée |
| ASSETS | assets | Ressources statiques existantes, non exportées dans ce snapshot |
| DB | D1 | `43dd1d11-9b86-4166-b371-8ca0b8657d7a` |
| GALLERY | R2 | `actuscout-galeries` |
| GOOGLE_CLIENT_ID | secret_text | Secret existant, valeur non exportée |
| R2_PUBLIC_BASE | secret_text | Secret existant, valeur non exportée |
| SESSION_SECRET | secret_text | Secret existant, valeur non exportée |

## Variables utilisées à inventorier avant tout déploiement

Le code actif utilise également les variables/secrets suivants selon les routes :
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `ACTUSCOUT_EMAIL_FROM`
- `CONTACT_EMAIL_TO`

Les variables réellement référencées dans le bundle actif sont : `ACTUSCOUT_EMAIL_FROM`, `ADMIN_PASSWORD`, `ADMIN_USERNAME`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, `R2_PUBLIC_BASE`, `RESEND_API_KEY` et `SESSION_SECRET`. `DB`, `GALLERY` et `ASSETS` sont des bindings, pas des variables secrètes. `CONTACT_EMAIL_TO` n'est pas référencée dans le bundle actif capturé et ne doit donc pas être présentée comme une dépendance vérifiée. Les valeurs secrètes ne sont jamais exportées ni commitées. Vérifier leur présence dans les paramètres Cloudflare avant un déploiement.

## Procédure de déploiement sûre — non exécutée

1. Comparer ce bundle avec le code source du dépôt et réintégrer proprement les changements spécifiques au Worker dans le code maintenable.
2. Récupérer et versionner les ressources statiques correspondant exactement à la liaison `ASSETS`; ce snapshot ne les contient pas.
3. Vérifier les migrations D1 et les schémas utilisés sans modifier les données de production.
4. Reconstituer la configuration Wrangler avec les mêmes noms de bindings, la même date de compatibilité (`2026-11-04`) et les paramètres de routage existants.
5. Vérifier la présence des secrets dans Cloudflare sans exporter leurs valeurs.
6. Faire un contrôle de diff, des tests statiques et des tests de non-régression.
7. Déployer d'abord une version de préproduction ou une version sans trafic, puis vérifier les routes publiques, l'administration, les articles, les albums, les uploads, les interactions et la page de maintenance.
8. Ne basculer le trafic qu'après validation explicite.

**Interdiction de déployer directement ce snapshot avec un Wrangler incomplet :** cela pourrait perdre la liaison ASSETS, les secrets, ou la configuration de production. Ne pas exécuter `wrangler deploy` avant d'avoir terminé les étapes ci-dessus.

## Fonctionnalités repérées dans le bundle actif

Le bundle contient notamment les routes d'administration et de gestion des articles, albums et médias, l'authentification des blogueurs, l'intégration Google Photos/Drive, l'envoi d'e-mails, les interactions vues/j'aime/partage sur les articles, ainsi que la page de maintenance HTML.
