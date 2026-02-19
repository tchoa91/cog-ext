/**
 * @file        renderer.js
 * @description Moteur de rendu (View). Gère exclusivement la manipulation du DOM,
 * les mises à jour visuelles optimisées (cache) et les événements UI.
 * @author      François Bacconnet <https://github.com/tchoa91>
 * @copyright   2026 François Bacconnet
 * @license     GPL-3.0
 * @version     2.1
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
let lastFocusedElement = null;

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

  // Accessibilité : On retire le rôle sémantique (souvent <main>) de la grille
  // pour supprimer les annonces "Principal" / "Fin de principal" entre les cartes.
  gridEl.setAttribute("role", "none");

  // Configuration ARIA pour l'Overlay (Dialog Modal)
  overlayEl.setAttribute("role", "dialog");
  overlayEl.setAttribute("aria-modal", "true");
  overlayEl.setAttribute("aria-labelledby", "overlay-title");
  overlayEl.setAttribute("tabindex", "-1");
  overlayEl.style.outline = "none";

  // Accessibilité : Label localisé pour le bouton fermer
  closeBtnEl.setAttribute(
    "aria-label",
    chrome.i18n.getMessage("action_close") || "Close",
  );

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
  // Gestion des liens dans l'overlay (ex: Footer)
  const overlayBody = document.getElementById("overlay-body");
  if (overlayBody) {
    overlayBody.addEventListener("click", (e) => {
      // Si on clique sur un lien (ou un enfant de lien)
      const link = e.target.closest("a");
      if (link && link.href) {
        e.preventDefault(); // On bloque la navigation standard du popup
        callbacks.onLinkClick(link.href); // On délègue l'action au contrôleur
      }
    });
  }
}

export function toggleTheme() {
  const currentTheme = document.body.getAttribute("data-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";
  document.body.setAttribute("data-theme", newTheme);
}

// === 3. CONSTRUCTION (BUILD) ===
function buildInterface(config, callbacks) {
  // TopBar
  topBarEl.innerHTML = config.monitors
    .map(
      (item) => `
      <div class="monitor-block ${item.hasOvelay ? "interactive" : "static"}" 
            id="monitor-${item.id}" 
            data-link="${item.cardLink}"
            tabindex="${item.hasOvelay ? "0" : "-1"}" 
            ${item.hasOvelay ? 'role="button"' : ""}
            aria-labelledby="mon-lbl-${item.id} mon-pause-${item.id} mon-val-${item.id}"
            ${!item.hasOvelay ? 'style="cursor: default;"' : ""}>
          <div class="monitor-header" aria-hidden="true">
            <span class="monitor-label" id="mon-lbl-${item.id}">${item.title}</span>
            <div>
                <span class="monitor-status-icon"></span>
                <span class="monitor-val-text" id="mon-val-${item.id}">--</span>
            </div>
          </div>
          <span id="mon-pause-${item.id}" hidden>,</span>
          ${
            item.type === "bar"
              ? `<div class="monitor-bar-track" aria-hidden="true"><div class="monitor-bar-fill"></div></div>`
              : ""
          }
          ${item.type === "dot" ? `<div class="monitor-dot" aria-hidden="true"></div>` : ""}
      </div>`,
    )
    .join("");

  // Écouteurs pour la TopBar
  topBarEl.querySelectorAll(".monitor-block.interactive").forEach((el) => {
    el.addEventListener("click", () => callbacks.onOpen(el.dataset.link));
    // 2. ACCESSIBILITÉ : Clavier (Entrée ou Espace)
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); // Empêche le scroll page avec Espace
        callbacks.onOpen(el.dataset.link, e);
      }
    });
  });

  // Grid
  gridEl.innerHTML = config.cards
    .map(
      (card) => `
        <div class="card ${card.hasOvelay ? "interactive" : "static"}" 
            id="card-${card.id}"
            data-id="${card.id}"
            tabindex="${card.hasOvelay ? "0" : "-1"}"
            ${card.hasOvelay ? 'role="button"' : ""}
            aria-labelledby="card-title-${card.id} card-pause-${card.id} card-body-${card.id}"
            style="display: none;"> 
            <h3 id="card-title-${card.id}" aria-hidden="true">${card.title}</h3>
            <span id="card-pause-${card.id}" style="position:absolute; opacity:0; pointer-events:none;" aria-hidden="true">.</span>
            <div class="card-body" id="card-body-${card.id}" aria-hidden="true">${renderCardContent(card.content)}</div>
            ${
              card.hasOvelay
                ? `<div class="card-watermark" aria-hidden="true">${SVGS.chevron}</div>`
                : ""
            }
        </div>`,
    )
    .join("");

  gridEl.querySelectorAll(".card.interactive").forEach((el) => {
    el.addEventListener("click", (e) => callbacks.onOpen(el.dataset.id, e));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        callbacks.onOpen(el.dataset.id, e);
      }
    });
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
                <div class="monitor-bar-track"><div class="monitor-bar-fill"></div></div>
                <div class="card-bar-text">--</div>
            </div>`;
        case "value":
          return `<div class="card-main-value" data-el-id="${item.id}">--</div>`;
        case "kv":
          return `<div class="card-kv-row">
                    <span class="kv-label">${item.title || ""}</span>
                    <span class="kv-value" data-el-id="${item.id}">--</span>
                  </div>`;
        case "disk":
          return `
            <div class="card-disk-row">
                <span class="disk-name" data-el-id="${item.id}-name">--</span>
                <span class="disk-info" data-el-id="${item.id}-info">--</span>
            </div>`;
        case "sparkline":
          return `<canvas class="sparkline-canvas" data-el-id="${item.id}" width="180" height="40"></canvas>`;
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
          if (textEl) {
            textEl.textContent = mon.label;
            // Hack phonétique : "Onne" force la prononciation anglaise avec une voix française
            // car aria-labelledby ignore l'attribut lang="en".
            if (mon.label === "ON") textEl.setAttribute("aria-label", "Onne");
            else textEl.removeAttribute("aria-label");
          }
          renderCache[key] = mon.label;
        }
      }

      // 2. Barre (Percent)
      if (mon.percent !== undefined) {
        const key = `mon-${mon.id}-pct`;
        if (renderCache[key] !== mon.percent) {
          const barEl = el.querySelector(".monitor-bar-fill");
          if (barEl) barEl.style.transform = `scaleX(${mon.percent / 100})`;
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
          // --- 1. CAS SPÉCIAL : DISK (Composite) ---
          // Ce type n'a pas d'ID unique sur un conteneur, mais sur ses enfants (-name et -info)
          if (item.type === "disk") {
            if (!item.value) return;

            const nameEl = cardEl.querySelector(
              `[data-el-id="${item.id}-name"]`,
            );
            const infoEl = cardEl.querySelector(
              `[data-el-id="${item.id}-info"]`,
            );

            // Update Nom (Gros)
            if (nameEl && renderCache[`${item.id}-n`] !== item.value.name) {
              nameEl.textContent = item.value.name;
              renderCache[`${item.id}-n`] = item.value.name;
            }
            // Update Info (Petit)
            if (infoEl && renderCache[`${item.id}-i`] !== item.value.info) {
              infoEl.textContent = item.value.info;
              renderCache[`${item.id}-i`] = item.value.info;
            }
            return; // On a traité le disque, on passe à l'item suivant
          }

          // --- 2. CAS CLASSIQUES (Élément cible unique) ---
          // On cherche l'élément par son ID exact
          const targetEl = cardEl.querySelector(`[data-el-id="${item.id}"]`);
          if (!targetEl) return;

          // Clés de cache uniques basées sur l'ID de l'item
          const keyVal = `item-${item.id}-val`; // Pour la valeur (texte ou width)
          const keyDisp = `item-${item.id}-disp`; // Pour le texte affiché
          const keyLbl = `item-${item.id}-lbl`; // Pour le label dynamique

          // Cas S : Sparkline (Canvas)
          if (item.type === "sparkline" && item.value !== undefined) {
            updateSparkline(targetEl, item.id, item.value);
            return;
          }

          // Cas A : Barre + Texte combinés (card-bar-row)
          if (targetEl.classList.contains("card-bar-row")) {
            const keyState = `item-${item.id}-state`;
            if (
              item.state !== undefined &&
              renderCache[keyState] !== item.state
            ) {
              targetEl.setAttribute("data-state", item.state);
              renderCache[keyState] = item.state;
            }
            // Mise à jour de la barre
            if (
              item.value !== undefined &&
              renderCache[keyVal] !== item.value
            ) {
              const bar = targetEl.querySelector(".monitor-bar-fill");
              if (bar) bar.style.transform = `scaleX(${item.value / 100})`;
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

            // Mise à jour du LABEL DYNAMIQUE
            if (
              item.label !== undefined &&
              renderCache[keyLbl] !== item.label
            ) {
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
      // Invalidation du cache Overlay pour forcer la mise à jour du nouveau DOM
      Object.keys(renderCache).forEach((k) => {
        if (k.startsWith("ov-")) delete renderCache[k];
      });

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
                    <div class="monitor-bar-fill" data-oid="${item.id}-bar"></div>
                </div>
            </div>`;
          }

          // Type: Liste de charge (ex: Coeurs CPU)
          if (item.type === "olLoadList") {
            return `
            <div class="overlay-section">
                <div style="margin-bottom:8px;" class="overlay-label">${item.title || ""}</div>
                <div class="overlay-cores-grid" data-oid="${item.id}-grid" tabindex="0" role="img"></div>
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
                <div class="overlay-temp-grid" data-oid="${item.id}-grid" tabindex="0" role="img"></div>
            </div>`;
          }

          // Type: Liste textuelle simple (olTextList)
          if (item.type === "olTextList") {
            return `
            <div class="overlay-section">
                <div class="overlay-label" style="margin-bottom:5px;">${item.title || ""}</div>
                <ul class="overlay-text-list" data-oid="${item.id}-list"></ul>
            </div>`;
          }

          // Type : Liste de Disques (disk)
          if (item.type === "disk") {
            return `
            <div class="overlay-section">
                <div style="margin-bottom:8px;" class="overlay-label">${item.title || ""}</div>
                <ul class="overlay-disk-list" data-oid="${item.id}-list"></ul>
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

          // Type: Color Picker (Mood)
          if (item.type === "colorPicker") {
            return `
            <div class="overlay-color-row">
                <div class="overlay-label">${item.title || ""}</div>
                <div class="overlay-color-grid">
                  ${(item.options || [])
                    .map(
                      (opt) => `
                    <button class="color-swatch" 
                            data-hue="${opt.val}"
                            aria-label="${opt.label}"
                            title="${opt.label} : ${opt.val}"
                            style="background-color: hsl(${opt.val}, 60%, 50%);"></button>
                  `,
                    )
                    .join("")}
                </div>
            </div>`;
          }

          // Type HTML (Texte libre / Footer)
          if (item.type === "html") {
            return `<div class="overlay-html">${item.value || ""}</div>`;
          }

          return "";
        })
        .join("");

      renderCache["activeOverlay"] = ov.id;

      // --- Attachement des événements dynamiques ---
      const switches = overlayBody.querySelectorAll('input[type="checkbox"]');
      switches.forEach((cb) => {
        cb.addEventListener("change", (e) => {
          if (!appCallbacks) return;

          // Mapping ID -> Action
          if (e.target.id === "toggleTheme") {
            appCallbacks.onThemeToggle();
          }
          if (e.target.id === "toggleUnit") appCallbacks.onUnitToggle();
        });
        // 2. ACCESSIBILITÉ : Support de la touche "Entrée"
        // (La touche "Espace" est déjà gérée nativement par l'élément <input>)
        cb.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // On simule un clic : cela bascule la case et déclenche l'événement 'change' ci-dessus
            cb.click();
          }
        });
      });

      // --- Événements Color Picker ---
      const swatches = overlayBody.querySelectorAll(".color-swatch");
      swatches.forEach((swatch) => {
        const action = () => {
          if (!appCallbacks) return;
          const hue = parseInt(swatch.dataset.hue, 10);
          appCallbacks.onColorChange(hue);
        };

        swatch.addEventListener("click", action);
        swatch.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
          }
        });
      });
    }

    // 2. Mise à jour des données (À chaque tick)
    ov.content.forEach((item) => {
      // Mise à jour Texte (commun à tous)
      if (item.display !== undefined) {
        const key = `ov-${item.id}-txt`;
        if (renderCache[key] !== item.display) {
          const txtEl = overlayBody.querySelector(
            `[data-oid="${item.id}-txt"]`,
          );
          if (txtEl) txtEl.textContent = item.display;
          renderCache[key] = item.display;
        }
      }

      // Mise à jour Barre (olBar)
      if (item.type === "olBar" && item.value !== undefined) {
        const key = `ov-${item.id}-bar`;
        const currentVal = `${item.value}|${item.state || ""}`;
        if (renderCache[key] !== currentVal) {
          const barEl = overlayBody.querySelector(
            `[data-oid="${item.id}-bar"]`,
          );
          if (barEl) {
            barEl.style.transform = `scaleX(${item.value / 100})`;
            const sectionEl = barEl.closest(".overlay-section");
            if (sectionEl) {
              if (item.state) {
                sectionEl.setAttribute("data-state", item.state);
              } else {
                sectionEl.removeAttribute("data-state");
              }
            }
          }
          renderCache[key] = currentVal;
        }
      }

      // Mise à jour TextList (olTextList)
      if (item.type === "olTextList" && Array.isArray(item.value)) {
        const listEl = overlayBody.querySelector(
          `[data-oid="${item.id}-list"]`,
        );
        // On utilise une clé simple basée sur la longueur et le premier élément pour éviter de tout stringify
        const key = `ov-${item.id}-list`;
        const currentSig = item.value.length + (item.value[0] || "");
        if (listEl && renderCache[key] !== currentSig) {
          // CORRECTION SECURITE : Utilisation de textContent pour éviter l'injection HTML
          listEl.textContent = "";
          const fragment = document.createDocumentFragment(); // Optimisation : 1 seul reflow

          item.value.forEach((line) => {
            const li = document.createElement("li");
            li.textContent = line;
            fragment.appendChild(li);
          });

          listEl.appendChild(fragment);
          renderCache[key] = currentSig;
        }
      }

      // Mise à jour Liste (olLoadList) - Gestion dynamique des enfants
      if (item.type === "olLoadList" && Array.isArray(item.value)) {
        const gridEl = overlayBody.querySelector(
          `[data-oid="${item.id}-grid"]`,
        );
        if (gridEl) {
          // Accessibilité : On construit une phrase globale pour tout le groupe
          const ariaLabel = item.value
            .map((data) => {
              const pct = typeof data === "object" ? data.pct : data;
              return `${pct}%`;
            })
            .join(", ");

          const keyLabel = `ov-${item.id}-aria`;
          if (renderCache[keyLabel] !== ariaLabel) {
            gridEl.setAttribute("aria-label", ariaLabel);
            renderCache[keyLabel] = ariaLabel;
          }

          // Si le nombre de cœurs diffère (init), on recrée les barres
          if (gridEl.children.length !== item.value.length) {
            gridEl.textContent = "";
            const fragment = document.createDocumentFragment();
            item.value.forEach((_, i) => {
              const track = document.createElement("div");
              track.className = "core-track";
              // Accessibilité : On cache les enfants, c'est le conteneur qui parle
              track.setAttribute("aria-hidden", "true");

              const fill = document.createElement("div");
              fill.className = "core-fill";
              track.appendChild(fill);
              fragment.appendChild(track);
            });
            gridEl.appendChild(fragment);
          }
          // Mise à jour des hauteurs
          Array.from(gridEl.children).forEach((child, i) => {
            const data = item.value[i];
            const pct = typeof data === "object" ? data.pct : data;
            const state = typeof data === "object" ? data.state : undefined;

            const key = `ov-${item.id}-core-${i}`;
            const currentVal = `${pct}|${state || ""}`;

            if (renderCache[key] !== currentVal) {
              const fill = child.querySelector(".core-fill");
              if (fill) {
                fill.style.transform = `scaleY(${pct / 100})`;
                if (state) fill.setAttribute("data-state", state);
                else fill.removeAttribute("data-state");
              }
              renderCache[key] = currentVal;
            }
          });
        }
      }

      // Mise à jour Températures (olTempList)
      if (item.type === "olTempList" && Array.isArray(item.value)) {
        const gridEl = overlayBody.querySelector(
          `[data-oid="${item.id}-grid"]`,
        );
        const symbol = item.unitSymbol || "°C";

        // Accessibilité : Phrase globale pour les températures
        const ariaLabel = item.value
          .map((temp) => `${temp}${symbol}`)
          .join(", ");
        const keyLabel = `ov-${item.id}-aria`;
        if (renderCache[keyLabel] !== ariaLabel) {
          gridEl.setAttribute("aria-label", ariaLabel);
          renderCache[keyLabel] = ariaLabel;
        }

        const key = `ov-${item.id}-temps`;
        // On vérifie si les valeurs ont changé (join est rapide sur <20 items)
        const currentVal = item.value.join(",");

        // On vérifie si on doit redessiner (changement de nombre de zones ou premier rendu)
        if (gridEl && renderCache[key] !== currentVal) {
          // Astuce perf : On recrée le HTML car le nombre de zones est petit (<20)
          // et l'opération est légère.
          gridEl.textContent = "";
          const fragment = document.createDocumentFragment();
          item.value.forEach((temp, i) => {
            const itemEl = document.createElement("div");
            itemEl.className = "temp-item";
            // Accessibilité : On cache les enfants
            itemEl.setAttribute("aria-hidden", "true");

            const labelEl = document.createElement("div");
            labelEl.className = "temp-label";
            labelEl.textContent = `Zone ${i}`;
            labelEl.setAttribute("aria-hidden", "true");
            const valEl = document.createElement("div");
            valEl.className = "temp-val";
            valEl.textContent = `${temp}${symbol}`;
            valEl.setAttribute("aria-hidden", "true");

            itemEl.appendChild(labelEl);
            itemEl.appendChild(valEl);
            fragment.appendChild(itemEl);
          });
          gridEl.appendChild(fragment);
          renderCache[key] = currentVal;
        }
      }

      // MISE À JOUR DISK LIST
      if (item.type === "disk" && Array.isArray(item.value)) {
        const listEl = overlayBody.querySelector(
          `[data-oid="${item.id}-list"]`,
        );
        const key = `ov-${item.id}-disks`;
        // Signature simple : nombre de disques + espace libre du premier
        const currentSig = item.value.length + (item.value[0]?.info || "");

        if (listEl && renderCache[key] !== currentSig) {
          // On génère la liste. Format identique à la carte mais en liste <li>
          listEl.textContent = "";
          const fragment = document.createDocumentFragment();
          item.value.forEach((disk) => {
            const li = document.createElement("li");
            li.className = "overlay-disk-item";

            const nameSpan = document.createElement("span");
            nameSpan.className = "disk-name";
            nameSpan.textContent = disk.name;

            const infoSpan = document.createElement("span");
            infoSpan.className = "disk-info";
            infoSpan.textContent = disk.info;

            li.appendChild(nameSpan);
            li.appendChild(infoSpan);
            fragment.appendChild(li);
          });
          listEl.appendChild(fragment);
          renderCache[key] = currentSig;
        }
      }

      // Mise à jour Switch
      if (item.type === "switch" && item.value !== undefined) {
        const cb = overlayBody.querySelector(`#${item.id}`);
        if (cb && cb.checked !== item.value) {
          cb.checked = item.value;
        }
      }

      // Mise à jour Color Picker (Selection active)
      if (item.type === "colorPicker" && item.value !== undefined) {
        const currentHue = item.value;
        // On utilise une clé simple pour éviter de scanner le DOM à chaque frame
        const key = `ov-${item.id}-hue`;
        if (renderCache[key] !== currentHue) {
          const swatches = overlayBody.querySelectorAll(".color-swatch");
          swatches.forEach((s) => {
            const sHue = parseInt(s.dataset.hue, 10);
            if (sHue === currentHue) s.classList.add("selected");
            else s.classList.remove("selected");
          });
          renderCache[key] = currentHue;
        }
      }

      // Fin du 2. Mise à jour
    });
  }
}

/**
 * Dessine une sparkline (graphique de ligne simple) sur un canvas.
 * Gère un historique de 50 valeurs.
 */
function updateSparkline(canvas, id, value) {
  // 1. Gestion de l'historique dans le cache
  const cacheKey = `spark-${id}`;
  if (!renderCache[cacheKey]) {
    // Initialisation avec des zéros pour éviter un graph vide au début
    renderCache[cacheKey] = new Array(50).fill(0);
  }
  const history = renderCache[cacheKey];

  // Rotation FIFO
  history.push(value);
  history.shift();

  // 2. Dessin
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  // Nettoyage (Fond transparent)
  ctx.clearRect(0, 0, w, h);

  // Récupération de la couleur du thème (muted_text)
  const style = getComputedStyle(document.body);
  ctx.strokeStyle = style.getPropertyValue("--text-muted") || "#888";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";

  ctx.beginPath();
  const step = w / (history.length - 1);
  history.forEach((val, i) => {
    const y = h - (val / 100) * h; // 100% en haut (y=0), 0% en bas (y=h)
    if (i === 0) ctx.moveTo(i * step, y);
    else ctx.lineTo(i * step, y);
  });
  ctx.stroke();
}

// === 5. GESTION OVERLAY (OUVERTURE/FERMETURE) ===
export function setOverlayState(isOpen, payload = {}, event = null) {
  const content = overlayEl.querySelector(".overlay-content");
  const titleEl = overlayEl.querySelector("#overlay-title");
  const toggleBackgroundAccess = (disable) => {
    if (gridEl) gridEl.inert = disable;
  };

  if (!isOpen) {
    toggleBackgroundAccess(false); // 1. On réactive le fond
    overlayEl.classList.remove("active");
    setTimeout(() => {
      if (!overlayEl.classList.contains("active")) {
        const overlayBody = document.getElementById("overlay-body");
        if (overlayBody) overlayBody.innerHTML = "";
        // IMPORTANT : On force le renderer à reconstruire le DOM au prochain appel
        // (renderCache est la variable globale définie en haut du fichier)
        renderCache["activeOverlay"] = null;
      }
    }, 300);
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
    return;
  }

  // LOGIQUE D'OUVERTURE
  if (event && event.currentTarget) {
    lastFocusedElement = event.currentTarget;
  }
  toggleBackgroundAccess(true); // 1. On désactive le fond

  const title = payload.title || "";

  if (event && event.currentTarget) {
    const topBarHeight = topBarEl?.offsetHeight || 0;
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;

    if (centerY < topBarHeight) centerY = 0;
    else centerY = centerY - topBarHeight;

    overlayEl.style.transformOrigin = `${centerX}px ${centerY}px`;
  }

  if (overlayEl.classList.contains("active")) {
    if (content) {
      content.style.opacity = "0";
      setTimeout(() => {
        if (titleEl) titleEl.textContent = title;
        content.style.opacity = "1";
      }, 150);
    }
  } else {
    if (titleEl) titleEl.textContent = title;
    if (content) content.style.opacity = "1";
    void overlayEl.offsetWidth; // Force reflow
    overlayEl.classList.add("active");
    // On focus le conteneur (Dialog) pour déclencher l'annonce du Titre + Rôle
    setTimeout(() => {
      overlayEl.focus();
    }, 50);
  }
}
