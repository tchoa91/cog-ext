/**
 * @file        main.js
 * @description Contrôleur principal du Popup. Orchestre la boucle de rafraîchissement,
 * gère la logique métier et fait le lien entre le DataStore et le Renderer.
 * @author      François Bacconnet <https://github.com/tchoa91>
 * @copyright   2026 François Bacconnet
 * @license     GPL-3.0
 * @version     2.1
 * @homepage    https://ext.tchoa.com
 * @see         https://github.com/tchoa91/cog-ext
 */

import {
  initRenderer,
  updateInterface,
  setOverlayState,
  toggleTheme,
} from "./renderer.js";

import { DataStore } from "./data-store.js";
import { UI_CONFIG, THRESHOLDS } from "./config.js";

// --- Raccourci i18n ---
const t = chrome.i18n.getMessage;

// --- 1. CONFIGURATION (L'intention d'affichage) ---

// Instanciation du Data Store
const store = new DataStore();

// --- 2. STATE & TIMING ---

// CONFIGURATION DES SEUILS (Warn = Orange, Alert = Rouge)

let tickCount = 0;
let lastTime = 0;

// Rythme de base : 5Hz (Fluidité des barres)
const UPDATE_INTERVAL = 200;
// Ratio : Le texte ne change qu'une fois sur 5 (soit 1Hz)
const TEXT_UPDATE_RATIO = 5;

let activeOverlayId = null;
let appUnit = "C";

// --- 3. INITIALISATION ---
document.addEventListener("DOMContentLoaded", async () => {
  // A. Paramètres et callbacks

  // ÉTAPE 1 : Chargement des Préférences (Bloquant pour éviter le flash)
  // On définit des défauts clairs ici.
  const defaultPrefs = { theme: "dark", unit: "C" };
  let prefs = defaultPrefs;

  try {
    const stored = await chrome.storage.local.get(["theme", "unit"]);
    // Fusionner avec les défauts au cas où une clé manque
    prefs = { ...defaultPrefs, ...stored };
  } catch (e) {
    console.warn("Erreur lecture storage, utilisation défauts", e);
  }

  // ÉTAPE 2 : Application de l'état initial
  // A. Thème (DOM pour CSS)
  document.body.setAttribute("data-theme", prefs.theme);
  // B. Unité (Variable JS pour calculs)
  appUnit = prefs.unit;

  // ÉTAPE 3 : Définition des Actions (Callbacks)
  const callbacks = {
    onOpen: async (cardId, event) => {
      const clickedEl = event ? event.currentTarget : null;
      if (activeOverlayId === cardId) {
        activeOverlayId = null;
        setOverlayState(false);
        return;
      }
      const config = getOverlayConfig(cardId);
      const isDynamic = config ? config.isDynamic : false;
      const title = config ? config.title : cardId.toUpperCase();

      if (!isDynamic) {
        // Pour Settings, on appelle maintenant avec le bon scope pour avoir la version
        const scope = cardId === "settings" ? "settings" : "cards";
        const staticData = await store.getSystemState(scope);

        // On passe activeOverlayId (cardId) pour générer le bon contenu
        const renderState = transformDataToRenderFormat(
          staticData,
          true,
          cardId,
        );

        // Pas besoin de merger l'overlay manuellement, transform... le fait si l'ID correspond
        updateInterface(renderState);
      }
      activeOverlayId = cardId;
      setOverlayState(true, { title: title }, { currentTarget: clickedEl });
      tickCount = TEXT_UPDATE_RATIO - 1;
    },

    onClose: () => {
      activeOverlayId = null;
      setOverlayState(false);
    },

    onThemeToggle: () => {
      // 1. Bascule
      const current = document.body.getAttribute("data-theme");
      const newTheme = current === "light" ? "dark" : "light";

      // 2. Appliquer
      toggleTheme(); // Fonction du renderer qui fait l'attribut

      // 3. Sauvegarder
      chrome.storage.local.set({ theme: newTheme });
    },

    onUnitToggle: () => {
      // 1. Bascule
      appUnit = appUnit === "C" ? "F" : "C";

      // 2. Sauvegarder
      chrome.storage.local.set({ unit: appUnit });

      // 3. Feedback : Le prochain tick (gameLoop) mettra à jour tous les textes
    },

    // Ouvre un nouvel onglet Chrome
    onLinkClick: (url) => {
      chrome.tabs.create({ url: url });
    },
  };

  // B. Démarrage Classique
  const initData = await store.getSystemState("cards");

  const runtimeConfig = {
    ...UI_CONFIG,
    cards: UI_CONFIG.cards.filter((card) => {
      if (card.id === "settings") return true;
      if (card.id === "os" || card.id === "chrome") return !!initData.system;
      return !!initData[card.id];
    }),
  };

  initRenderer(runtimeConfig, callbacks);

  const initialState = transformDataToRenderFormat(initData, true, null);
  updateInterface(initialState);

  requestAnimationFrame(gameLoop);
});

/**
 * LE RÉSOLVEUR : Transforme une donnée brute en format d'affichage pour un widget précis.
 * @param {String} itemId - L'ID de l'élément (ex: 'cpuLoadAverage')
 * @param {Object} data - L'objet de données COMPLET (pour accès croisé si besoin)
 * @param {Boolean} updateText - Si false, on ne génère pas les chaînes de caractères (perf)
 * @param {Boolean} isMonitor - Si true, formatage spécifique pour la TopBar
 */
function resolveWidgetData(itemId, data, updateText, isMonitor = false) {
  const res = {};
  const txt = (val) => (updateText ? val : undefined);

  // Fonctions locales (Scope limité pour clarté)
  const getLoadState = (val, thresholds, isRising = true) => {
    if (val == null) return "normal";
    if (isRising) {
      if (val >= thresholds.alert) return "alert";
      if (val >= thresholds.warn) return "warning";
    } else {
      if (val <= thresholds.alert) return "alert";
      if (val <= thresholds.warn) return "warning";
    }
    return "normal";
  };

  const fmtTemp = (val) => {
    if (val == null) return "--";
    return appUnit === "F"
      ? Math.round((val * 9) / 5 + 32) + "°F"
      : Math.round(val) + "°C";
  };

  // --- 1. CPU ---
  if (data.cpuUsage) {
    if (
      itemId === "cpu" ||
      itemId === "loadBar" ||
      itemId === "cpuLoadAverage"
    ) {
      res.value = data.cpuUsage.usagePct;
      res.display = txt(`${data.cpuUsage.usagePct}%`);
      if (isMonitor) {
        res.percent = data.cpuUsage.usagePct;
        res.label = res.display;
      }
      res.state = getLoadState(data.cpuUsage.usagePct, THRESHOLDS.cpu);
    }
    if (itemId === "cpuLoadList") {
      res.value = (data.cpuUsage.coresPct || []).map((c) => ({
        pct: c,
        state: getLoadState(c, THRESHOLDS.cpuCores),
      }));
    }
    if (itemId === "cpuArc") res.display = txt(data.cpuUsage.archName);
    if (itemId === "cpuName") res.display = txt(data.cpuUsage.model);
    if (itemId === "cpuFeatures") res.display = txt(data.cpuUsage.features);
  }

  // --- 2. CPU TEMP ---
  if (data.cpuTemp) {
    const t = data.cpuTemp.tempC;
    // Jauge calibrée sur 120°C max
    const tPct = t ? Math.min(Math.round((t / 120) * 100), 100) : 0;

    if (itemId === "tempBar" || itemId === "cpuTempAverage") {
      res.value = tPct;
      res.display = txt(fmtTemp(t));
      res.state = getLoadState(t, THRESHOLDS.temp);
    }
    if (itemId === "cpuTempList") {
      res.unitSymbol = appUnit === "F" ? "°F" : "°C";
      if (updateText && data.cpuTemp.zones) {
        res.value = data.cpuTemp.zones.map((z) =>
          appUnit === "F" ? Math.round((z * 9) / 5 + 32) : Math.round(z),
        );
      }
    }
  }

  // --- 3. MEMORY ---
  if (data.memory) {
    const total = data.memory.capacity;
    const used = total - data.memory.availableCapacity;
    const pct = Math.round((used / total) * 100);

    if (itemId === "mem" || itemId === "memBar") {
      res.value = pct;
      res.display = txt(`${pct}%`);
      res.state = getLoadState(pct, THRESHOLDS.memory);
      if (isMonitor) {
        res.percent = pct;
        res.label = res.display;
      }
    }
    if (itemId === "memtotal")
      res.display = txt((total / 1e9).toFixed(1) + " GB");
    if (itemId === "memUsed")
      res.display = txt((used / 1e9).toFixed(1) + " GB");
  }

  // --- 4. BATTERY ---
  if (data.battery) {
    const pct = Math.round(data.battery.level * 100);

    if (itemId === "batt" || itemId === "battBar") {
      res.display = txt(`${pct}%`);
      if (isMonitor) {
        res.percent = pct;
        res.label = res.display;
        res.icon = data.battery.charging ? "bolt" : "";
      }
      res.value = pct;
      res.state = getLoadState(pct, THRESHOLDS.battery, false); // false = Alerte si ça descend
    }
    if (itemId === "battStatus") {
      if (data.battery.charging) {
        res.display = txt(
          pct === 100 ? t("status_powered") : t("status_charging"),
        );
      } else {
        res.display = txt(t("status_on_battery"));
      }
    }

    // Logique Temps Restant
    if (itemId === "battTime") {
      let timeText = "--";
      let labelText = t("status_time_left");
      const seconds = data.battery.charging
        ? data.battery.chargingTime
        : data.battery.dischargingTime;

      if (data.battery.charging && pct === 100) {
        timeText = "";
        labelText = "";
      } else if (seconds && isFinite(seconds)) {
        const totalMins = Math.round(seconds / 60);
        labelText = data.battery.charging
          ? t("status_full_charge_in")
          : t("status_time_left");
        timeText =
          totalMins > 59
            ? `${Math.floor(totalMins / 60)}:${(totalMins % 60).toString().padStart(2, "0")}`
            : `${totalMins} min`;
      }
      res.display = txt(timeText);
      res.label = txt(labelText);
    }
  }

  // --- 5. NETWORK ---
  if (data.network) {
    if (itemId === "net") {
      // Monitor
      res.state = data.network.online ? "normal" : "alert";
      res.label = txt(data.network.online ? t("status_on") : t("status_off"));
    }
    if (itemId === "netStatus") {
      res.display = txt(
        data.network.online ? t("status_online") : t("status_offline"),
      );
      res.state = data.network.online ? "normal" : "alert";
    }
    if (itemId === "netIp")
      res.display = txt(data.network.ip || t("status_hidden"));
    if (itemId === "netLatency")
      res.display = txt(
        data.network.latency ? `${data.network.latency} ms` : "--",
      );
  }

  // --- 6. DISPLAY ---
  if (data.display) {
    const screens = data.display.screens || [];
    const prim = screens.find((s) => s.primary) ||
      screens[0] || { w: 0, h: 0, name: t("disp_unknown") };
    const primName = prim.internal ? t("disp_internal") : prim.name;
    const primRes = `${prim.w} x ${prim.h}`;

    if (itemId === "displayMain") res.display = txt(primName);
    if (itemId === "displayDef") res.display = txt(primRes);

    if (itemId === "primDisplay") res.display = txt(`${primName} : ${primRes}`);
    if (itemId === "otherDisplays") {
      const others = screens
        .filter((s) => !s.primary)
        .map((s) => {
          const name = s.internal
            ? t("disp_internal_short")
            : s.name || t("disp_unknown");
          return `${name} : ${s.w} x ${s.h}`;
        });
      if (others.length === 0) others.push(t("disp_none"));
      res.value = updateText ? others : undefined;
    }
    if (itemId === "gpu") res.display = txt(data.display.gpu);
  }

  // --- 7. SYSTEM (Chrome/OS) ---
  if (data.system) {
    if (itemId === "osName") res.display = txt(data.system.os || "ChromeOS");
    if (itemId === "osPlatform") res.display = txt(data.system.platform);
    if (itemId === "chromeVersion") res.display = txt(data.system.browserVer);
    if (itemId === "chromeLanguages") res.display = txt(data.system.languages);
    if (itemId === "chromeExtensions") {
      const raw = data.system.extensions;
      res.value = Array.isArray(raw) ? raw : [raw || t("disp_none")];
    }
    if (itemId === "appVersion") res.display = txt(data.system.appVersion);
  }

  // --- 8. STORAGE ---
  if (data.storage) {
    // Fonction utilitaire locale pour le formatage "disk"
    const formatDiskData = (disk) => {
      if (!disk) return { name: "N/A", info: "--" };

      const total = (disk.capacity / 1e9).toFixed(0) + " Go";
      let infoText = total;
      if (disk.availableCapacity !== null) {
        const free = (disk.availableCapacity / 1e9).toFixed(0) + " Go";
        infoText = `${free} ${t("label_free")} / ${total}`;
      }
      return {
        name: `${disk.name} (${disk.type})`,
        info: infoText,
      };
    };

    // Cas 1 : La Carte (Premier disque uniquement)
    if (itemId === "storageMain") {
      // On prend le premier disque dispo (interne ou externe)
      const firstDisk = data.storage[0];
      // Si aucun disque (ex: ChromeOS sans DD ext), on renvoie null pour masquer la carte
      // ou un placeholder si tu préfères. Ici on suit la logique "pas de disque = pas de carte"
      if (!firstDisk) return null;

      res.value = formatDiskData(firstDisk);
    }

    // Cas 2 : L'Overlay (Liste de tous les disques)
    if (itemId === "storageList") {
      res.value = data.storage.map(formatDiskData);
    }
  }

  // --- 9. SETTINGS ---
  if (itemId === "toggleTheme")
    res.value = document.body.getAttribute("data-theme") !== "light";
  if (itemId === "toggleUnit") res.value = appUnit === "F";

  return res;
}

// --- 4. TRANSFORMATEUR DE DONNÉES (Adapter / Mapper) ---
/**
 * Adapte les données du DataStore vers le format Renderer.
 * Gère les règles d'affichage et le "Throttle" (lissage du texte).
 * @param {Object} modulesData - L'objet 'modules' du paquet INIT ou UPDATE
 * @param {Boolean} updateText - Si false, on ne met pas à jour les textes (optimisation 5Hz)
 * @returns {Object} Objet d'état pour updateInterface()
 *
 * Orchestrateur principal de transformation.
 * VERSION CORRIGÉE : Plus de blocage strict. On tente de résoudre chaque widget.
 * Si l'API n'a pas encore répondu, resolveWidgetData renverra un objet vide
 * et le Renderer ne touchera pas au DOM (qui affichera "--" en attendant).
 */
function transformDataToRenderFormat(
  modulesData,
  updateText = true,
  activeOverlayId,
) {
  const state = {
    monitors: [],
    cards: [],
    overlay: null,
  };

  // --- A. MONITORS (Le Socle : Toujours présent) ---
  UI_CONFIG.monitors.forEach((monConfig) => {
    const data = resolveWidgetData(monConfig.id, modulesData, updateText, true);
    // Si resolveWidgetData renvoie des clés (value, display...), on ajoute.
    // Même si c'est vide, on peut l'envoyer, le renderer ignorera les champs manquants.
    if (data) {
      state.monitors.push({
        id: monConfig.id,
        ...data,
      });
    }
  });

  // --- B. LOGIQUE DE SCOPE (Overlay vs Dashboard) ---

  // 1. Détermine si un Overlay Dynamique est actif
  let targetOverlayConfig = null;
  if (activeOverlayId) {
    // On cherche d'abord dans les overlays explicites
    targetOverlayConfig = UI_CONFIG.overlays.find(
      (c) => c.id === activeOverlayId,
    );
    // Sinon, on vérifie si c'est une carte dynamique "agrandie"
    if (!targetOverlayConfig) {
      const cardConf = UI_CONFIG.cards.find((c) => c.id === activeOverlayId);
      if (cardConf && cardConf.isDynamic) targetOverlayConfig = cardConf;
    }
  }

  // CAS 1 : OVERLAY ACTIF (FOCUS)
  if (targetOverlayConfig) {
    state.overlay = {
      id: targetOverlayConfig.id,
      title: targetOverlayConfig.title,
      content: targetOverlayConfig.content.map((itemConfig) => {
        const itemData = resolveWidgetData(
          itemConfig.id,
          modulesData,
          updateText,
          false,
        );
        return { ...itemConfig, ...itemData };
      }),
      // On garde tout, même si vide, pour ne pas casser la structure visuelle
    };
  }

  // CAS 2 : DASHBOARD (GRILLE)
  else {
    UI_CONFIG.cards.forEach((cardConfig) => {
      const cardContent = cardConfig.content.map((itemConfig) => {
        const itemData = resolveWidgetData(
          itemConfig.id,
          modulesData,
          updateText,
          false,
        );
        return { ...itemConfig, ...itemData };
      });

      state.cards.push({
        id: cardConfig.id,
        content: cardContent,
      });
    });
  }

  return state;
}

// --- 5. BOUCLE PRINCIPALE ---
async function gameLoop(timestamp) {
  const deltaTime = timestamp - lastTime;

  if (deltaTime >= UPDATE_INTERVAL) {
    lastTime = timestamp;
    tickCount++; // On compte ce tick

    // Est-ce un tick "Majeur" (Texte + Barres) ou "Mineur" (Barres seules) ?
    // Si tickCount est un multiple de 5 (5, 10, 15...), updateText est vrai
    const updateText = tickCount % TEXT_UPDATE_RATIO === 0;

    // A. SCOPE (Inchangé)
    let scope = "cards";
    if (activeOverlayId) {
      const config = getOverlayConfig(activeOverlayId);
      // Si overlay dynamique -> focus dessus, sinon mode eco (monitors only)
      scope = config && config.isDynamic ? activeOverlayId : null;
    }

    // B. FETCH
    const sysData = await store.getSystemState(scope);

    // C. TRANSFORMATION
    // On passe le booléen basé sur le tickCount
    const renderState = transformDataToRenderFormat(
      sysData,
      updateText,
      activeOverlayId,
    );

    // D. RENDU
    updateInterface(renderState);
  }

  requestAnimationFrame(gameLoop);
}

// --- UTILITAIRES ---

/**
 * Récupère la config d'une carte/overlay par son ID.
 * Permet de savoir si c'est "isDynamic" ou non.
 */
function getOverlayConfig(cardId) {
  return (
    UI_CONFIG.overlays.find((c) => c.id === cardId) ||
    UI_CONFIG.cards.find((c) => c.id === cardId)
  );
}
