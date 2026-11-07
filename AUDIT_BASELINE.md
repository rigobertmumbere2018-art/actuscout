# ActuScout — audit de base propre

Ce document décrit les limites constatées sur la branche `copilot/actuscout-audit-safe`, créée à partir du commit `2389cee` de `main`. Aucun déploiement n'est effectué par les tests.

## État de la base

- Le Worker existant contient des routes de santé, de session admin, de lecture publique d'albums/articles, de gestion blogueur et d'administration.
- Les assets publics sont servis par la liaison Cloudflare `ASSETS`; D1 et R2 restent configurés dans `wrangler.toml`.
- `public/robots.txt` et `public/sitemap.xml` sont présents.
- Le formulaire contact du dépôt de base utilise `mailto:` côté navigateur; il n'existe pas de route `/api/contact` reliée à Resend dans le Worker de base. Le test d'audit conserve volontairement ce constat afin qu'un résultat vert ne soit pas confondu avec une intégration de contact terminée.
- La page de don n'affiche pas de coordonnées de paiement validées et doit rester sans paiement actif.

## Tests automatisés

`node --check src/index.js` contrôle uniquement la syntaxe JavaScript.
`node --test test/audit.test.mjs` exerce localement des routes Worker avec des bindings simulés et vérifie le sitemap/robots. Ces tests ne valident pas les identifiants Cloudflare, les données réelles D1/R2, l'envoi Resend, l'affichage dans un navigateur, la production, Lighthouse ou l'indexation Google.

Un workflow GitHub Actions exécutera ces vérifications sur la branche dédiée et les PR vers `main`; il ne déploie pas le Worker.

## Bloqueurs externes

- Pour le contact Resend : configurer dans Cloudflare les secrets `RESEND_API_KEY`, `ACTUSCOUT_EMAIL_FROM` et `CONTACT_EMAIL_TO` après validation de la clé, de l'expéditeur et du destinataire officiels. Aucun secret ne doit être committé.
- Pour les dons : fournir le bénéficiaire et les coordonnées/intégration de paiement officiellement approuvés. Aucun paiement ne doit être déclaré réussi sans vérification du prestataire.
- Pour confirmer la mise en production : accès autorisé au compte Cloudflare et validation explicite du déploiement. Cette branche et ce workflow ne déploient rien.
- Search Console : accès propriétaire requis pour confirmer propriété, envoi du sitemap et indexation.
