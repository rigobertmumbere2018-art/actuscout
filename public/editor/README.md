# Éditeur de rédaction ActuScout

Accès : `/redaction?context=admin` ou `/redaction?context=blogger`. Pour modifier un article, ajouter `&id=IDENTIFIANT`.

L’éditeur réutilise les sessions ActuScout. Les articles sont enregistrés dans D1 et les images dans R2 via `/api/article-media`. Les blogueurs peuvent enregistrer un brouillon ou soumettre un article à validation ; ils ne peuvent pas publier directement. Mammoth.js 1.6.0 est chargé depuis jsDelivr pour importer les documents Word.
