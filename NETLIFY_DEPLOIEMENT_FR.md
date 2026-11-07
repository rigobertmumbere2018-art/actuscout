# Netlify et ActuScout — guide de déploiement

## Important : architecture actuelle

ActuScout n'est pas un site statique autonome. Il utilise un Cloudflare Worker comme serveur applicatif :
- `src/index.js` : routes API et logique serveur ;
- `public/` : fichiers du site ;
- Cloudflare D1 : base `actuscout-db` ;
- Cloudflare R2 : bucket `actuscout-galeries`.

Le fichier `wrangler.toml` configure ces liaisons. Un déploiement Netlify standard qui ne publie que `public/` ou un dossier de sortie statique ne démarre pas le Worker et ne remplace pas ses API. Les formulaires, l'administration, les données et les médias qui dépendent du Worker ne fonctionneront donc pas correctement avec un simple déploiement statique.

## Hébergement recommandé pour la version complète

Conserver Cloudflare Workers comme hébergement de production :
1. Connecter le dépôt GitHub à Cloudflare Workers & Pages, ou déployer depuis le projet avec Wrangler.
2. Conserver le fichier `wrangler.toml` et les bindings D1/R2 existants.
3. Vérifier les secrets dans les paramètres du Worker (ne jamais les committer).
4. Déployer avec `npm install` puis `npx wrangler deploy`.
5. Vérifier `/api/health`, le site public et `/admin`.

Ne pas recréer la base D1 ni le bucket R2. Ne pas exécuter de migration sans vérifier l'état des migrations déjà appliquées.

## Utiliser Netlify (optionnel, non recommandé comme hébergement complet)

Netlify peut servir une copie statique du contenu de `public/`, mais cette option est seulement un miroir de présentation et ne remplace pas le Worker. Les requêtes API doivent continuer à joindre le Worker Cloudflare, et tout code client doit être explicitement configuré pour utiliser son URL.

Pour un simple aperçu statique :
- Base directory : laisser vide
- Build command : laisser vide (aucune compilation n'est définie dans le `package.json` actuel)
- Publish directory : `public`
- Functions directory : laisser vide

Ce réglage ne doit pas être considéré comme un déploiement complet d'ActuScout. Ne pas basculer le domaine principal dessus avant une migration et des tests fonctionnels complets.

## Domaine personnalisé

Le nom de domaine peut être attaché au Worker Cloudflare, même si le nom de domaine a été acheté chez un autre registraire. L'hébergement et le DNS doivent pointer vers la cible appropriée ; ne pas supposer qu'un domaine placé sur Netlify héberge automatiquement le Worker.
