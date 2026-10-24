/**
 * Géocode les adresses d'entreprise une seule fois, en amont,
 * pour ne pas appeler l'API à chaque visite du site.
 *
 *   Entrée  : data/apprenants.source.json  (sans lat/lng)
 *   Sortie  : data/apprenants.json         (avec lat/lng)
 *
 * Usage : node scripts/geocode.mjs
 *
 * API : Géoplateforme IGN (ex-API Adresse / BAN) — adresses françaises uniquement.
 * Pour une adresse hors de France, renseigne lat/lng à la main dans le fichier source :
 * le script ne recalcule pas une entrée qui a déjà ses coordonnées.
 */
import { readFile, writeFile } from "node:fs/promises";

const SRC = new URL("../data/apprenants.source.json", import.meta.url);
const OUT = new URL("../data/apprenants.json", import.meta.url);
const API = "https://data.geopf.fr/geocodage/search";
const DELAY_MS = 150; // reste poli avec le service public

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(adresse) {
  const url = `${API}?q=${encodeURIComponent(adresse)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const feature = json.features?.[0];
  if (!feature) return null;
  const [lng, lat] = feature.geometry.coordinates; // GeoJSON : [longitude, latitude]
  return { lat, lng, score: feature.properties.score, label: feature.properties.label };
}

const people = JSON.parse(await readFile(SRC, "utf8"));
const result = [];

for (const p of people) {
  if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
    result.push(p);
    continue;
  }
  try {
    const geo = await geocode(p.adresse);
    if (!geo) {
      console.warn(`✗ Introuvable : ${p.prenom} ${p.nom} — "${p.adresse}"`);
      result.push(p);
    } else {
      // score < 0.6 : résultat douteux, à vérifier à la main
      const flag = geo.score < 0.6 ? "  ⚠ score faible, vérifie" : "";
      console.log(`✓ ${p.prenom} ${p.nom} → ${geo.label} (${geo.score.toFixed(2)})${flag}`);
      result.push({ ...p, lat: geo.lat, lng: geo.lng });
    }
  } catch (err) {
    console.error(`✗ Erreur pour ${p.prenom} ${p.nom} : ${err.message}`);
    result.push(p);
  }
  await sleep(DELAY_MS);
}

await writeFile(OUT, JSON.stringify(result, null, 2) + "\n");
console.log(`\n${result.filter((p) => Number.isFinite(p.lat)).length}/${result.length} apprenants placés → data/apprenants.json`);
