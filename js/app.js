/**
 * Trombicarte — carte interactive de la promo.
 * Chaque personne est placée sur l'adresse de son entreprise (lat/lng
 * calculés en amont par scripts/geocode.mjs).
 */

const DATA_URL = "data/apprenants.json";
const DEFAULT_VIEW = { center: [46.6, 2.4], zoom: 6 }; // France entière

// Rôles reconnus dans le JSON. Une valeur absente ou inconnue = "alternant".
const ROLES = {
  alternant: { label: "Alternant·e" },
  formateur: { label: "Formateur·rice" },
};
const DEFAULT_ROLE = "alternant";

// ---------- Carte ----------
const map = L.map("map", { zoomControl: false }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
L.control.zoom({ position: "bottomright" }).addTo(map);

// Fond OpenStreetMap standard (gratuit, sans clé d'API).
// Il est désaturé en CSS (voir .leaflet-tile-pane dans style.css) :
// gris clair en thème clair, gris sombre en thème sombre.
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Regroupe les marqueurs proches ; "spiderfy" écarte ceux qui ont
// exactement les mêmes coordonnées (plusieurs personnes dans la même entreprise).
const cluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: 45,
  // Pastille de groupe neutre : un groupe peut mélanger les rôles
  iconCreateFunction: (c) =>
    L.divIcon({
      className: "",
      html: `<div class="cluster"><span>${c.getChildCount()}</span></div>`,
      iconSize: [36, 36],
    }),
});
map.addLayer(cluster);

// ---------- Utilitaires ----------
const escapeHtml = (str = "") =>
  String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

const initials = (p) =>
  `${p.prenom?.[0] ?? ""}${p.nom?.[0] ?? ""}`.toUpperCase();

const roleOf = (p) => (p.role in ROLES ? p.role : DEFAULT_ROLE);

const companyOf = (p) => p.entreprise?.trim() || "Entreprise non renseignée";

/** Ville = ce qui suit le code postal dans l'adresse ("… 83300 Draguignan" → "Draguignan"). */
const cityOf = (p) => p.adresse?.match(/\b\d{5}\s+(.+)$/)?.[1] ?? "";

const badgeHtml = (role) =>
  `<span class="badge badge--${role}">${ROLES[role].label}</span>`;

/** Photo si disponible, sinon pastille avec les initiales.
 *  L'anneau autour de l'avatar prend la couleur du rôle. */
function avatarHtml(p, size = "") {
  const cls = `avatar avatar--${roleOf(p)} ${size}`.trim();
  if (p.photo) {
    return `<img class="${cls}" src="${escapeHtml(p.photo)}" alt="Photo de ${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}" loading="lazy">`;
  }
  return `<span class="${cls}" aria-hidden="true">${escapeHtml(initials(p))}</span>`;
}

/** Marqueur rond coloré selon le rôle. */
const iconFor = (role) =>
  L.divIcon({
    className: "", // supprime le carré blanc par défaut de Leaflet
    html: `<div class="pin pin--${role}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -13],
  });

function popupHtml(p) {
  const role = roleOf(p);
  return `
    <article class="card">
      ${avatarHtml(p, "avatar--lg")}
      <h2 class="card__name">${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</h2>
      ${badgeHtml(role)}
      <p class="card__company">${escapeHtml(companyOf(p))}</p>
      <p class="card__address">${escapeHtml(p.adresse)}</p>
    </article>`;
}

// ---------- Liste latérale ----------
const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("count");
const chips = document.querySelectorAll(".chip");

/** Met en évidence la ligne de la personne dont la popup est ouverte. */
function setActive(id) {
  listEl.querySelectorAll(".list__item").forEach((btn) => {
    const isActive = btn.dataset.id === String(id);
    btn.classList.toggle("is-active", isActive);
    if (isActive) btn.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function renderList(entries, query = "") {
  if (!entries.length) {
    listEl.innerHTML = query
      ? `<li class="list__empty">Aucun résultat pour « ${escapeHtml(query)} ».</li>`
      : `<li class="list__empty">Personne dans cette catégorie pour l'instant.</li>`;
    return;
  }
  listEl.innerHTML = entries
    .map(({ id, person, role }) => `
      <li>
        <button class="list__item" type="button" data-id="${id}">
          ${avatarHtml(person)}
          <span class="list__text">
            <span class="list__meta">
              <span class="list__name">${escapeHtml(person.prenom)} ${escapeHtml(person.nom)}</span>
              ${role === "formateur" ? badgeHtml(role) : ""}
            </span>
            <span class="list__company">${escapeHtml(companyOf(person))}</span>
            ${cityOf(person) ? `<span class="list__city">${escapeHtml(cityOf(person))}</span>` : ""}
          </span>
        </button>
      </li>`)
    .join("");

  listEl.querySelectorAll(".list__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { marker } = entries.find((e) => String(e.id) === btn.dataset.id);
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
    // Les formateurs d'abord, puis ordre alphabétique
    .sort((a, b) =>
      (roleOf(a) === "formateur" ? 0 : 1) - (roleOf(b) === "formateur" ? 0 : 1) ||
      a.nom.localeCompare(b.nom, "fr"))
    .map((person, id) => {
      const role = roleOf(person);
      const marker = L.marker([person.lat, person.lng], {
        icon: iconFor(role),
        title: `${person.prenom} ${person.nom}`,
        riseOnHover: true,
      }).bindPopup(popupHtml(person));
      // Synchronisation carte → liste
      marker.on("popupopen", () => setActive(id));
      marker.on("popupclose", () => setActive(null));
      cluster.addLayer(marker);
      return { id, person, role, marker };
    });

  // Compteurs : total + par rôle dans chaque filtre
  countEl.textContent = entries.length;
  document.querySelectorAll("[data-count]").forEach((el) => {
    const r = el.dataset.count;
    el.textContent = r === "all" ? entries.length : entries.filter((e) => e.role === r).length;
  });

  renderList(entries);

  if (entries.length) {
    map.fitBounds(cluster.getBounds(), { padding: [48, 48], maxZoom: 13 });
  }

  // ---------- Filtres : recherche texte + rôle, combinés ----------
  let activeRole = "all";

  function applyFilters() {
    const raw = searchEl.value.trim();
    const q = raw.toLocaleLowerCase("fr");
    const filtered = entries.filter(({ person: p, role }) =>
      (activeRole === "all" || role === activeRole) &&
      [p.prenom, p.nom, p.entreprise, p.adresse]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(q));
    cluster.clearLayers();
    cluster.addLayers(filtered.map((e) => e.marker));
    renderList(filtered, raw);
  }

  searchEl.addEventListener("input", applyFilters);

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      activeRole = chip.dataset.role;
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      applyFilters();
    });
  });
}

init();
