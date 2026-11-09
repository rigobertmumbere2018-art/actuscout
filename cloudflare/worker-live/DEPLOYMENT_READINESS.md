# État de préparation du déploiement ActuScout

Date du contrôle : 9 novembre 2026.

## Résumé exécutif

Le Worker actif a été sauvegardé exactement dans `cloudflare/worker-live/index.js`. Il n'est pas encore possible de produire un déploiement de production sûr à partir du dépôt actuel : le code source versionné, le bundle actif, le schéma D1 et les ressources statiques ne sont pas encore réconciliés.

## Écarts et risques établis

### 1. Code source divergent

- `src/index.js` sur `main` : 33 479 caractères.
- Bundle actif Cloudflare sauvegardé : 74 944 caractères.
- Le bundle actif comprend des éléments absents de `src/index.js` sur `main`, notamment les vues/j'aime d'articles, la page de maintenance, les actions d'engagement et les corrections récentes de l'affichage des couvertures.
- Un déploiement Wrangler lancé avec le `main` actuel remplacerait donc une partie du comportement actif.

**Action requise :** réintégrer les ajouts propres à la production dans une vraie source maintenable, sans éditer directement le bundle minifié comme source de développement.

### 2. Ressources statiques

Le dépôt contient `public/`, mais le binding Cloudflare `ASSETS` ne livre pas, dans les endpoints consultés, un inventaire exploitable du manifeste actuellement déployé. Le dossier du dépôt ne peut donc pas être déclaré identique aux assets de production.

**Action requise :** établir un inventaire de référence des fichiers statiques, vérifier les chemins utilisés par le Worker et confirmer que toutes les pages, images, polices, scripts et feuilles de style attendus sont présents.

### 3. Schéma D1

Le schéma réellement lu dans la base de production est archivé dans `D1_SCHEMA_PRODUCTION.sql`. Il existe des écarts avec les migrations versionnées, dont les tables d'engagement et le champ magazine.

**Action requise :** préparer une migration de réconciliation après analyse des migrations déjà appliquées. Le relevé SQL est documentaire et ne doit pas être exécuté tel quel.

### 4. Variables et secrets

Le bundle référence des variables Google et e-mail dont les noms n'apparaissent pas dans la liste des bindings retournée par le réglage Worker consulté. Les valeurs ne doivent pas être exportées.

**Action requise :** contrôler leur présence dans l'environnement Cloudflare et, si elles sont absentes, déterminer si les fonctions correspondantes sont volontairement désactivées ou si la configuration doit être complétée. Ne pas modifier les secrets pendant la phase d'inventaire.

### 5. Routage et déploiement

La configuration Wrangler versionnée confirme les bindings D1, R2 et ASSETS, mais les paramètres complets de publication et de routage doivent être vérifiés avec la configuration Cloudflare actuelle avant un déploiement.

**Action requise :** documenter les domaines personnalisés, routes, paramètres de compatibilité, assets, bindings et variables. Ne pas changer le routage ni basculer de trafic durant cette préparation.

## Contrôles effectués sans écriture en production

- Lecture du bundle Worker actif et comparaison exacte avec le fichier sauvegardé dans GitHub.
- Lecture des paramètres du Worker et de ses bindings.
- Lecture du schéma D1 via `sqlite_master`.
- Lecture des migrations versionnées et de `wrangler.toml`.
- Aucune requête SQL d'écriture, aucun changement R2, aucun changement de secret et aucun déploiement Cloudflare.

## Plan de travail avant production

1. Faire une comparaison fonctionnelle détaillée entre le bundle actif et `src/index.js`.
2. Reconstituer une source Worker maintenable et la couvrir par des tests de routes et de fonctions.
3. Réconcilier le contenu `public/` avec les ressources statiques attendues par Cloudflare.
4. Préparer une migration D1 additive sur un environnement isolé et vérifier les données de test.
5. Vérifier les variables/secrets et les bindings sans exposer leurs valeurs.
6. Créer une configuration de préproduction distincte, avec base et stockage de test, jamais la base de production.
7. Exécuter les tests de non-régression : accueil, articles, lecteur, vues, likes, partage, albums, upload, Google, blogueurs, contact, administration et maintenance.
8. Vérifier les pages sur Chrome, Edge, Firefox et Safari, ordinateur et mobile.
9. Faire une revue finale du diff et du plan de retour arrière.
10. Déployer uniquement après validation et accord explicite.

## État de décision

**NO-GO pour un déploiement Cloudflare en production à ce stade.** La sauvegarde est fiable, mais les écarts identifiés pourraient entraîner une régression si le dépôt était déployé tel quel. La préparation continue sans toucher au trafic de production.
