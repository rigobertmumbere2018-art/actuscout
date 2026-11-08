# Audit initial de l'archive Blogger Takeout

Archive reçue : `takeout-20261108T110138Z-1-001.zip`

## Constat vérifié
- Le ZIP contient `Takeout/Blogger/Blogs/Actuscout/feed.atom`.
- Le flux Atom contient 9 entrées, dont 8 avec titre et 1 sans titre.
- Le flux contient 9 entrées de type publication Blogger (identifiants `.post-`).
- La période visible dans les dates des entrées va de septembre 2025 à avril 2026.
- Le flux contient des corps HTML, des auteurs et quelques libellés.
- L'archive contient aussi des fichiers image et des fichiers JSON de métadonnées d'albums.
- Les pages statiques, commentaires et abonnés ne sont pas dans le périmètre de migration.

## Limite
Ce décompte décrit uniquement le flux Atom de cette archive Takeout. Il ne prouve pas que le flux contient toutes les publications historiques du blog. Il faut comparer avec l'inventaire du blog source avant de déclarer la migration exhaustive.

## Design
Le thème Blogger n'est pas repris. Les articles seront intégrés aux composants et au style déjà présents sur ActuScout.

## Prochaine étape technique
Le script `scripts/prepare_blogger_import.py` prépare un JSON d'audit depuis le ZIP sans écrire dans D1. Les écritures de production restent bloquées jusqu'à validation du contenu et des médias.
