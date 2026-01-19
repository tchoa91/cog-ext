/**
 * @file        main.js
 * @description Contrôleur principal du Popup. Orchestre la boucle de rafraîchissement,
 * gère la logique métier et fait le lien entre le DataStore et le Renderer.
 * @author      François Bacconnet <https://github.com/tchoa91>
 * @copyright   2026 François Bacconnet
 * @license     GPL-3.0
 * @version     2.0
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

// --- 1. CONFIGURATION (L'intention d'affichage) ---

const UI_CONFIG = {
  monitors: [
    {
      id: "cpu",
      title: "CPU",
      cardLink: "cpuUsage",
      type: "bar",
      hasOvelay: true,
    },
    { id: "mem", title: "MEM", cardLink: "memory", type: "bar" },
    { id: "batt", title: "BAT", cardLink: "battery", type: "bar" },
    { id: "net", title: "NET", cardLink: "network", type: "dot" },
  ],
  cards: [
    {
      id: "cpuUsage",
      title: "CPU Load",
      hasOvelay: true,
      isDynamic: true,
      content: [{ id: "loadBar", type: "cardBar" }],
    },
    {
      id: "memory",
      title: "Memory",
      isDynamic: true,
      content: [
        { id: "memBar", type: "cardBar" },
        { id: "memtotal", type: "kv", title: "Total memory" },
        { id: "memUsed", type: "kv", title: "Used memory" },
      ],
    },
    {
      id: "cpuTemp",
      title: "CPU Temperature",
      hasOvelay: true,
      isDynamic: true,
      content: [{ id: "tempBar", type: "cardBar" }],
    },
    {
      id: "battery",
      title: "Battery",
      isDynamic: true,
      content: [
        { id: "battBar", type: "cardBar" },
        { id: "battStatus", type: "value" },
        {
          id: "battTime",
          type: "kv",
          title: "Time before full charge/discharge : ",
        },
      ],
    },
    {
      id: "display",
      title: "Display",
      hasOvelay: true,
      isDynamic: true,
      content: [
        { id: "displayMain", type: "value" },
        { id: "displayDef", type: "value" },
      ],
    },
    {
      id: "network",
      title: "Network",
      isDynamic: true,
      content: [
        { id: "netStatus", type: "value" },
        { id: "netIp", type: "kv", title: "IP : " },
      ],
    },
    {
      id: "chrome",
      title: "Chrome",
      hasOvelay: true,
      content: [{ id: "chromeVersion", type: "value" }],
    },
    {
      id: "os",
      title: "OS",
      content: [
        { id: "osName", type: "value" },
        { id: "osPlatform", type: "kv", title: "Platform : " },
      ],
    },
    {
      id: "storage",
      title: "Storage",
      hasOvelay: true,
      isDynamic: true,
      content: [
        { id: "storagePerc", type: "olBar", title: "% free space" },
        { id: "storageFree", type: "kv", title: "Free space" },
      ],
    },
    {
      id: "settings",
      title: "COGext - settings",
      hasOvelay: true,
      content: [{ id: "appVersion", type: "kv", title: "Version : " }],
    },
  ],
  overlays: [
    {
      id: "cpuUsage",
      title: "CPU Load details",
      isDynamic: true,
      content: [
        { id: "cpuLoadAverage", type: "olBar", title: "Average CPU Load" },
        { id: "cpuLoadList", type: "olLoadList", title: "CPU Load per core" },
        { id: "cpuArc", type: "kv", title: "CPU Architecture" },
        { id: "cpuName", type: "kv", title: "CPU Model" },
        { id: "cpuFeatures", type: "kv", title: "CPU Features" },
      ],
    },
    {
      id: "cpuTemp",
      title: "CPU Temperature details",
      isDynamic: true,
      content: [
        {
          id: "cpuTempAverage",
          type: "olBar",
          title: "Average CPU Temperature",
        },
        {
          id: "cpuTempList",
          type: "olTempList",
          title: "CPU Temperature per sensor",
        },
      ],
    },
    {
      id: "display",
      title: "Display details",
      isDynamic: true,
      content: [
        { id: "gpu", type: "kv", title: "GPU :" },
        { id: "primDisplay", type: "kv", title: "Primary Display" },
        { id: "otherDisplays", type: "olTextListv", title: "Other Displays" },
      ],
    },
    {
      id: "chrome",
      title: "Chrome details",
      content: [
        { id: "chromeVersion", type: "kv", title: "Version : " },
        { id: "chromeLanguages", type: "kv", title: "Languages :" },
        { id: "chromeExtensions", type: "kv", title: "Extensions :" },
      ],
    },
    {
      id: "storage",
      title: "Storage details",
      isDynamic: true,
      content: [
        { id: "storagePerc", type: "olBar", title: "% free space" },
        { id: "storageFree", type: "kv", title: "Free space" },
        { id: "storageTotal", type: "kv", title: "Total space" },
        { id: "storageList", type: "olDiscsList", title: "Discs :" },
      ],
    },
    {
      id: "settings",
      title: "COGext - settings",
      content: [
        { id: "appVersion", type: "kv", title: "Version :" },
        { id: "toggleTheme", type: "switch", title: "Dark/Light Theme" },
        { id: "toggleUnit", type: "switch", title: "Temperature Unit °C/°F" },
      ],
    },
  ],
};

// Instanciation du Data Store
const store = new DataStore();

// --- 2. STATE & TIMING ---

// CONFIGURATION DES SEUILS (Warn = Orange, Alert = Rouge)
const THRESHOLDS = {
  cpu: { warn: 70, alert: 90 }, // % Usage
  cpuCores: { warn: 60, alert: 85 },
  temp: { warn: 80, alert: 95 }, // °C
  memory: { warn: 81, alert: 96 }, // % Usage
  battery: { warn: 30, alert: 15 }, // % Restant (Sens inversé)
  storage: { warn: 90, alert: 95 }, // % Usage
};

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
    //console.log("💾 Config chargée :", prefs);
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
      //console.log("💾 Thème sauvegardé :", newTheme);
    },

    onUnitToggle: () => {
      // 1. Bascule
      appUnit = appUnit === "C" ? "F" : "C";

      // 2. Sauvegarder
      chrome.storage.local.set({ unit: appUnit });
      //console.log("💾 Unité sauvegardée :", appUnit);

      // 3. Feedback : Le prochain tick (gameLoop) mettra à jour tous les textes
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

// --- 4. TRANSFORMATEUR DE DONNÉES (Adapter / Mapper) ---
/**
 * Adapte les données du DataStore vers le format Renderer.
 * Gère les règles d'affichage et le "Throttle" (lissage du texte).
 * @param {Object} modulesData - L'objet 'modules' du paquet INIT ou UPDATE
 * @param {Boolean} updateText - Si false, on ne met pas à jour les textes (optimisation 5Hz)
 * @returns {Object} Objet d'état pour updateInterface()
 */
function transformDataToRenderFormat(
  modulesData,
  updateText = true,
  activeOverlayId,
) {
  // Structure stricte demandée
  const state = {
    monitors: [],
    cards: [],
    overlay: null,
  };

  // Helper pour le throttle du texte
  // Si updateText est false, on renvoie undefined, ce qui dit au Renderer "Touche pas au DOM"
  const txt = (val) => (updateText ? val : undefined);

  // --- Helper Formatage Température ---
  const fmtTemp = (val) => {
    if (val === null || val === undefined) return "--";
    if (appUnit === "F") {
      return Math.round((val * 9) / 5 + 32) + "°F";
    }
    return Math.round(val) + "°C";
  };

  // --- Helper de calcul d'état ---
  const getLoadState = (
    val,
    warnThreshold,
    alertThreshold,
    isRising = true,
  ) => {
    if (val === null || val === undefined) return "normal";
    if (isRising) {
      // Pour CPU, RAM, Temp : alerte si on DÉPASSE le seuil
      if (val >= alertThreshold) return "alert";
      if (val >= warnThreshold) return "warning";
      return "normal";
    } else {
      // Pour Batterie : alerte si on DESCEND SOUS le seuil
      if (val <= alertThreshold) return "alert";
      if (val <= warnThreshold) return "warning";
      return "normal";
    }
  };

  // --- 1. CPU (Usage & Temp) ---
  if (modulesData.cpuUsage) {
    const usage = modulesData.cpuUsage.usagePct;
    const cpuState = getLoadState(
      usage,
      THRESHOLDS.cpu.warn,
      THRESHOLDS.cpu.alert,
    );

    // A. MONITOR
    state.monitors.push({
      id: "cpu",
      label: txt(`${usage}%`), // Texte freiné
      percent: usage, // Barre fluide (5Hz)
      state: cpuState,
    });

    // B. OVERLAY DETECTED?
    if (activeOverlayId === "cpuUsage") {
      // Préparation des données pour les cœurs avec leur état individuel
      const coresData = (modulesData.cpuUsage.coresPct || []).map((c) => ({
        pct: c,
        state: getLoadState(
          c,
          THRESHOLDS.cpuCores.warn,
          THRESHOLDS.cpuCores.alert,
        ), // On réutilise ton helper
      }));
      state.overlay = {
        id: "cpuUsage",
        content: [
          {
            id: "cpuLoadAverage",
            type: "olBar", // Nécessaire pour le renderer
            title: "Average CPU Load", // Nécessaire pour le renderer
            value: usage,
            display: txt(`${usage}%`),
            state: cpuState,
          },
          {
            id: "cpuLoadList",
            type: "olLoadList",
            title: "CPU Load per core",
            value: coresData,
          },
          {
            id: "cpuArc",
            type: "kv",
            title: "CPU Architecture",
            display: modulesData.cpuUsage.archName,
          },
          {
            id: "cpuName",
            type: "kv",
            title: "CPU Model",
            display: modulesData.cpuUsage.model,
          },
          {
            id: "cpuFeatures",
            type: "kv",
            title: "CPU Features",
            display: modulesData.cpuUsage.features,
          },
        ],
      };
    }
    // C. CARD
    else if (!activeOverlayId) {
      state.cards.push({
        id: "cpuUsage",
        content: [
          {
            id: "loadBar",
            value: usage,
            display: txt(`${usage}%`),
            state: cpuState,
          },
        ],
      });
    }
  }

  // --- 1b. CPU TEMP ---
  if (modulesData.cpuTemp) {
    const temp = modulesData.cpuTemp.tempC;
    const displayStr = txt(fmtTemp(temp));
    const tempState = getLoadState(
      temp,
      THRESHOLDS.temp.warn,
      THRESHOLDS.temp.alert,
    );
    // Conversion sur une échelle de 120°C
    // Exemple : 60°C deviendra 50%
    const tempPct = Math.min(Math.round((temp / 120) * 100), 100);

    // Préparation des zones formatées (Conversion mathématique brute pour la liste)
    let zonesFormatted = undefined;
    if (updateText && modulesData.cpuTemp.zones) {
      zonesFormatted = modulesData.cpuTemp.zones.map((z) => {
        if (appUnit === "F") return Math.round((z * 9) / 5 + 32);
        return Math.round(z);
      });
    }

    if (activeOverlayId === "cpuTemp") {
      state.overlay = {
        id: "cpuTemp",
        content: [
          {
            id: "cpuTempAverage",
            type: "olBar",
            title: "Average CPU Temperature",
            value: tempPct,
            display: displayStr,
            state: tempState,
          },
          {
            id: "cpuTempList",
            type: "olTempList",
            unitSymbol: appUnit === "F" ? "°F" : "°C", // Info pour le renderer
            value: zonesFormatted,
          },
        ],
      };
    } else if (!activeOverlayId) {
      state.cards.push({
        id: "cpuTemp",
        content: [
          {
            id: "tempBar",
            value: tempPct,
            display: displayStr,
            state: tempState,
          },
        ],
      });
    }
  }

  // --- 2. MEMORY ---
  if (modulesData.memory) {
    const total = modulesData.memory.capacity;
    const available = modulesData.memory.availableCapacity;
    const used = total - available;
    const pct = Math.round((used / total) * 100);
    const memState = getLoadState(
      pct,
      THRESHOLDS.memory.warn,
      THRESHOLDS.memory.alert,
    );

    state.monitors.push({
      id: "mem",
      label: txt(`${pct}%`),
      percent: pct,
      state: memState,
    });

    if (!activeOverlayId) {
      state.cards.push({
        id: "memory",
        content: [
          {
            id: "memBar",
            value: pct,
            display: txt(`${pct}%`),
            state: memState,
          },
          { id: "memtotal", display: txt((total / 1e9).toFixed(1) + " GB") },
          { id: "memUsed", display: txt((used / 1e9).toFixed(1) + " GB") },
        ],
      });
    }
  }

  // --- 3. BATTERY ---
  if (modulesData.battery) {
    const pct = Math.round(modulesData.battery.level * 100);
    const isCharging = modulesData.battery.charging;
    const battState = getLoadState(
      pct,
      THRESHOLDS.battery.warn,
      THRESHOLDS.battery.alert,
      false,
    );

    state.monitors.push({
      id: "batt",
      label: txt(`${pct}%`),
      percent: pct,
      icon: isCharging ? "bolt" : "",
      state: battState,
    });

    // Logique Temps Restant / Charge
    let timeText = "--";
    let labelText = "Battery time left : ";
    const seconds = isCharging
      ? modulesData.battery.chargingTime
      : modulesData.battery.dischargingTime;

    if (isCharging && pct === 100) {
      timeText = "";
      labelText = "";
    } else if (seconds && isFinite(seconds)) {
      const totalMins = Math.round(seconds / 60);

      labelText = isCharging ? "Full charge in : " : "Battery time left : ";

      if (totalMins > 59) {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        timeText = `${h}:${m.toString().padStart(2, "0")}`;
      } else {
        timeText = `${totalMins} min`;
      }
    }

    if (!activeOverlayId) {
      state.cards.push({
        id: "battery",
        content: [
          {
            id: "battBar",
            value: pct,
            display: txt(`${pct}%`),
            state: battState,
          },
          {
            id: "battStatus",
            display: txt(isCharging ? "Charging" : "On battery"),
          },
          {
            id: "battTime",
            display: txt(timeText),
            label: txt(labelText),
          },
        ],
      });
    }
  }

  // --- 4. NETWORK ---
  if (modulesData.network) {
    const isOnline = modulesData.network.online;
    const netState = isOnline ? "normal" : "alert";

    state.monitors.push({
      id: "net",
      label: txt(isOnline ? "ON" : "OFF"),
      state: netState,
    });

    if (!activeOverlayId) {
      state.cards.push({
        id: "network",
        content: [
          {
            id: "netStatus",
            display: txt(isOnline ? "Online" : "Offline"),
            state: netState,
          },
          {
            id: "netIp",
            display: txt(modulesData.network.ip || "Hidden/Local"),
          },
        ],
      });
    }
  }

  // --- 5. STORAGE ---
  if (modulesData.storage) {
    // Calcul du % utilisé (commun overlay/card)
    const usedPct = modulesData.storage.totalBytes
      ? Math.round(
          (modulesData.storage.usedBytes / modulesData.storage.totalBytes) *
            100,
        )
      : 0;

    const storageState = getLoadState(
      usedPct,
      THRESHOLDS.storage.warn,
      THRESHOLDS.storage.alert,
    );

    // A. OVERLAY
    if (activeOverlayId === "storage") {
      state.overlay = {
        id: "storage",
        content: [
          {
            id: "storagePerc",
            type: "olBar",
            title: "% used space",
            value: usedPct,
            display: txt(`${usedPct}%`),
            state: storageState,
          },
          {
            id: "storageFree",
            type: "kv",
            display: txt(
              (
                (modulesData.storage.totalBytes -
                  modulesData.storage.usedBytes) /
                1e9
              ).toFixed(1) + " GB",
            ),
          },
          {
            id: "storageTotal",
            type: "kv",
            display: txt(
              (modulesData.storage.totalBytes / 1e9).toFixed(0) + " GB",
            ),
          },
          {
            id: "storageList",
            type: "olDiscsList",
            value: updateText ? modulesData.storage.partitions : undefined,
          },
        ],
      };
    }
    // B. CARD
    else if (!activeOverlayId) {
      const usedPct = modulesData.storage.totalBytes
        ? Math.round(
            (modulesData.storage.usedBytes / modulesData.storage.totalBytes) *
              100,
          )
        : 0;

      state.cards.push({
        id: "storage",
        content: [
          {
            id: "storagePerc",
            value: 100 - usedPct,
            display: txt(`${100 - usedPct}%`),
            state: storageState,
          },
          {
            id: "storageFree",
            display: txt(
              (
                (modulesData.storage.totalBytes -
                  modulesData.storage.usedBytes) /
                1e9
              ).toFixed(1) + " GB",
            ),
          },
        ],
      });
    }
  }

  // --- 6. DISPLAY ---
  if (modulesData.display) {
    // Récupération de l'écran principal (via la liste enrichie)
    const screens = modulesData.display.screens || [];
    const prim = screens.find((s) => s.primary) ||
      screens[0] || { w: 0, h: 0, internal: false, name: "Unknown" };

    // Logique de Nommage : "Internal Display" ou "Nom du Monitor"
    const primName = prim.internal ? "Internal Display" : prim.name;
    const primRes = `${prim.w} x ${prim.h}`;

    // A. MODE OVERLAY
    if (activeOverlayId === "display") {
      // Formatage des écrans secondaires : "Nom : W x H"
      const othersList = screens
        .filter((s) => !s.primary)
        .map((s) => {
          const n = s.internal ? "Internal" : s.name;
          return `${n} : ${s.w} x ${s.h}`;
        });

      // Gestion du cas "Aucun écran secondaire" pour la liste
      if (othersList.length === 0) othersList.push("None");

      state.overlay = {
        id: "display",
        content: [
          {
            id: "gpu",
            type: "kv",
            title: "GPU",
            display: txt(modulesData.display.gpu || "Unknown"),
          },
          {
            id: "primDisplay",
            type: "kv",
            title: "Primary Display",
            // Demande : Info complète (Nom + Résolution)
            display: txt(`${primName} : ${primRes}`),
          },
          {
            id: "otherDisplays",
            type: "olTextList",
            title: "Secondary Displays",
            value: updateText ? othersList : undefined,
          },
        ],
      };
    }
    // B. MODE CARTE
    else if (!activeOverlayId) {
      state.cards.push({
        id: "display",
        content: [
          {
            id: "displayMain",
            display: txt(primName),
          },
          {
            id: "displayDef",
            display: txt(primRes),
          },
        ],
      });
    }
  }

  // --- 7. SYSTEM / OS / CHROME ---
  if (modulesData.system) {
    if (!activeOverlayId) {
      state.cards.push({
        id: "os",
        content: [
          { id: "osName", display: txt(modulesData.system.os || "ChromeOS") },
          { id: "osPlatform", display: txt(modulesData.system.platform) },
        ],
      });

      state.cards.push({
        id: "chrome",
        content: [
          { id: "chromeVersion", display: txt(modulesData.system.browserVer) },
        ],
      });
    }

    if (activeOverlayId === "chrome") {
      state.overlay = {
        id: "chrome",
        content: [
          {
            id: "chromeVersion",
            type: "kv",
            title: "Version",
            display: txt(modulesData.system.browserVer),
          },
          {
            id: "chromeLanguages",
            type: "kv",
            title: "Languages",
            display: txt(modulesData.system.languages),
          },
          // CORRECTION : Utilisation du nouveau type liste
          {
            id: "chromeExtensions",
            type: "olTextList", // Nouveau type renderer
            title: "Active Extensions",
            value: modulesData.system.extensions, // On passe le tableau
          },
        ],
      };
    }
  }

  // --- 8. SETTINGS ---
  const ver =
    modulesData.system && modulesData.system.appVersion
      ? modulesData.system.appVersion
      : "unknown";

  // Lecture de l'état réel pour le switch Thème
  const currentTheme = document.body.getAttribute("data-theme") || "dark";

  if (activeOverlayId === "settings") {
    state.overlay = {
      id: "settings",
      content: [
        {
          id: "appVersion",
          type: "kv",
          title: "Version : ",
          display: txt(ver),
        },
        {
          id: "toggleTheme",
          type: "switch",
          title: "Dark/Light Theme",
          value: currentTheme === "dark", // Coché si Dark
        },
        {
          id: "toggleUnit",
          type: "switch",
          title: "Temperature Unit °F",
          value: appUnit === "F", // Coché si Fahrenheit
        },
      ],
    };
  } else if (!activeOverlayId) {
    state.cards.push({
      id: "settings",
      content: [{ id: "appVersion", display: txt(ver) }],
    });
  }

  /* if (activeOverlayId) {
    state.cards = [];
  } */

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

    // [DEBUG] Log complet du Payload envoyé au Renderer
    // Condition : Uniquement si un overlay est actif ET que c'est un tick de mise à jour du texte (1Hz)
    // Cela évite de spammer la console 60 fois par seconde tout en montrant l'objet complet.
    /* if (renderState.overlay && updateText) {
      console.log(
        `📦 [Main -> Renderer] Payload complet pour l'overlay "${activeOverlayId}" : `,
        renderState,
      );
    } */

    // D. RENDU
    updateInterface(renderState);
  }

  requestAnimationFrame(gameLoop);
}

// --- LOGIQUE MÉTIER  ---

function handleOverlayOpen(cardId, event) {
  setOverlayState(true, { title: title }, event);
}

function closeOverlay() {
  activeOverlayId = null;
  setOverlayState(false);
}

// --- UTILITAIRES ---

/**
 * Récupère la config d'une carte/overlay par son ID.
 * Permet de savoir si c'est "isDynamic" ou non.
 */
function getOverlayConfig(cardId) {
  // On regarde d'abord dans les overlays explicites
  let config = UI_CONFIG.overlays.find((c) => c.id === cardId);
  // Sinon dans les cartes (cas simple)
  if (!config) {
    config = UI_CONFIG.cards.find((c) => c.id === cardId);
  }
  return config;
}
