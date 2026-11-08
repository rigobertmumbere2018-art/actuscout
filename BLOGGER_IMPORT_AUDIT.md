# Audit initial de l'archive Blogger Takeout

Archive reçue : `takeout-20261108T110138Z-1-001.zip`

## Résultat de l'analyse réelle du flux
- Fichier analysé : `Takeout/Blogger/Blogs/Actuscout/feed.atom`.
- 9 entrées avec identifiant de publication Blogger (`.post-`).
- 8 publications avec titre et 1 publication sans titre.
- 9 corps HTML présents, dont un contenu très court de 217 caractères.
- 17 références d'images intégrées détectées dans les corps HTML.
- Dates de publication observées : du 13 septembre 2025 au 12 avril 2026.
- Auteurs présents dans le flux : ActuScout et Épinoche Dgtr.
- Le ZIP contient également des médias d'album, les paramètres du blog et des métadonnées Takeout.

## Inventaire des publications
| Date | Publication |
|---|---|
| 2025-09-13 | Une nouvelle figure à la tête de l’ASNK |
| 2025-09-14 | KATEMBO KAHAMWITHI Godefroid, nouveau Commissaire de District de Beni Ville |
| 2025-09-15 | Les Scouts et Guides de France font leur rentrée à Châteauroux le 21 septembre |
| 2025-09-16 | Parcours scout de M. Bakunda Hodari Didi : de Don Bosco Goma à la formation des formateurs |
| 2025-09-24 | Un nouveau souffle pour le scoutisme à Goma |
| 2025-12-28 | Hommage au Chef ALBATROS CONTENTIEUX |
| 2026-04-11 | Groupe scout Saint Pierre Brave : Un camp mémorable à Bulongo |
| 2026-04-11 | Publication sans titre — auteur : Épinoche Dgtr |
| 2026-04-12 | Nyiragongo Dynamique : Christian MUKAMBILWA dit Crave, héritier d’une grande tradition scoute |

## Limite importante
Ce décompte décrit le contenu du flux Atom présent dans le ZIP. Il ne prouve pas que ce flux contient toutes les publications historiques du blog. Il faut le comparer à la liste des articles visible sur le blog source avant de déclarer la migration exhaustive.

## Design et périmètre
Le thème Blogger, les pages statiques et les commentaires ne sont pas repris. Les articles sont destinés à être affichés dans les composants et le style déjà présents sur ActuScout. Aucune refonte visuelle n'est prévue.

## État technique
- Une migration SQL additive prépare les champs de traçabilité Blogger dans la table `articles`.
- Un script Python prépare un inventaire JSON depuis le ZIP sans écrire dans Cloudflare.
- Aucune donnée n'a été écrite dans la base D1 distante, aucun média n'a été envoyé dans R2 et aucun déploiement n'a été effectué.


## Outil d'import ajouté à la branche de migration
La branche contient désormais une route Worker protégée par la session administrateur, un contrôle d'import dans l'administration et un rendu HTML filtré dans la fenêtre de lecture des articles. L'import n'a pas encore été lancé : la migration D1 0004 et le contrôle de configuration R2 doivent précéder l'exécution.
