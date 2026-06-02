/**
 * @file        renderer.js
 * @description Moteur de rendu (View). Gère exclusivement la manipulation du DOM,
 * les mises à jour visuelles optimisées (cache) et les événements UI.
 * @author      François Bacconnet <https://github.com/tchoa91>
 * @copyright   2026 François Bacconnet
 * @license     GPL-3.0
 * @version     2.2
 * @homepage    https://ext.tchoa.com
 * @see         https://github.com/tchoa91/cog-ext
 */

// Constantes graphiques
const SVGS = {
  chevron: `<svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`,
};

// Raccourci i18n
const t = chrome.i18n.getMessage;

// === 1. CACHE & ÉTAT ===
let topBarEl;
let gridEl;
let overlayEl;
let closeBtnEl;
let alertEl;
let appCallbacks = null;
let lastFocusedElement = null;

// Throttling des alertes ARIA
let lastAlertText = "";
let lastAlertTime = 0;
const ALERT_THROTTLE = 15000; // 15 secondes

// Optimisation : On mémorise les valeurs pour ne toucher le DOM que si nécessaire
const cache = {
  monitors: {},
  cards: {},
  overlay: {},
  graphs: {},
  activeOverlayId: null,
  themeColor: null,
};

// === 2. INITIALISATION ===
export function initRenderer(config, callbacks) {
  appCallbacks = callbacks;
  gridEl = document.getElementById("dashboard-grid");
  topBarEl = document.getElementById("topbar");
  overlayEl = document.getElementById("overlay");
  closeBtnEl = document.getElementById("close-overlay");
  alertEl = document.getElementById("aria-alerts");

  if (!gridEl || !topBarEl || !overlayEl || !closeBtnEl) {
    console.error("Renderer: DOM manquant.");
    return;
  }

  // Accessibilité : Label localisé pour le bouton fermer
  closeBtnEl.setAttribute("aria-label", t("action_close") || "Close");

  buildInterface(config, callbacks);
  setupGlobalEvents(callbacks);
}

function setupGlobalEvents(callbacks) {
  closeBtnEl.addEventListener("click", () => callbacks.onClose());
  overlayEl.addEventListener("click", (e) => {
    // CORRECTION : On ferme si on clique sur :
    // 1. Le backdrop extérieur (overlayEl)
    // 2. Le conteneur interne vide (overlay-content)
    // 3. Le corps de l'overlay (overlay-body) s'il n'y a pas d'élément interactif en dessous
    if (
      e.target === overlayEl ||
      e.target.classList.contains("overlay-content") ||
      e.target.id === "overlay-body"
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
  cache.themeColor = null; // Invalidation du cache de couleur pour les canvas
}

/**
 * Applique le mode Mini (réduction de hauteur)
 * @param {Boolean} isMini
 */
export function setMiniMode(isMini) {
  const main = document.querySelector("main");
  if (isMini) {
    document.body.classList.add("mini-mode");
    if (main) {
      main.inert = true;
      main.setAttribute("aria-hidden", "true");
    }
  } else {
    document.body.classList.remove("mini-mode");
    if (main) {
      main.inert = false;
      main.removeAttribute("aria-hidden");
    }
  }
}

// === 3. CONSTRUCTION (BUILD) ===
function buildInterface(config, callbacks) {
  // TopBar
  const monitorsHtml = config.monitors
    .map((item) => {
      const linkedCard = config.cards.find((c) => c.id === item.cardLink);
      const ariaLabel = linkedCard ? linkedCard.title : item.title;
      return `
      <div class="monitor-block ${item.hasOvelay ? "interactive" : "static"}"
            id="monitor-${item.id}"
            data-link="${item.cardLink}"
            tabindex="${item.hasOvelay ? "0" : "-1"}"
            ${item.hasOvelay ? 'role="button"' : ""}
            aria-labelledby="mon-lbl-${item.id} mon-val-${item.id}"
            ${!item.hasOvelay ? 'style="cursor: default;"' : ""}>
          <div class="monitor-header" aria-hidden="true">
            <span class="monitor-label" id="mon-lbl-${item.id}" aria-label="${ariaLabel} :">${item.title}</span>
            <div>
                <span class="monitor-status-icon"></span>
                <span class="monitor-val-text" id="mon-val-${item.id}" aria-label="${t("val_na")}">N/A</span>
            </div>
          </div>
          ${
            item.type === "bar"
              ? `<div class="monitor-bar-track" aria-hidden="true"><div class="monitor-bar-fill"></div></div>`
              : ""
          }
          ${item.type === "dot" ? `<div class="monitor-dot" aria-hidden="true"></div>` : ""}
      </div>`;
    })
    .join("");

  topBarEl.innerHTML = `
    ${monitorsHtml}
    <button id="mini-toggle" class="mini-toggle" aria-label="${t("action_toggle_mini") || "Toggle Mini Mode"}" title="${t("action_toggle_mini") || "Toggle Mini Mode"}">
      ${SVGS.chevron}
    </button>
  `;

  // Écouteurs pour la TopBar
  topBarEl.querySelectorAll(".monitor-block.interactive").forEach((el) => {
    el.addEventListener("click", (e) => callbacks.onOpen(el.dataset.link, e));
    // 2. ACCESSIBILITÉ : Clavier (Entrée ou Espace)
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); // Empêche le scroll page avec Espace
        callbacks.onOpen(el.dataset.link, e);
      }
    });
  });

  // Écouteur pour le mini toggle
  document
    .getElementById("mini-toggle")
    .addEventListener("click", () => callbacks.onMiniToggle());

  // Grid
  gridEl.innerHTML = config.cards
    .map(
      (card) => `
        <div class="card ${card.hasOvelay ? "interactive" : "static"}"
            id="card-${card.id}"
            data-id="${card.id}"
            tabindex="${card.hasOvelay ? "0" : "-1"}"
            ${card.hasOvelay ? 'role="button"' : ""}
            aria-labelledby="card-title-${card.id} card-body-${card.id}"
            style="display: none;">
            <h3 id="card-title-${card.id}" aria-hidden="true">${card.title}<span class="sr-only"> :</span></h3>
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

// Utilitaires Accessibilité
function setAriaLabelForValue(el, value, state = "normal") {
  if (["N/A", "--", "-"].includes(value)) {
    el.setAttribute("aria-label", t("val_na") || "Not Available");
  } else {
    // On ajoute un préfixe selon l'état (Attention/Alerte)
    let prefix = "";
    if (state === "warning") prefix = t("status_warning") + ", ";
    else if (state === "alert") prefix = t("status_alert") + ", ";

    // On remet le point pour marquer la pause (demandé pour les cartes)
    // String(value) gère le cas où value est le chiffre 0
    const valStr = value !== null && value !== undefined ? String(value) : "";
    if (valStr) {
      el.setAttribute("aria-label", prefix + valStr + ". ");
    } else {
      el.removeAttribute("aria-label");
    }
  }
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
                <div class="card-bar-text" aria-label="${t("val_na")}">N/A</div>
            </div>`;
        case "value":
          return `<div class="card-main-value" data-el-id="${item.id}" aria-label="${t("val_na")}">N/A</div>`;
        case "kv":
          const lbl = item.title || "";
          return `<div class="card-kv-row">
                    <span class="kv-label" ${lbl ? `aria-label="${lbl}"` : ""}>${lbl}</span>
                    <span class="kv-value" data-el-id="${item.id}" aria-label="${t("val_na")}">N/A</span>
                  </div>`;
        case "disk":
          return `
            <div class="card-disk-row">
                <span class="disk-name" data-el-id="${item.id}-name" aria-label="${t("val_na")}">N/A</span>
                <span class="disk-info" data-el-id="${item.id}-info" aria-label="${t("val_na")}">N/A</span>
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
  // 0. GESTION DES ALERTES GLOBALES (ARIA Status)
  if (payload.globalAlert !== undefined && alertEl) {
    const now = Date.now();
    const hasChanged = payload.globalAlert !== lastAlertText;
    const isExpired = now - lastAlertTime > ALERT_THROTTLE;

    // On n'annonce que si :
    // 1. Il y a un message (pas tout vert)
    // 2. ET (le message a changé OU le délai de 15s est passé)
    if (payload.globalAlert && (hasChanged || isExpired)) {
      // Pour forcer l'annonce ARIA même si le texte est identique (isExpired),
      // certains lecteurs ont besoin d'un micro-changement ou d'un vidage.
      if (isExpired && !hasChanged) {
        alertEl.textContent = "";
        // Petit hack pour forcer le refresh dans le prochain cycle
        setTimeout(() => {
          if (alertEl) alertEl.textContent = payload.globalAlert;
        }, 50);
      } else {
        alertEl.textContent = payload.globalAlert;
      }
      lastAlertText = payload.globalAlert;
      lastAlertTime = now;
    } else if (!payload.globalAlert && lastAlertText) {
      // Tout est redevenu vert, on vide discrètement
      alertEl.textContent = "";
      lastAlertText = "";
    }
  }

  // A. GESTION DES MONITORS (TopBar)
  if (payload.monitors) {
    payload.monitors.forEach((mon) => {
      const el = document.getElementById(`monitor-${mon.id}`);
      if (!el) return;

      // 1. Texte (Label)
      if (mon.label !== undefined) {
        const key = `mon-${mon.id}-lbl`;
        if (cache.monitors[key] !== mon.label) {
          const textEl = el.querySelector(".monitor-val-text");
          if (textEl) {
            textEl.textContent = mon.label;
            if (mon.id === "net") {
              textEl.setAttribute(
                "aria-label",
                mon.state === "normal"
                  ? t("status_online")
                  : t("status_offline"),
              );
            } else {
              setAriaLabelForValue(textEl, mon.label, mon.state);
            }
          }
          cache.monitors[key] = mon.label;
        }
      }

      // 2. Barre (Percent)
      if (mon.percent !== undefined) {
        const key = `mon-${mon.id}-pct`;
        if (cache.monitors[key] !== mon.percent) {
          const barEl = el.querySelector(".monitor-bar-fill");
          if (barEl) barEl.style.transform = `scaleX(${mon.percent / 100})`;
          cache.monitors[key] = mon.percent;
        }
      }

      // 3. Icône (ex: Bolt pour batterie)
      // Note: mon.icon est soit "bolt", soit vide/undefined
      if (mon.icon !== undefined) {
        const key = `mon-${mon.id}-icon`;
        if (cache.monitors[key] !== mon.icon) {
          const iconEl = el.querySelector(".monitor-status-icon");
          if (iconEl) iconEl.innerHTML = mon.icon === "bolt" ? SVGS.bolt : "";
          cache.monitors[key] = mon.icon;
        }
      }

      // 4. État (Couleur / Warning)
      if (mon.state !== undefined) {
        const key = `mon-${mon.id}-state`;
        if (cache.monitors[key] !== mon.state) {
          el.setAttribute("data-state", mon.state);
          cache.monitors[key] = mon.state;
          // Si l'état change, on rafraîchit l'aria-label (sauf pour le réseau)
          if (mon.id !== "net") {
            const textEl = el.querySelector(".monitor-val-text");
            if (textEl)
              setAriaLabelForValue(textEl, textEl.textContent, mon.state);
          }
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
      if (!cache.cards[keyVis]) {
        if (getComputedStyle(cardEl).display === "none") {
          cardEl.style.display = "flex";
        }
        cache.cards[keyVis] = true;
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
            if (nameEl && cache.cards[`${item.id}-n`] !== item.value.name) {
              nameEl.textContent = item.value.name;
              nameEl.setAttribute(
                "aria-label",
                // item.value.name ? item.value.name + ", " : "",
                item.value.name,
              );
              cache.cards[`${item.id}-n`] = item.value.name;
            }
            // Update Info (Petit)
            if (infoEl && cache.cards[`${item.id}-i`] !== item.value.info) {
              infoEl.textContent = item.value.info;
              setAriaLabelForValue(infoEl, item.value.info);
              cache.cards[`${item.id}-i`] = item.value.info;
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
              cache.cards[keyState] !== item.state
            ) {
              targetEl.setAttribute("data-state", item.state);
              cache.cards[keyState] = item.state;
              // Si l'état change, on rafraîchit l'aria-label du texte
              const txt = targetEl.querySelector(".card-bar-text");
              if (txt) setAriaLabelForValue(txt, txt.textContent, item.state);
            }
            // Mise à jour de la barre
            if (
              item.value !== undefined &&
              cache.cards[keyVal] !== item.value
            ) {
              const bar = targetEl.querySelector(".monitor-bar-fill");
              if (bar) bar.style.transform = `scaleX(${item.value / 100})`;
              cache.cards[keyVal] = item.value;
            }
            // Mise à jour du texte à côté de la barre
            if (item.display && cache.cards[keyDisp] !== item.display) {
              const txt = targetEl.querySelector(".card-bar-text");
              if (txt) {
                txt.textContent = item.display;
                setAriaLabelForValue(txt, item.display, item.state);
              }
              cache.cards[keyDisp] = item.display;
            }
          }
          // Cas B : Valeur texte simple (kv ou value)
          else {
            const keyState = `item-${item.id}-state`;
            if (
              item.state !== undefined &&
              cache.cards[keyState] !== item.state
            ) {
              setAriaLabelForValue(targetEl, targetEl.textContent, item.state);
              cache.cards[keyState] = item.state;
            }

            // Mise à jour de la valeur principale
            if (
              item.display !== undefined &&
              cache.cards[keyDisp] !== item.display
            ) {
              targetEl.textContent = item.display;
              setAriaLabelForValue(targetEl, item.display, item.state);
              cache.cards[keyDisp] = item.display;
            }

            // Mise à jour du LABEL DYNAMIQUE
            if (
              item.label !== undefined &&
              cache.cards[keyLbl] !== item.label
            ) {
              if (targetEl.classList.contains("kv-value")) {
                // On cherche le label dans le parent car previousElementSibling peut être la ponctuation
                const labelEl =
                  targetEl.parentElement.querySelector(".kv-label");
                if (labelEl) {
                  labelEl.textContent = item.label;
                  labelEl.setAttribute(
                    "aria-label",
                    // item.label ? item.label + ", " : "",
                    item.label,
                  );
                  cache.cards[keyLbl] = item.label;
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
    if (cache.activeOverlayId !== ov.id) {
      // Invalidation du cache Overlay pour forcer la mise à jour du nouveau DOM
      cache.overlay = {};
      cache.activeOverlayId = ov.id;

      overlayBody.innerHTML = ov.content
        .map((item) => {
          // Type: Barre horizontale (ex: Charge Moyenne)
          if (item.type === "olBar") {
            return `
            <div class="overlay-section">
                <div class="overlay-header-row">
                    <span class="overlay-label">${item.title || ""}</span>
                    <span class="overlay-val" data-oid="${item.id}-txt">N/A</span>
                </div>
                <div class="monitor-bar-track">
                    <div class="monitor-bar-fill" data-oid="${item.id}-bar"></div>
                </div>
            </div>`;
          }

          // Type: Description sémantique (CPU)
          if (item.type === "olDesc") {
            return `<div class="overlay-desc" data-oid="${item.id}-txt"></div>`;
          }

          // Type: Liste de charge (ex: Coeurs CPU)
          if (item.type === "olLoadList") {
            return `
            <div class="overlay-section">
                <div style="margin-bottom:8px;" class="overlay-label">${item.title || ""}</div>
                <div class="overlay-cores-grid" data-oid="${item.id}-grid" role="img"></div>
            </div>`;
          }

          // Type: Clé/Valeur (ex: Modèle, Architecture)
          if (item.type === "kv") {
            const lbl = item.title || "";
            return `
             <div class="overlay-kv-row" aria-labelledby="ov-lbl-${item.id} ov-val-${item.id}">
                <span class="overlay-kv-label" id="ov-lbl-${item.id}" aria-hidden="true">${lbl}</span>
                <span class="overlay-kv-val" id="ov-val-${item.id}" data-oid="${item.id}-txt" aria-hidden="true">N/A</span>
             </div>`;
          }

          // Type: Liste Températures (olTempList)
          if (item.type === "olTempList") {
            return `
            <div class="overlay-section">
                <div style="margin-bottom:8px;" class="overlay-label">${item.title || ""}</div>
                <div class="overlay-temp-grid" data-oid="${item.id}-grid" role="img"></div>
            </div>`;
          }

          // Type: Liste textuelle simple (olTextList)
          if (item.type === "olTextList") {
            return `
            <div class="overlay-section">
                <div class="overlay-label" style="margin-bottom:5px;">${item.title || ""}</div>
                <div data-oid="${item.id}-list"></div>
            </div>`;
          }

          // Type : Liste de Disques (disk)
          if (item.type === "disk") {
            return `
            <div class="overlay-section">
                <div style="margin-bottom:8px;" class="overlay-label">${item.title || ""}</div>
                <div class="overlay-disk-list" data-oid="${item.id}-list"></div>
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
        if (cache.overlay[key] !== item.display) {
          const txtEl = overlayBody.querySelector(
            `[data-oid="${item.id}-txt"]`,
          );
          if (txtEl) {
            txtEl.textContent = item.display;
            setAriaLabelForValue(txtEl, item.display, item.state);
          }
          cache.overlay[key] = item.display;
        }
      }

      // Mise à jour Barre (olBar)
      if (item.type === "olBar" && item.value !== undefined) {
        const key = `ov-${item.id}-bar`;
        const currentVal = `${item.value}|${item.state || ""}`;
        if (cache.overlay[key] !== currentVal) {
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
              // Rafraîchissement de l'aria-label si l'état change
              const txtEl = sectionEl.querySelector(
                `[data-oid="${item.id}-txt"]`,
              );
              if (txtEl)
                setAriaLabelForValue(txtEl, txtEl.textContent, item.state);
            }
          }
          cache.overlay[key] = currentVal;
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
        if (listEl && cache.overlay[key] !== currentSig) {
          listEl.textContent = "";

          if (item.value.length === 0) {
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "overlay-disk-info"; // Réutilisation d'un style discret
            emptyDiv.style.padding = "5px 0";
            emptyDiv.style.textAlign = "right";
            emptyDiv.textContent = t("disp_none");
            listEl.appendChild(emptyDiv);
          } else {
            const ul = document.createElement("ul");
            ul.className = "overlay-text-list";
            const fragment = document.createDocumentFragment();

            item.value.forEach((line) => {
              const li = document.createElement("li");
              li.textContent = line;
              fragment.appendChild(li);
            });

            ul.appendChild(fragment);
            listEl.appendChild(ul);
          }
          cache.overlay[key] = currentSig;
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
              const state = typeof data === "object" ? data.state : "normal";
              let prefix = "";
              if (state === "warning") prefix = t("status_warning") + " ";
              else if (state === "alert") prefix = t("status_alert") + " ";
              return `${prefix}${pct}%`;
            })
            .join(", ");

          const keyLabel = `ov-${item.id}-aria`;
          if (cache.overlay[keyLabel] !== ariaLabel) {
            gridEl.setAttribute("aria-label", ariaLabel);
            cache.overlay[keyLabel] = ariaLabel;
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

            if (cache.overlay[key] !== currentVal) {
              const fill = child.querySelector(".core-fill");
              if (fill) {
                fill.style.transform = `scaleY(${pct / 100})`;
                if (state) fill.setAttribute("data-state", state);
                else fill.removeAttribute("data-state");
              }
              cache.overlay[key] = currentVal;
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
        if (cache.overlay[keyLabel] !== ariaLabel) {
          gridEl.setAttribute("aria-label", ariaLabel);
          cache.overlay[keyLabel] = ariaLabel;
        }

        const key = `ov-${item.id}-temps`;
        // On vérifie si les valeurs ont changé (join est rapide sur <20 items)
        const currentVal = item.value.join(",");

        // On vérifie si on doit redessiner (changement de nombre de zones ou premier rendu)
        if (gridEl && cache.overlay[key] !== currentVal) {
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
          cache.overlay[key] = currentVal;
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

        if (listEl && cache.overlay[key] !== currentSig) {
          // On génère la liste. Format identique à la carte mais en liste <li>
          listEl.textContent = "";
          const fragment = document.createDocumentFragment();
          item.value.forEach((disk) => {
            const container = document.createElement("div");
            container.className = "overlay-disk-item";

            const nameSpan = document.createElement("span");
            nameSpan.className = "disk-name";
            nameSpan.textContent = disk.name;

            const infoSpan = document.createElement("span");
            infoSpan.className = "disk-info";
            infoSpan.textContent = disk.info;

            container.appendChild(nameSpan);
            container.appendChild(infoSpan);
            fragment.appendChild(container);
          });
          listEl.appendChild(fragment);
          cache.overlay[key] = currentSig;
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
        if (cache.overlay[key] !== currentHue) {
          const swatches = overlayBody.querySelectorAll(".color-swatch");
          swatches.forEach((s) => {
            const sHue = parseInt(s.dataset.hue, 10);
            if (sHue === currentHue) s.classList.add("selected");
            else s.classList.remove("selected");
          });
          cache.overlay[key] = currentHue;
        }
      }

      // Fin du 2. Mise à jour
    });
  }
}

/**
 * Dessine une sparkline (graphique de ligne simple) sur un canvas.
 * Optimisation : Décalage de canvas + traçage incrémental.
 * Gère un historique de 61 valeurs (pour un pas de 3px sur 180px).
 */
function updateSparkline(canvas, id, value) {
  const cacheKey = `spark-${id}`;
  const historyLen = 61; // 60 intervalles de 3px = 180px
  const step = 3;

  if (!cache.graphs[cacheKey]) {
    cache.graphs[cacheKey] = new Array(historyLen).fill(0);
  }
  const history = cache.graphs[cacheKey];

  // Rotation FIFO
  const prevVal = history[history.length - 1];
  history.push(value);
  history.shift();

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  // Récupération de la couleur du thème (mise en cache)
  let themeChanged = false;
  if (!cache.themeColor) {
    const style = getComputedStyle(document.body);
    cache.themeColor = style.getPropertyValue("--text-muted") || "#888";
    themeChanged = true;
  }

  ctx.strokeStyle = cache.themeColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // LOGIQUE D'OPTIMISATION
  // Si le thème a changé, on doit tout redessiner pour changer la couleur
  if (themeChanged) {
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    history.forEach((val, i) => {
      const x = i * step;
      const y = h - (val / 100) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  } else {
    // Sinon, on décale et on ne trace que le dernier segment
    // 1. Décalage
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(canvas, -step, 0);
    ctx.globalCompositeOperation = "source-over";

    // 2. Nettoyage de la nouvelle zone
    ctx.clearRect(w - step, 0, step, h);

    // 3. Tracé du segment
    const x1 = w - step;
    const y1 = h - (prevVal / 100) * h;
    const x2 = w;
    const y2 = h - (value / 100) * h;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
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
        // IMPORTANT : On vide le cache Overlay lors de la fermeture
        cache.overlay = {};
        cache.activeOverlayId = null;
      }
    }, 300);
    if (lastFocusedElement) {
      const target = lastFocusedElement;
      // On attend que le navigateur ait bien retiré l'attribut 'inert' (Next Frame)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => target.focus());
      });
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
    // Double RAF pour s'assurer que la visibilité est appliquée dans l'arbre accessibilité
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlayEl.focus());
    });
  }
}
