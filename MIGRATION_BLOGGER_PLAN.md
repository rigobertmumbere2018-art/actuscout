# Migration complète de Blogger vers ActuScout

## Décision de migration
Le blog source https://actuscout.blogspot.com/ est destiné à être supprimé après la migration complète, les contrôles de conformité et la validation finale du propriétaire. Il ne doit rester aucune dépendance fonctionnelle du nouveau site envers Blogger.

## Source et destination
- Source : https://actuscout.blogspot.com/
- Export source : sauvegarde complète Blogger XML depuis Paramètres > Gérer le blog > Sauvegarder le contenu.
- Dépôt : rigobertmumbere2018-art/actuscout
- Branche : migration/blogger-import
- Architecture existante : Cloudflare Worker (src/index.js), Cloudflare D1 (binding DB), Cloudflare R2 (binding GALLERY), pages statiques dans public/.
- Ne pas recréer la base D1, le bucket R2 ni écraser les données actuelles.

## Périmètre obligatoire : migration intégrale
Migrer tout le contenu éditorial exportable du blog, pas seulement les articles récents ou visibles sur la page d'accueil :
- Tous les articles/publications, y compris brouillons si présents dans l'export (les inventorier et respecter leur statut).
- Titres, corps HTML, mise en forme, extraits, auteurs, labels/catégories.
- Dates et heures originales avec leur fuseau horaire.
- Toutes les images et médias intégrés, images de couverture et pièces jointes accessibles.
- Commentaires, auteurs de commentaires, dates et états de modération si présents dans l'export.
- Pages statiques Blogger si elles existent et sont incluses dans l'export.
- Identifiants Blogger, permaliens, URL d'origine, métadonnées utiles.
- Liens internes, liens entre publications, contenus embarqués et références aux médias.

Tout élément non exporté ou non récupérable doit figurer explicitement dans un rapport d'écart. Ne jamais annoncer une migration complète si des contenus ou médias restent manquants.

## Stockage et autonomie après migration
- Copier les médias récupérables dans Cloudflare R2.
- Réécrire les références d'images et médias dans les contenus pour utiliser les ressources hébergées par ActuScout.
- Ne laisser aucune image essentielle dépendre de blogspot.com, googleusercontent ou d'un hébergement tiers temporaire si elle peut être copiée légalement et techniquement.
- Conserver l'URL source Blogger et l'identifiant d'origine dans des métadonnées pour traçabilité et déduplication.
- Adapter le schéma D1 avec des migrations versionnées, sans perte de données existantes.
- Préserver les dates historiques : la date d'import ne doit jamais remplacer la date de publication originale.

## Intégration éditoriale et SEO
- Afficher les archives dans le design et les composants actuels d'ActuScout.
- Rendre les archives navigables par date et catégorie/auteur.
- Attribuer à chaque contenu une URL permanente ActuScout.
- Générer ou mettre à jour sitemap.xml, métadonnées SEO et liens canoniques.
- Inventorier les anciennes URL et préparer une table de correspondance ancien permalien -> nouvelle URL.
- Prévoir les redirections uniquement là où elles peuvent réellement être maintenues.

## Attention aux anciennes URL et à la suppression Blogger
La suppression du blog Blogger peut rendre les anciennes URL blogspot.com inaccessibles. Une redirection depuis ces URL ne doit pas être promise si Blogger est supprimé et si aucun domaine/serveur contrôlé ne permet de la servir. Étudier les possibilités de redirection avant suppression, notamment si un domaine personnalisé était utilisé. La suppression est une étape finale séparée, après sauvegarde XML conservée hors de Blogger, validation du rapport et accord explicite du propriétaire.

## Méthode et sécurité
1. Analyser l'export XML complet avant toute écriture : inventaire des publications, pages, commentaires, médias, dates et permaliens.
2. Produire un rapport d'audit avec totaux et écarts.
3. Implémenter un importateur robuste, testable et relançable.
4. Rendre l'import idempotent via identifiant Blogger et/ou permalien d'origine.
5. Faire un aperçu avant import, puis importer par lots avec journalisation et reprise après erreur.
6. Ne jamais écraser les articles ou albums déjà présents sur ActuScout.
7. Garder le blog Blogger intact pendant toute l'opération.
8. Ne pas déployer et ne pas appliquer de migration D1 distante sans validation explicite du propriétaire.
9. Ne pas modifier la charte graphique ou les pages existantes au-delà des intégrations nécessaires.

## Contrôles avant clôture
- Comparaison des nombres d'articles/pages/commentaires entre l'export et la destination.
- Vérification des dates, auteurs, catégories, permaliens et statuts.
- Vérification automatisée des images et liens internes ; rapport des ressources non récupérées.
- Tests d'échantillons anciens/récents, articles longs, accents, HTML, vidéos intégrées et commentaires.
- Vérification mobile/desktop, recherche, navigation par archives, sitemap et absence de régression.
- Sauvegarde de l'export XML et du rapport final dans un emplacement contrôlé par le propriétaire.

## Critères autorisant la suppression de Blogger
La suppression ne peut intervenir qu'après :
- import de l'ensemble des éléments exportables ;
- résolution ou acceptation explicite de chaque écart documenté ;
- validation du propriétaire après vérification du nouveau site ;
- conservation d'une copie indépendante du XML original et du rapport de migration ;
- décision éclairée sur le sort des anciennes URL et redirections.

## Étape immédiate
Attendre le fichier XML complet exporté depuis le compte propriétaire Blogger. L'analyser et établir l'inventaire exact avant d'implémenter l'importateur.