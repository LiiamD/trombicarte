/**
 * Trombicarte — carte interactive des apprenants.
 * Chaque apprenant est placé sur l'adresse de son entreprise (lat/lng
 * calculés en amont par scripts/geocode.mjs).
 */

const DATA_URL = "data/apprenants.json";
const DEFAULT_VIEW = { center: [43.6, 6.2], zoom: 9 }; // Var / PACA

// ---------- Carte ----------
const map = L.map("map").setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Regroupe les marqueurs proches ; "spiderfy" écarte ceux qui ont
// exactement les mêmes coordonnées (plusieurs apprenants dans la même entreprise).
const cluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: 45,
});
map.addLayer(cluster);

// ---------- Utilitaires ----------
const escapeHtml = (str = "") =>
  String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

const initials = (p) =>
  `${p.prenom?.[0] ?? ""}${p.nom?.[0] ?? ""}`.toUpperCase();

/** Photo si disponible, sinon pastille avec les initiales. */
function avatarHtml(p, size = "") {
  const cls = `avatar ${size}`.trim();
  if (p.photo) {
    return `<img class="${cls}" src="${escapeHtml(p.photo)}" alt="Photo de ${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}" loading="lazy">`;
  }
  return `<span class="${cls}" aria-hidden="true">${escapeHtml(initials(p))}</span>`;
}

function popupHtml(p) {
  return `
    <article class="card">
      ${avatarHtml(p, "avatar--lg")}
      <h2 class="card__name">${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</h2>
      <p class="card__company">${escapeHtml(p.entreprise)}</p>
      <p class="card__address">${escapeHtml(p.adresse)}</p>
    </article>`;
}

// ---------- Liste latérale ----------
const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("count");

function renderList(entries) {
  if (!entries.length) {
    listEl.innerHTML = `<li class="list__empty">Aucun résultat.</li>`;
    return;
  }
  listEl.innerHTML = entries
    .map(({ person }, i) => `
      <li>
        <button class="list__item" type="button" data-index="${i}">
          ${avatarHtml(person)}
          <span>
            <span class="list__name">${escapeHtml(person.prenom)} ${escapeHtml(person.nom)}</span><br>
            <span class="list__company">${escapeHtml(person.entreprise)}</span>
          </span>
        </button>
      </li>`)
    .join("");

  listEl.querySelectorAll(".list__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { marker } = entries[Number(btn.dataset.index)];
      // zoomToShowLayer sort le marqueur de son cluster avant d'ouvrir la popup
      cluster.zoomToShowLayer(marker, () => marker.openPopup());
    });
  });
}

// ---------- Chargement des données ----------
async function init() {
  let people;
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    people = await res.json();
  } catch (err) {
    listEl.innerHTML = `<li class="list__empty">Impossible de charger ${DATA_URL} (${escapeHtml(err.message)}). Lance le site via un serveur local, pas en ouvrant index.html directement.</li>`;
    return;
  }

  const entries = people
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map((person) => {
      const marker = L.marker([person.lat, person.lng], {
        title: `${person.prenom} ${person.nom}`,
      }).bindPopup(popupHtml(person));
      cluster.addLayer(marker);
      return { person, marker };
    });

  countEl.textContent = entries.length;
  renderList(entries);

  if (entries.length) {
    map.fitBounds(cluster.getBounds(), { padding: [40, 40] });
  }

  // Recherche : filtre la liste ET la carte
  searchEl.addEventListener("input", () => {
    const q = searchEl.value.trim().toLocaleLowerCase("fr");
    const filtered = entries.filter(({ person: p }) =>
      [p.prenom, p.nom, p.entreprise, p.adresse]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(q));
    cluster.clearLayers();
    cluster.addLayers(filtered.map((e) => e.marker));
    renderList(filtered);
  });
}

init();
