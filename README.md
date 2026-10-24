# Trombicarte

Trombinoscope de la promo CDA P9 sur une carte interactive : chaque personne est placée sur l'adresse de son entreprise. Un clic sur le point affiche sa photo, son prénom, son nom, son rôle et son entreprise.

## Stack

- **Leaflet 1.9.4** : carte interactive
- **OpenStreetMap** : fond de carte (gratuit, sans clé d'API), désaturé en CSS, clair ou sombre selon le thème du système
- **Leaflet.markercluster 1.5.3** : regroupe les points proches et écarte ceux qui partagent la même adresse
- **Géoplateforme IGN** (ex-API Adresse) : conversion adresse → latitude/longitude
- **Lora** (titre) et **DM Sans** (texte) via Google Fonts
- HTML / CSS / JS vanilla, aucun build, déployable tel quel sur GitHub Pages

## Arborescence

```
index.html
css/style.css
js/app.js                      # carte, popups, liste, recherche
data/apprenants.source.json    # ce que vous remplissez (sans coordonnées)
data/apprenants.json           # généré par le script (avec lat/lng), lu par le site
scripts/geocode.mjs            # géocodage des adresses
uploads/photos/                # photos (prenom-nom.webp, ~300 px, < 40 Ko)
```

## Ajouter un apprenant

1. Déposer la photo dans `uploads/photos/` (ex. `camille-durand.jpg`, carrée, ~300 px, en `.webp` ou `.jpg` compressé).
2. Ajouter une entrée dans `data/apprenants.source.json` :

   ```json
   {
     "prenom": "Camille",
     "nom": "Durand",
     "role": "alternant",
     "entreprise": "Nom de l'entreprise",
     "adresse": "12 rue Exemple 83300 Draguignan",
     "photo": "uploads/photos/camille-durand.jpg"
   }
   ```

   - `role` : `"alternant"` (point jaune) ou `"formateur"` (point violet, badge). Absent ou mal orthographié = `"alternant"`.
   - Sans photo (`"photo": ""`), les initiales s'affichent à la place.
   - Sans entreprise (`"entreprise": ""`), la popup affiche « Entreprise non renseignée ».
3. Lancer le géocodage (Node 18+) :

   ```bash
   node scripts/geocode.mjs
   ```

   Le script affiche l'adresse trouvée et un score de confiance. Un score < 0.6 est signalé : vérifier sur la carte.
   Une entrée qui a déjà `lat`/`lng` n'est pas recalculée (utile pour corriger à la main ou pour une adresse hors de France).

## Lancer en local

`fetch()` ne fonctionne pas en ouvrant `index.html` directement (`file://`). Utiliser un serveur :

```bash
npx serve .
# ou : python -m http.server 8000
# ou : extension Live Server de VS Code
```

## Déployer sur GitHub Pages

Settings → Pages → Source : `Deploy from a branch` → `main` / `/ (root)`.

## RGPD

Photos et noms sont des données personnelles : recueillir le consentement écrit de chaque apprenant avant publication, et retirer sans délai toute personne qui le demande. Le dépôt et le site étant publics, l'adresse de l'entreprise suffit : ne jamais mettre d'adresse personnelle.

## Données d'exemple

Les 8 entrées fournies sont fictives (entreprises préfixées « Exemple — »). Les remplacer par les vraies.
