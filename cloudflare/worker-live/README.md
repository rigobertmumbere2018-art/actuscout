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

## Variables réellement référencées par le code

Le bundle lit les noms suivants : `ACTUSCOUT_EMAIL_FROM`, `ADMIN_PASSWORD`, `ADMIN_USERNAME`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, `R2_PUBLIC_BASE`, `RESEND_API_KEY` et `SESSION_SECRET`.

Les réglages Cloudflare exposent actuellement les secrets `ADMIN_PASSWORD`, `ADMIN_USERNAME`, `GOOGLE_CLIENT_ID`, `R2_PUBLIC_BASE`, `SESSION_SECRET`, ainsi que les bindings `ASSETS`, `DB`, `GALLERY`. La présence et la configuration de `ACTUSCOUT_EMAIL_FROM`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY` et `RESEND_API_KEY` ne sont pas confirmées par la liste des bindings consultée. Il faut les vérifier dans l'environnement avant de conclure à la parité fonctionnelle. Aucune valeur secrète n'a été consultée ni modifiée.

## Écart constaté entre les migrations Git et D1 de production

Un relevé en lecture seule de `sqlite_master` a été effectué le 9 novembre 2026. Le schéma observé en production est sauvegardé dans `D1_SCHEMA_PRODUCTION.sql`. Ce fichier est un relevé documentaire : **ne pas l'exécuter**.

Écarts confirmés par comparaison avec les migrations versionnées :
- La production contient les tables `article_views` et `article_likes`, absentes des migrations Git actuelles.
- La production contient `articles.is_magazine` et les index `idx_articles_magazine_status`, absents des migrations Git actuelles.
- La production contient les index `idx_bloggers_email`, `idx_blogger_apps_email` et `idx_articles_blogger`, non représentés dans les migrations actuelles.
- Les définitions de `album_photos`, `google_oauth_tokens` et `google_picker_sessions` diffèrent des définitions versionnées (colonnes, nullabilité, clés étrangères et index).

Aucune migration n'a été exécutée et aucune donnée n'a été modifiée. Avant d'établir un historique de migrations fiable, il faut préparer une migration additive et idempotente adaptée au schéma constaté, puis la valider sur une copie/staging. Ne jamais rejouer les migrations historiques sur les données de production sans vérifier leur état d'application.

## Ressources statiques ASSETS

Le dépôt `main` contient le dossier `public/` (pages HTML, CSS, JS, SVG, robots.txt et sitemap.xml), mais le réglage Cloudflare confirme uniquement le binding `ASSETS`, sans fournir le manifeste ni le contenu de l'ensemble déployé. La correspondance exacte entre le contenu statique du Worker actif et `public/` n'est donc pas encore certifiée. Cette étape doit être résolue avant un déploiement Wrangler.

## Procédure de déploiement sûre — non exécutée

1. Comparer le bundle avec le code source du dépôt et réintégrer proprement les changements spécifiques au Worker dans le code maintenable.
2. Récupérer et versionner les ressources statiques correspondant exactement à la liaison `ASSETS`.
3. Réconcilier les migrations avec le schéma D1 réellement observé, sans réexécuter les migrations historiques sur les données de production.
4. Reconstituer la configuration Wrangler avec les mêmes noms de bindings, la date de compatibilité `2026-11-04` et les paramètres de routage existants.
5. Vérifier la présence des secrets dans Cloudflare sans exporter leurs valeurs.
6. Faire un contrôle de diff, des tests statiques et des tests de non-régression.
7. Déployer d'abord une version de préproduction ou une version sans trafic, puis vérifier les routes publiques, l'administration, les articles, les albums, les uploads, les interactions et la page de maintenance.
8. Ne basculer le trafic qu'après validation explicite.

**Ne pas exécuter `wrangler deploy` avant d'avoir terminé ces étapes.** Un déploiement incomplet pourrait perdre la liaison ASSETS, les secrets ou des fonctionnalités propres au Worker actif.

## Fonctionnalités repérées dans le bundle actif

Le bundle contient notamment les routes d'administration et de gestion des articles, albums et médias, l'authentification des blogueurs, l'intégration Google Photos/Drive, l'envoi d'e-mails, les interactions vues/j'aime/partage sur les articles, ainsi que la page de maintenance HTML.
