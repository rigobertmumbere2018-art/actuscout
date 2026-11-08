# Migration des archives Blogger vers ActuScout

## Source
- Blog Blogger : https://actuscout.blogspot.com/
- Export attendu : sauvegarde complète Blogger au format XML (Paramètres > Gérer le blog > Sauvegarder le contenu).
- La migration doit couvrir toutes les publications, sans se limiter à la page d'accueil ou à une page d'archives.

## Destination existante
- Dépôt : rigobertmumbere2018-art/actuscout
- Branche de travail : migration/blogger-import
- Architecture : Cloudflare Worker (src/index.js), Cloudflare D1 (binding DB), Cloudflare R2 (binding GALLERY), pages statiques dans public/.
- Table articles existante : id, title, category, excerpt, body, cover_url, author, status, created_at, updated_at, blogger_id.
- Ne pas recréer la base, le bucket, ni modifier les données déjà en production.

## Données à préserver
- Titre, contenu HTML et mise en forme des articles.
- Date/heure de publication d'origine, en conservant le fuseau fourni par Blogger.
- Auteur, labels/catégories, résumé si disponible.
- Image de couverture et toutes les images intégrées au corps.
- URL Blogger d'origine et identifiant Blogger d'origine pour déduplication.
- Commentaires si l'export XML les contient et si un stockage adapté est ajouté sans casser les fonctions existantes.

## Règles d'import
1. Construire un importateur XML Blogger robuste, avec validation du fichier et messages d'erreur lisibles.
2. Prévoir un mode aperçu/rapport avant toute écriture : nombre d'articles détectés, dates min/max, entrées ignorées, doublons et médias référencés.
3. Prévoir une importation relançable et idempotente, en s'appuyant sur l'identifiant Blogger et/ou l'URL canonique d'origine.
4. Importer les articles historiques comme publiés, sans écraser les articles actuels.
5. Télécharger/copier les images Blogger dans le bucket R2 lorsque possible, réécrire les URLs dans le HTML vers les URLs R2 et conserver l'URL source en métadonnée.
6. Si une image ne peut pas être récupérée, conserver son URL source et la signaler dans le rapport.
7. Conserver les dates d'origine dans les champs de date adaptés; ne pas remplacer les dates historiques par la date d'import.
8. Garder Blogger intact : aucune suppression, modification ou redirection automatique sur le blog source.
9. Ne jamais déployer ni appliquer une migration D1 distante sans validation explicite du propriétaire.
10. Ne pas modifier le thème, la charte graphique ou les pages publiques existantes en dehors des intégrations strictement nécessaires à l'affichage des archives.

## Interface attendue
- Les articles importés doivent utiliser les pages et composants éditoriaux actuels d'ActuScout.
- Les archives doivent pouvoir être parcourues par date et catégorie.
- Chaque ancien article doit conserver une URL source consultable et, si possible, une URL canonique ActuScout.
- Ajouter une indication discrète « Archives ActuScout » uniquement si nécessaire pour distinguer les articles historiques.

## Tests obligatoires
- XML valide, XML malformé, export volumineux et caractères accentués.
- Dates avec fuseaux horaires.
- Articles avec plusieurs images, liens, vidéos intégrées et HTML.
- Articles sans image, sans résumé ou sans catégorie.
- Import répété sans doublons.
- Échec réseau lors du téléchargement d'une image puis reprise.
- Vérifier que les articles et albums existants restent inchangés.
- Vérifier rendu mobile et desktop et absence de régression sur les pages actuelles.

## Étape de travail immédiate
Attendre le fichier XML exporté depuis le compte propriétaire Blogger. L'analyser d'abord pour produire un inventaire exact (nombre d'articles, commentaires, médias, périodes couvertes), puis implémenter le convertisseur et l'import dans cette branche.
