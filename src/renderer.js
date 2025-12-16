// --- renderer.js ---
// Responsabilité : Gérer tout l'affichage et le DOM

// Constantes graphiques
const SVGS = {
  chevron: `<svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`,
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
  topBarEl.innerHTML = config.monitors
    .map((item) => {
      return `
      <div class="monitor-block ${item.hasOvelay ? "interactive" : "static"}" 
            id="monitor-${item.id}" 
            data-link="${item.cardLink}"
            ${!item.hasOvelay ? 'style="cursor: default;"' : ""}>
          <div class="monitor-header">
            <span class="monitor-label">${item.title}</span>
            <div>
                <span class="monitor-status-icon"></span>
                <span class="monitor-val-text">--</span>
            </div>
          </div>
          ${
            item.type === "bar"
              ? `<div class="monitor-bar-track">
                  <div class="monitor-bar-fill" style="width: 0%"></div>
                  </div>`
              : ""
          }
          ${item.type === "dot" ? `<div class="monitor-dot"></div>` : ""}
      </div>
  `;
    })
    .join("");

  // Events TopBar
  topBarEl.querySelectorAll(".monitor-block.interactive").forEach((el) => {
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
            
            <div class="card-body">
                ${renderCardContent(card.content)}
            </div>
            
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

function renderCardContent(contentItems) {
  if (!contentItems) return "";
  return contentItems
    .map((item) => {
      switch (item.type) {
        case "cardBar":
          return `
            <div class="card-bar-row" data-el-id="${item.id}">
                <div class="monitor-bar-track">
                    <div class="monitor-bar-fill" style="width: 0%"></div>
                </div>
                <div class="card-bar-text">--</div>
            </div>`;
        case "value":
          return `<div class="card-main-value" data-el-id="${item.id}">--</div>`;
        case "kv":
          return `<div class="card-kv-row">
                    <span class="kv-label">${item.title || ""}</span>
                    <span class="kv-value" data-el-id="${item.id}">--</span>
                  </div>`;
        default:
          return "";
      }
    })
    .join("");
}

/**
 * PHASE 2 : MISE A JOUR (UPDATE)
 * Appelée en boucle par le main.js avec le payload structuré
 */
export function updateInterface(payload) {
  // 1. GESTION DES MONITORS (TopBar)
  if (payload.monitors) {
    payload.monitors.forEach((mon) => {
      // Maintenant ça matche : mon.id="cpu" -> dom="monitor-cpu"
      const el = document.getElementById(`monitor-${mon.id}`);
      if (!el) return;

      // Texte
      const textEl = el.querySelector(".monitor-val-text");
      if (textEl && mon.label) textEl.textContent = mon.label;

      // Barre (si existe)
      const barEl = el.querySelector(".monitor-bar-fill");
      if (barEl && mon.percent !== undefined) {
        barEl.style.width = `${mon.percent}%`;
      }

      // Icone (ex: éclair)
      const iconEl = el.querySelector(".monitor-status-icon");
      if (iconEl) {
        iconEl.innerHTML = mon.icon === "bolt" ? SVGS.bolt : "";
      }

      // Classes d'état (ex: warning/normal)
      if (mon.state) {
        // Optionnel : gérer les couleurs via data-state
        el.setAttribute("data-state", mon.state);
      }
    });
  }

  // 2. GESTION DES CARDS (Grille)
  if (payload.cards) {
    payload.cards.forEach((card) => {
      const cardEl = document.getElementById(`card-${card.id}`);
      if (!cardEl) return;

      // Forcer l'affichage si c'était caché
      if (cardEl.style.display === "none") cardEl.style.display = "flex";

      if (card.content) {
        card.content.forEach((item) => {
          const targetEl = cardEl.querySelector(`[data-el-id="${item.id}"]`);
          if (!targetEl) return;

          // Cas A : Barre + Texte combinés
          if (targetEl.classList.contains("card-bar-row")) {
            const bar = targetEl.querySelector(".monitor-bar-fill");
            const txt = targetEl.querySelector(".card-bar-text");
            if (bar && item.value !== undefined)
              bar.style.width = `${item.value}%`;
            if (txt && item.display) txt.textContent = item.display;
          }
          // Cas B : Valeur texte simple
          else {
            if (item.display) targetEl.textContent = item.display;
          }
        });
      }
    });
  }

  // 3. GESTION OVERLAY (Si présent dans le payload)
  if (payload.overlay) {
    // Logique future pour mettre à jour l'overlay ouvert dynamiquement
  }
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
