// Constantes graphiques
const SVGS = {
  chevron: `<svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`,
};

// === 1. CACHE & ÉTAT ===
let topBarEl;
let gridEl;
let overlayEl;
let closeBtnEl;

// Optimisation : On mémorise les valeurs pour ne toucher le DOM que si nécessaire
const renderCache = {};

// === 2. INITIALISATION ===
export function initRenderer(config, callbacks) {
  gridEl = document.getElementById("dashboard-grid");
  topBarEl = document.getElementById("topbar");
  overlayEl = document.getElementById("overlay");
  closeBtnEl = document.getElementById("close-overlay");

  if (!gridEl || !topBarEl || !overlayEl || !closeBtnEl) {
    console.error("Renderer: DOM manquant.");
    return;
  }

  buildInterface(config, callbacks);
  setupGlobalEvents(callbacks);
}

function setupGlobalEvents(callbacks) {
  closeBtnEl.addEventListener("click", () => callbacks.onClose());
  overlayEl.addEventListener("click", () => callbacks.onClose());
  gridEl.addEventListener("dblclick", (e) => {
    if (e.target === gridEl) callbacks.onThemeToggle();
  });
}

export function toggleTheme() {
  const currentTheme = document.body.getAttribute("data-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";
  document.body.setAttribute("data-theme", newTheme);
}

// === 3. CONSTRUCTION (BUILD) ===
export function buildInterface(config, callbacks) {
  // TopBar
  topBarEl.innerHTML = config.monitors
    .map(
      (item) => `
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
              ? `<div class="monitor-bar-track"><div class="monitor-bar-fill" style="width: 0%"></div></div>`
              : ""
          }
          ${item.type === "dot" ? `<div class="monitor-dot"></div>` : ""}
      </div>`
    )
    .join("");

  topBarEl.querySelectorAll(".monitor-block.interactive").forEach((el) => {
    el.addEventListener("click", () => callbacks.onOpen(el.dataset.link));
  });

  // Grid
  gridEl.innerHTML = config.cards
    .map(
      (card) => `
        <div class="card ${card.hasOvelay ? "interactive" : "static"}" 
            id="card-${card.id}" 
            data-id="${card.id}" 
            style="display: none;"> 
            <h3>${card.title}</h3>
            <div class="card-body">${renderCardContent(card.content)}</div>
            ${
              card.hasOvelay
                ? `<div class="card-watermark">${SVGS.chevron}</div>`
                : ""
            }
        </div>`
    )
    .join("");

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
                <div class="monitor-bar-track"><div class="monitor-bar-fill" style="width: 0%"></div></div>
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

// === 4. MISE A JOUR OPTIMISÉE (UPDATE) ===
export function updateInterface(payload) {
  // A. GESTION DES MONITORS (TopBar)
  if (payload.monitors) {
    payload.monitors.forEach((mon) => {
      const el = document.getElementById(`monitor-${mon.id}`);
      if (!el) return;

      // 1. Texte (Label)
      if (mon.label !== undefined) {
        const key = `mon-${mon.id}-lbl`;
        if (renderCache[key] !== mon.label) {
          const textEl = el.querySelector(".monitor-val-text");
          if (textEl) textEl.textContent = mon.label;
          renderCache[key] = mon.label;
        }
      }

      // 2. Barre (Percent)
      if (mon.percent !== undefined) {
        const key = `mon-${mon.id}-pct`;
        if (renderCache[key] !== mon.percent) {
          const barEl = el.querySelector(".monitor-bar-fill");
          if (barEl) barEl.style.width = `${mon.percent}%`;
          renderCache[key] = mon.percent;
        }
      }

      // 3. Icône (ex: Bolt pour batterie)
      // Note: mon.icon est soit "bolt", soit vide/undefined
      if (mon.icon !== undefined) {
        const key = `mon-${mon.id}-icon`;
        if (renderCache[key] !== mon.icon) {
          const iconEl = el.querySelector(".monitor-status-icon");
          if (iconEl) iconEl.innerHTML = mon.icon === "bolt" ? SVGS.bolt : "";
          renderCache[key] = mon.icon;
        }
      }

      // 4. État (Couleur / Warning)
      if (mon.state !== undefined) {
        const key = `mon-${mon.id}-state`;
        if (renderCache[key] !== mon.state) {
          el.setAttribute("data-state", mon.state);
          renderCache[key] = mon.state;
        }
      }
    });
  }

  // B. GESTION DES CARDS (Grille)
  if (payload.cards) {
    payload.cards.forEach((card) => {
      const cardEl = document.getElementById(`card-${card.id}`);
      if (!cardEl) return;

      // Affichage initial (si display: none)
      // On optimise aussi : on ne lit le style que si on ne l'a pas déjà marqué comme visible
      const keyVis = `card-${card.id}-vis`;
      if (!renderCache[keyVis]) {
        if (getComputedStyle(cardEl).display === "none") {
          cardEl.style.display = "flex";
        }
        renderCache[keyVis] = true;
      }

      if (card.content) {
        card.content.forEach((item) => {
          const targetEl = cardEl.querySelector(`[data-el-id="${item.id}"]`);
          if (!targetEl) return;

          // Clés de cache uniques basées sur l'ID de l'item
          const keyVal = `item-${item.id}-val`; // Pour la valeur (texte ou width)
          const keyDisp = `item-${item.id}-disp`; // Pour le texte affiché
          const keyLbl = `item-${item.id}-lbl`; // Pour le label dynamique

          // Cas A : Barre + Texte combinés (card-bar-row)
          if (targetEl.classList.contains("card-bar-row")) {
            // Mise à jour de la barre
            if (
              item.value !== undefined &&
              renderCache[keyVal] !== item.value
            ) {
              const bar = targetEl.querySelector(".monitor-bar-fill");
              if (bar) bar.style.width = `${item.value}%`;
              renderCache[keyVal] = item.value;
            }
            // Mise à jour du texte à côté de la barre
            if (item.display && renderCache[keyDisp] !== item.display) {
              const txt = targetEl.querySelector(".card-bar-text");
              if (txt) txt.textContent = item.display;
              renderCache[keyDisp] = item.display;
            }
          }
          // Cas B : Valeur texte simple (kv ou value)
          else {
            // Mise à jour de la valeur principale
            if (
              item.display !== undefined &&
              renderCache[keyDisp] !== item.display
            ) {
              targetEl.textContent = item.display;
              renderCache[keyDisp] = item.display;
            }

            // Mise à jour du LABEL DYNAMIQUE (Ta demande précédente)
            // On vérifie si un 'label' est fourni et s'il a changé
            if (
              item.label !== undefined &&
              renderCache[keyLbl] !== item.label
            ) {
              // On cherche le frère précédent qui est le label
              if (targetEl.classList.contains("kv-value")) {
                const labelEl = targetEl.previousElementSibling;
                if (labelEl && labelEl.classList.contains("kv-label")) {
                  labelEl.textContent = item.label;
                  renderCache[keyLbl] = item.label;
                }
              }
            }
          }
        });
      }
    });
  }

  // C. GESTION OVERLAY
  if (payload.overlay) {
    // Logique future pour l'overlay dynamique
  }
}

// === 5. GESTION OVERLAY (OUVERTURE/FERMETURE) ===
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

  if (event && event.currentTarget) {
    const topBarHeight = document.getElementById("topbar")?.offsetHeight || 0;
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;

    if (centerY < topBarHeight) centerY = 0;
    else centerY = centerY - topBarHeight;

    overlayEl.style.transformOrigin = `${centerX}px ${centerY}px`;
  }

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
    void overlayEl.offsetWidth; // Force reflow
    overlayEl.classList.add("active");
  }
}
