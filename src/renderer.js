// --- renderer.js ---
// Responsabilité : Gérer tout l'affichage et le DOM

// Constantes graphiques
const SVGS = {
  chevron: `<svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`,
  defaultIcon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`,
};

// === 1. CACHE DES ÉLÉMENTS DOM (Privé au module) ===
let topBarEl;
let gridEl;
let overlayEl;
let closeBtnEl; // Le bouton dans l'overlay

// === 2. FONCTION D'INITIALISATION EXPORTÉE ===
/**
 * Initialise le Renderer : trouve les éléments DOM, construit l'interface
 * initiale et met en place tous les écouteurs d'événements globaux/d'interface.
 * @param {Object} config - La configuration d'affichage (cartes, topBar).
 * @param {Object} callbacks - Les fonctions métier fournies par le contrôleur (main.js).
 */
export function initRenderer(config, callbacks) {
  // A. Peuplement du cache DOM
  gridEl = document.getElementById("dashboard-grid");
  topBarEl = document.getElementById("topbar");
  overlayEl = document.getElementById("overlay");
  closeBtnEl = document.getElementById("close-overlay");

  if (!gridEl || !topBarEl || !overlayEl || !closeBtnEl) {
    console.error(
      "Renderer: Un ou plusieurs éléments DOM requis sont manquants (grid, topbar, overlay, close-overlay)."
    );
    return;
  }

  // B. Construction de l'interface (utilise le cache maintenant)
  buildInterface(config, callbacks);

  // C. Activation des événements globaux
  setupGlobalEvents(callbacks);
}

// === 3. LOGIQUE ÉVÉNEMENTIELLE INTERNE ===
/**
 * Configure les écouteurs d'événements globaux (fermerture, thème).
 * Cette fonction est interne au renderer.
 * @param {Object} callbacks - Les fonctions métier (ex: onOpen) fournies par main.js.
 */
function setupGlobalEvents(callbacks) {
  // 1. Fermeture (Croix)
  closeBtnEl.addEventListener("click", () => {
    callbacks.onClose(); // "Main, l'utilisateur veut fermer"
  });

  // 2. Fermeture (Fond / Backdrop)
  overlayEl.addEventListener("click", (e) => {
    callbacks.onClose();
  });

  // 4. Thème (Double Clic)
  gridEl.addEventListener("dblclick", (e) => {
    if (e.target === gridEl) {
      // On prévient le main, c'est lui qui décidera d'appliquer ou non
      callbacks.onThemeToggle();
    }
  });
}

// La fonction toggleTheme reste ici pour faire le travail "sale" sur le DOM
// mais elle est pilotée par le main (ou appelée par lui).
export function toggleTheme() {
  const currentTheme = document.body.getAttribute("data-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";
  document.body.setAttribute("data-theme", newTheme);
}

/**
 * PHASE 1 : CONSTRUCTION (BUILD)
 * Appelée une seule fois au démarrage avec la config "en dur".
 */
export function buildInterface(config, callbacks) {
  // 1. Build TopBar
  // On crée les slots basés sur la config
  topBarEl.innerHTML = config.topBar
    .map(
      (item) => `
        <div class="monitor-block" id="monitor-${item.cardLink}" data-link="${item.cardLink}">
            <div class="monitor-header">
                <span class="monitor-label">${item.label}</span>
                <span class="monitor-val-text" data-bind="mainText">--</span>
            </div>
            <div class="monitor-bar-track">
                <div class="monitor-bar-fill" data-bind="barWidth" style="width: 0%"></div>
            </div>
        </div>
    `
    )
    .join("");

  // Events TopBar
  topBarEl.querySelectorAll(".monitor-block").forEach((el) => {
    el.addEventListener("click", () => callbacks.onOpen(el.dataset.link));
  });

  // 2. Build Grid
  gridEl.innerHTML = config.cards
    .map((card) => {
      return `
        <div class="card ${card.hasOvelay ? "interactive" : "static"}" 
            id="card-${card.id}" 
            data-id="${card.id}" 
            style="display: none;"> 
             
            <h3>${card.title}</h3>
            
            <div class="card-main-value" data-bind="mainText">--</div>
            
            <div class="card-icon">${SVGS.defaultIcon}</div>
            
            ${
              card.hasOvelay
                ? `<div class="card-watermark">${SVGS.chevron}</div>`
                : ""
            }
        </div>
        `;
    })
    .join("");

  // Events Grid
  gridEl.querySelectorAll(".card.interactive").forEach((el) => {
    el.addEventListener("click", (e) => callbacks.onOpen(el.dataset.id, e));
  });
}

/**
 * PHASE 2 : MISE A JOUR (UPDATE)
 * Appelée en boucle par le main.js
 */
export function updateInterface(dashboardState) {
  dashboardState.forEach((data) => {
    const cardEl = document.getElementById(`card-${data.id}`);
    if (!cardEl) return;

    // 1. Gestion Visibilité (Apparition au premier flux de données)
    if (cardEl.style.display === "none") {
      cardEl.style.display = "flex";
    }

    // 2. Mise à jour Barre (Haute fréquence)
    if (typeof data.barPercent !== "undefined") {
      const barEl = cardEl.querySelector('[data-bind="barWidth"]');
      if (barEl) barEl.style.width = `${data.barPercent}%`;

      // Synchro TopBar
      const monitorEl = document.getElementById(`monitor-${data.id}`);
      if (monitorEl) {
        const mBar = monitorEl.querySelector('[data-bind="barWidth"]');
        if (mBar) mBar.style.width = `${data.barPercent}%`;
      }
    }

    // 3. Mise à jour Texte (Throttle - Basse fréquence)
    if (data.forceTextUpdate) {
      const textEl = cardEl.querySelector('[data-bind="mainText"]');
      if (textEl) textEl.textContent = data.mainText;

      // Synchro TopBar
      const monitorEl = document.getElementById(`monitor-${data.id}`);
      if (monitorEl) {
        const mText = monitorEl.querySelector('[data-bind="mainText"]');
        if (mText) mText.textContent = data.mainText;
      }
    }
  });
}

/**
 * GESTION OVERLAY
 */
export function setOverlayState(isOpen, payload = {}, event = null) {
  const content = overlayEl.querySelector(".overlay-content");
  const titleEl = overlayEl.querySelector("#overlay-title");

  if (!isOpen) {
    overlayEl.classList.remove("active");
    setTimeout(() => {
      if (!overlayEl.classList.contains("active")) {
        overlayEl.classList.add("hidden");
      }
    }, 300);
    return;
  }

  const title = payload.title || "";

  // 1. Calcul de l'origine (Pop effect) avec hauteur DYNAMIQUE
  if (event && event.currentTarget) {
    // On récupère la hauteur réelle du topbar à l'instant T
    const topBarHeight = document.getElementById("topbar")?.offsetHeight || 0;

    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;

    // Ajustement dynamique
    if (centerY < topBarHeight) centerY = 0;
    else centerY = centerY - topBarHeight;

    overlayEl.style.transformOrigin = `${centerX}px ${centerY}px`;
  }

  // 2. Gestion Transition vs Ouverture (Reste inchangé)
  if (overlayEl.classList.contains("active")) {
    overlayEl.style.transition =
      "transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.1)";
    if (content) {
      content.style.transition = "opacity 0.15s ease";
      content.style.opacity = "0";
      setTimeout(() => {
        if (titleEl) titleEl.textContent = title;
        content.style.opacity = "1";
      }, 150);
    }
  } else {
    if (titleEl) titleEl.textContent = title;
    if (content) content.style.opacity = "1";
    overlayEl.classList.remove("hidden");
    void overlayEl.offsetWidth;
    overlayEl.classList.add("active");
  }
}
