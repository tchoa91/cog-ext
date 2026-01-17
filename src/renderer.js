/**
 * @file        renderer.js
 * @description Moteur de rendu (View). Gère exclusivement la manipulation du DOM,
 * les mises à jour visuelles optimisées (cache) et les événements UI.
 * @author      François Bacconnet <https://github.com/tchoa91>
 * @copyright   2026 François Bacconnet
 * @license     GPL-3.0
 * @version     2.0
 * @homepage    https://ext.tchoa.com
 * @see         https://github.com/tchoa91/cog-ext
 */

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
let appCallbacks = null;

// Optimisation : On mémorise les valeurs pour ne toucher le DOM que si nécessaire
const renderCache = {};

// === 2. INITIALISATION ===
export function initRenderer(config, callbacks) {
  appCallbacks = callbacks;
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
  overlayEl.addEventListener("click", (e) => {
    // CORRECTION : On ferme si on clique sur :
    // 1. Le backdrop extérieur (overlayEl)
    // 2. Le conteneur interne vide (overlay-content)
    // Mais on NE ferme PAS si e.target est un bouton, un texte, un switch, etc.
    if (
      e.target === overlayEl ||
      e.target.classList.contains("overlay-content")
    ) {
      callbacks.onClose();
    }
  });
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
      </div>`,
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
        </div>`,
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

// === 4. MISE A JOUR (UPDATE) ===
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
    const ov = payload.overlay;
    const overlayBody = document.getElementById("overlay-body");

    // 1. Construction de la structure (Uniquement si l'ID de l'overlay change)
    if (renderCache["activeOverlay"] !== ov.id) {
      overlayBody.innerHTML = ov.content
        .map((item) => {
          // Type: Barre horizontale (ex: Charge Moyenne)
          if (item.type === "olBar") {
            return `
            <div class="overlay-section">
                <div class="overlay-header-row">
                    <span class="overlay-label">${item.title || ""}</span>
                    <span class="overlay-val" data-oid="${item.id}-txt">--</span>
                </div>
                <div class="monitor-bar-track">
                    <div class="monitor-bar-fill" data-oid="${item.id}-bar" style="width: 0%"></div>
                </div>
            </div>`;
          }

          // Type: Liste de charge (ex: Coeurs CPU)
          if (item.type === "olLoadList") {
            return `
            <div class="overlay-section">
                <div style="margin-bottom:8px;" class="overlay-label">${item.title || ""}</div>
                <div class="overlay-cores-grid" data-oid="${item.id}-grid">
                     </div>
            </div>`;
          }

          // Type: Clé/Valeur (ex: Modèle, Architecture)
          if (item.type === "kv") {
            return `
             <div class="overlay-kv-row">
                <span class="overlay-kv-label">${item.title || ""}</span>
                <span class="overlay-kv-val" data-oid="${item.id}-txt">--</span>
             </div>`;
          }

          // Type: Liste Températures (olTempList)
          if (item.type === "olTempList") {
            return `
            <div class="overlay-section">
                <div style="margin-bottom:8px;" class="overlay-label">${item.title || ""}</div>
                <div class="overlay-temp-grid" data-oid="${item.id}-grid">
                     </div>
            </div>`;
          }

          // Type: Liste Disques/Partitions (olDiscsList)
          if (item.type === "olDiscsList") {
            return `
            <div class="overlay-section">
                <div style="margin-bottom:8px;" class="overlay-label">${item.title || ""}</div>
                <div class="overlay-discs-list" data-oid="${item.id}-list">
                     </div>
            </div>`;
          }

          // Type: Switch (Toggle)
          if (item.type === "switch") {
            return `
            <div class="overlay-switch-row">
                <span class="overlay-label">${item.title || ""}</span>
                <label class="switch">
                    <input type="checkbox" id="${item.id}" ${item.value ? "checked" : ""}>
                    <span class="slider"></span>
                </label>
            </div>`;
          }

          return "";
        })
        .join("");

      renderCache["activeOverlay"] = ov.id;

      // --- AJOUT : Attachement des événements dynamiques ---
      // On le fait ici car on vient de recréer le HTML de l'overlay
      const switches = overlayBody.querySelectorAll('input[type="checkbox"]');
      switches.forEach((cb) => {
        cb.addEventListener("change", (e) => {
          if (!appCallbacks) return;

          // Mapping ID -> Action
          if (e.target.id === "toggleTheme") {
            appCallbacks.onThemeToggle();
          }
          if (e.target.id === "toggleUnit") appCallbacks.onUnitToggle(); // Futur usage
        });
      });
    }

    // 2. Mise à jour des données (À chaque tick)
    ov.content.forEach((item) => {
      // Mise à jour Texte (commun à tous)
      if (item.display !== undefined) {
        const txtEl = overlayBody.querySelector(`[data-oid="${item.id}-txt"]`);
        if (txtEl) txtEl.textContent = item.display;
      }

      // Mise à jour Barre (olBar)
      if (item.type === "olBar" && item.value !== undefined) {
        const barEl = overlayBody.querySelector(`[data-oid="${item.id}-bar"]`);
        if (barEl) barEl.style.width = `${item.value}%`;
      }

      // Mise à jour Liste (olLoadList) - Gestion dynamique des enfants
      if (item.type === "olLoadList" && Array.isArray(item.value)) {
        const gridEl = overlayBody.querySelector(
          `[data-oid="${item.id}-grid"]`,
        );
        if (gridEl) {
          // Si le nombre de cœurs diffère (init), on recrée les barres
          if (gridEl.children.length !== item.value.length) {
            gridEl.innerHTML = item.value
              .map(
                () =>
                  `<div class="core-track">
                      <div class="core-fill" style="height: 0%"></div>
                   </div>`,
              )
              .join("");
          }
          // Mise à jour des hauteurs
          Array.from(gridEl.children).forEach((child, i) => {
            const fill = child.querySelector(".core-fill");
            if (fill) fill.style.height = `${item.value[i]}%`;
          });
        }
      }

      // Mise à jour Températures (olTempList)
      if (item.type === "olTempList" && Array.isArray(item.value)) {
        const gridEl = overlayBody.querySelector(
          `[data-oid="${item.id}-grid"]`,
        );
        const symbol = item.unitSymbol || "°C";
        // On vérifie si on doit redessiner (changement de nombre de zones ou premier rendu)
        if (gridEl) {
          // Astuce perf : On recrée le HTML car le nombre de zones est petit (<20)
          // et l'opération est légère.
          gridEl.innerHTML = item.value
            .map(
              (temp, i) => `
                <div class="temp-item">
                    <div class="temp-label">Zone ${i}</div>
                    <div class="temp-val">${temp}${symbol}</div>
                </div>
             `,
            )
            .join("");
        }
      }

      // Mise à jour Disques (olDiscsList)
      if (item.type === "olDiscsList" && Array.isArray(item.value)) {
        const listEl = overlayBody.querySelector(
          `[data-oid="${item.id}-list"]`,
        );
        if (listEl) {
          listEl.innerHTML = item.value
            .map((disk) => {
              // Calcul pourcentage simple (sécurité div par 0 incluse)
              const pct = disk.size
                ? Math.round(((disk.size - disk.free) / disk.size) * 100)
                : 0;

              return `
                 <div class="disk-item">
                    <div class="disk-header">
                        <span class="disk-name" title="${disk.label}">${disk.label || "Disk"}</span>
                        <span class="disk-stats">${((disk.size - disk.free) / 1e9).toFixed(1)} / ${(disk.size / 1e9).toFixed(0)} GB</span>
                    </div>
                    <div class="monitor-bar-track">
                        <div class="monitor-bar-fill" style="width: ${pct}%"></div>
                    </div>
                 </div>
                 `;
            })
            .join("");
        }
      }

      // Mise à jour Switch
      if (item.type === "switch" && item.value !== undefined) {
        const cb = overlayBody.querySelector(`#${item.id}`);
        if (cb && cb.checked !== item.value) {
          cb.checked = item.value;
        }
      }

      // Fin du 2. Mise à jour
    });
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
