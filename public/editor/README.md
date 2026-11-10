# Éditeur de rédaction ActuScout

Accès : `/redaction?context=admin` ou `/redaction?context=blogger`. Pour modifier un article, ajouter `&id=IDENTIFIANT`.

L’éditeur réutilise les sessions ActuScout. Les articles sont enregistrés dans D1 et les images dans R2 via `/api/article-media`. Les blogueurs peuvent enregistrer un brouillon ou soumettre un article à validation ; ils ne peuvent pas publier directement.

Le contenu HTML des articles est filtré côté Worker par une liste blanche de balises et d’attributs via `HTMLRewriter`. Les balises actives ou embarquées sont supprimées, les attributs d’événement et les styles en ligne sont retirés, et les URL des liens/images sont contrôlées.

Mammoth.js 1.6.0 est chargé depuis jsDelivr pour importer les documents Word (.docx). La conversion et l’extraction des images doivent encore faire l’objet de tests avec des fichiers Word représentatifs avant la mise en production.
