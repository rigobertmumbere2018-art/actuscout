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
