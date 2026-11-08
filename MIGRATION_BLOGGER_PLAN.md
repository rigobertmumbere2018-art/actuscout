# Migration des articles Blogger vers ActuScout

## Règle de publication validée par le propriétaire
- Toute publication Blogger avec un titre est importée avec le statut `published` et devient visible immédiatement sur ActuScout après déploiement/import.
- Toute publication sans titre est importée avec le statut `draft` et reste dans les brouillons de l'administration.
- Ne jamais inventer un titre pour une publication sans titre.

## Périmètre
Migration des articles/publications uniquement. Pages statiques, commentaires, abonnés, thème, widgets et paramètres visuels Blogger exclus.

## Design
Conserver strictement la charte graphique, les composants, les pages et l'expérience responsive actuels de https://actuscout.com/. Ne pas importer le thème Blogger et ne pas refondre le site.

## Source et architecture
- Source : https://actuscout.blogspot.com/
- Archive Takeout fournie : `takeout-20261108T110138Z-1-001.zip`.
- Dépôt : `rigobertmumbere2018-art/actuscout`.
- Branche de travail : `migration/blogger-import`.
- Cloudflare Worker : `src/index.js`.
- D1 : binding `DB`, base `actuscout-db`.
- R2 : binding `GALLERY`, bucket `actuscout-galeries`.
- Ne pas recréer D1/R2 ni écraser les articles existants.

## Champs à préserver
Titre, corps HTML, extrait, auteur, catégories/labels, date et heure originales, image de couverture, images intégrées, identifiant Blogger, permalien d'origine et statut de publication.
Les images doivent être copiées vers R2 et les URLs réécrites quand cela est possible. Toute image non récupérable doit être documentée.

## Sécurité et migration
- Déduplication par identifiant Blogger.
- Migration D1 additive et versionnée.
- Import idempotent, relançable et journalisé.
- Ne jamais écraser les articles ActuScout déjà présents.
- Ne pas supprimer Blogger avant vérification et sauvegarde indépendante.
- L'import/déploiement en production ne peut être déclaré réussi qu'après contrôle réel des articles, statuts, images et rendu public.


## Implémentation de l'outil d'import — 8 novembre 2026
- Route Worker `POST /api/admin/import-blogger` ajoutée sur la branche de migration, réservée à la session administrateur.
- Interface d'administration : sélection du fichier JSON Takeout et lancement de l'import.
- Import idempotent par `blogger_post_id` ; les doublons sont ignorés et les articles ActuScout existants ne sont pas remplacés.
- Les publications titrées sont insérées en `published` ; la publication sans titre est insérée en `draft`.
- Copie des images vers R2 tentée si `GALLERY` et `R2_PUBLIC_BASE` sont configurés ; sinon les URLs source sont conservées et signalées.
- La migration D1 `0004_blogger_article_metadata.sql` doit être appliquée avant l'exécution de l'import.
- Le rendu de l'article dans la fenêtre de lecture a été adapté pour afficher le HTML importé en filtrant les éléments et attributs non autorisés.
- Tests en production, application de la migration D1, transfert réel des images et import réel restent à effectuer. Aucun article n'est encore déclaré importé.
