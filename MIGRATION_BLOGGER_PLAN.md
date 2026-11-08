# Migration des articles Blogger vers ActuScout

## Décision et périmètre
La migration porte exclusivement sur les articles/publications Blogger. Les pages statiques, commentaires, abonnés, thème, widgets et paramètres de présentation Blogger sont hors périmètre.

Le blog source https://actuscout.blogspot.com/ est destiné à être supprimé uniquement après import, contrôles, sauvegarde indépendante et validation explicite du propriétaire.

## Source et destination
- Source : https://actuscout.blogspot.com/
- Export attendu : sauvegarde native Blogger XML depuis Paramètres > Gérer le blog > Sauvegarder le contenu.
- Archive Takeout complémentaire déjà reçue : feed.atom, paramètres, profil et médias.
- Dépôt : rigobertmumbere2018-art/actuscout
- Branche : migration/blogger-import
- Architecture existante : Cloudflare Worker (src/index.js), Cloudflare D1 (binding DB), Cloudflare R2 (binding GALLERY), pages statiques dans public/.
- Ne pas recréer D1 ou R2 et ne pas écraser les données actuelles.

## Contenu à migrer
Pour chaque article exportable :
- Titre et corps HTML complet, avec mise en forme et liens.
- Date/heure originale et fuseau horaire.
- Auteur.
- Labels/catégories.
- Extrait si disponible.
- Image de couverture et images/médias intégrés récupérables.
- Identifiant Blogger, permalien et URL source pour traçabilité et déduplication.
- Statut de publication ; inventorier séparément les brouillons s'ils figurent dans l'export.

Les commentaires, pages statiques et autres données de compte Blogger ne sont pas à importer. Les ressources non récupérables doivent être listées dans un rapport d'écart. Ne pas annoncer une migration complète si des articles ou médias essentiels manquent.

## Design et intégration
- Le site https://actuscout.com/ et sa charte graphique actuelle constituent la référence unique.
- Conserver strictement l'apparence, les couleurs, la typographie, les composants, la navigation et l'expérience responsive déjà en place.
- Ne pas reprendre le thème Blogger, ses widgets, sa mise en page ni ses choix visuels.
- Intégrer les articles importés dans les pages, composants et modèles éditoriaux existants d'ActuScout.
- Les changements d'interface doivent être limités au strict nécessaire pour afficher les articles archivés avec le design existant.

## Médias et stockage
- Copier dans Cloudflare R2 les images et médias intégrés qui peuvent être récupérés.
- Réécrire les URL dans le HTML des articles pour pointer vers les médias hébergés par ActuScout.
- Préserver les liens externes non téléchargeables et signaler les ressources manquantes.
- Conserver les URL d'origine et identifiants Blogger dans les métadonnées.

## Base de données et import
- Examiner le schéma D1 actuel avant toute modification.
- Ajouter les champs nécessaires par migration SQL versionnée et additive, sans perte des données existantes.
- Préserver les dates de publication originales.
- Importateur idempotent, relançable, avec aperçu, journalisation, import par lots et reprise après erreur.
- Dédupliquer par identifiant Blogger et/ou permalien source.
- Ne jamais écraser les articles déjà présents sur ActuScout.

## Méthode et sécurité
1. Analyser l'export XML natif et l'archive Takeout disponible.
2. Établir l'inventaire exact des articles et un rapport d'écart.
3. Développer l'importateur adapté au format réellement fourni.
4. Préparer l'évolution D1 et l'import des médias R2 dans cette branche.
5. Tester l'import et l'affichage avec le design actuel.
6. Comparer les totaux source/destination et vérifier les articles anciens/récents, HTML, images, dates, auteurs et catégories.
7. Ne pas fusionner vers main, ne pas déployer et ne pas appliquer de migration D1 distante sans validation explicite.
8. Garder Blogger intact jusqu'à la validation finale.

## Anciennes URL et suppression
La suppression du blog Blogger peut rendre ses anciennes URL blogspot.com inaccessibles. Ne pas promettre de redirections qui ne peuvent pas être maintenues. Inventorier les permaliens et préparer les correspondances vers ActuScout avant la décision de suppression.

La suppression n'est envisageable qu'après import de tous les articles exportables, résolution ou acceptation des écarts, vérification du site par le propriétaire, conservation d'une copie indépendante des exports et validation explicite.

## État de l'archive Takeout reçue
L'archive reçue contient un feed Atom avec 9 entrées (dont une sans titre) et des médias. Ce décompte est un premier constat sur le fichier fourni, pas une preuve que les 9 entrées représentent l'intégralité des articles du blog. L'export natif XML Blogger reste nécessaire pour établir le périmètre exhaustif.
