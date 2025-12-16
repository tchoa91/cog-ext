// --- src/main.js ---

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
        { id: "primDisplay", type: "kv", title: "Primary Display" },
        { id: "otherDisplays", type: "kv", title: "Other Displays" },
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
let tickCount = 0;
let lastTime = 0;
const UPDATE_INTERVAL = 1000; // 1 seconde (plus calme que 200ms pour commencer)
let activeOverlayId = null;

// --- 3. INITIALISATION (Le Flux que vous avez défini) ---
document.addEventListener("DOMContentLoaded", async () => {
  const callbacks = {
    // Signal d'ouverture
    onOpen: (cardId) => {
      // SI la carte cliquée est DÉJÀ celle active -> On ferme tout (Toggle off)
      if (activeOverlayId === cardId) {
        activeOverlayId = null;
        setOverlayState(false);
      }
      // SINON -> On ouvre la nouvelle (Toggle on / Switch)
      else {
        activeOverlayId = cardId;
        // Récupération dynamique du titre si possible, sinon ID
        const cardConfig = UI_CONFIG.cards.find((c) => c.id === cardId);
        const title = cardConfig ? cardConfig.title : cardId.toUpperCase();

        setOverlayState(true, { title: title });
      }
    },

    // Signal de fermeture explicite (croix ou fond)
    onClose: () => {
      activeOverlayId = null;
      setOverlayState(false);
    },

    // Signal de bascule de thème
    onThemeToggle: () => {
      // 1. On peut sauvegarder la pref ici (ex: localStorage)
      const newTheme =
        document.body.getAttribute("data-theme") === "light" ? "dark" : "light";
      console.log(`Main: Changement de thème vers ${newTheme}`);
      // 2. On ordonne au renderer d'appliquer le changement
      toggleTheme();
    },

    // Signal de changement d'unité (F/C)
    // (Sera appelé par un bouton dans l'overlay "Settings" par exemple)
    // onUnitToggle: () => {
    //   // Logique de changement d'unité dans le store...
    //   console.log("Main: Changement d'unité demandé");
    //   store.toggleTempUnit(); // Méthode hypothétique du store
    // },
  };

  const initData = await store.getSystemState("cards");
  console.log("📦 INIT:", initData);

  // B. Enrichissement de la config (Runtime)
  // On mappe les cartes UI vers les modules Data pour savoir si on active l'overlay
  const runtimeConfig = {
    ...UI_CONFIG,
    cards: UI_CONFIG.cards.filter((card) => {
      // 1. Cas spécial : Settings (toujours là)
      if (card.id === "settings") return true;

      // 2. Cas spécial : OS et Chrome dépendent du module "system"
      if (card.id === "os" || card.id === "chrome") {
        return !!initData.system;
      }

      // 3. Cas général : L'ID de la carte correspond à une clé de données (cpu, battery...)
      return !!initData[card.id];
    }),
  };

  // C. Construction Interface
  initRenderer(runtimeConfig, callbacks);

  // ÉTAPE 3 : Main injecte les datas initiales
  // On transforme le InitPacket en format compatible pour updateInterface
  const initialState = transformDataToRenderFormat(initData);
  console.log("📦 INIT_STATE:", initialState);

  updateInterface(initialState);

  // Démarrage de la boucle
  requestAnimationFrame(gameLoop);
});

// --- 4. TRANSFORMATEUR DE DONNÉES (Adapter / Mapper) ---
/**
 * Adapte les données du DataStore vers le format Renderer.
 * Gère les règles d'affichage (Title, Text, Percent, Barre, Spot...).
 * @param {Object} modulesData - L'objet 'modules' du paquet INIT ou UPDATE
 * @returns {Array} Liste d'objets d'état pour updateInterface()
 *
 * Adapte les données brutes (v5.1) vers le format Renderer.
 * Mappe les données du store vers les sous-éléments (loadBar, memVal, etc.).
 */
function transformDataToRenderFormat(modulesData) {
  // Structure stricte demandée
  const state = {
    monitors: [],
    cards: [],
    overlay: null, // Pour l'instant non utilisé dynamiquement, mais prêt
  };

  // 1. CPU
  if (modulesData.cpuUsage) {
    const usage = modulesData.cpuUsage.usagePct;
    // -> Monitor
    state.monitors.push({
      id: "cpu", // Correspond à l'ID dans UI_CONFIG.monitors
      label: `${usage}%`,
      percent: usage,
      state: usage > 80 ? "high" : "normal",
    });
    // -> Card
    state.cards.push({
      id: "cpuUsage",
      content: [{ id: "loadBar", value: usage, display: `${usage}%` }],
    });
  }

  // 2. MEMORY
  if (modulesData.memory) {
    const total = modulesData.memory.capacity;
    const used = total - modulesData.memory.availableCapacity;
    const pct = Math.round((used / total) * 100);

    // -> Monitor
    state.monitors.push({
      id: "mem",
      label: `${pct}%`,
      percent: pct,
      state: "normal",
    });
    // -> Card
    state.cards.push({
      id: "memory",
      content: [
        { id: "memBar", value: pct, display: `${pct}%` },
        { id: "memtotal", display: (total / 1073741824).toFixed(1) + " GB" },
        { id: "memUsed", display: (used / 1073741824).toFixed(1) + " GB" },
      ],
    });
  }

  // 3. BATTERY
  if (modulesData.battery) {
    const pct = Math.round(modulesData.battery.level * 100);
    const isCharging = modulesData.battery.charging;

    // -> Monitor
    state.monitors.push({
      id: "batt",
      label: `${pct}%`,
      percent: pct,
      icon: isCharging ? "bolt" : "", // On passera l'info d'icone ici
    });
    // -> Card
    let timeText = "--";
    if (isCharging && modulesData.battery.chargingTime > 0)
      timeText = `${Math.round(modulesData.battery.chargingTime / 60)} min`;
    else if (!isCharging && modulesData.battery.dischargingTime > 0)
      timeText = `${Math.round(modulesData.battery.dischargingTime / 60)} min`;

    state.cards.push({
      id: "battery",
      content: [
        { id: "battBar", value: pct, display: `${pct}%` },
        { id: "battStatus", display: isCharging ? "Charging" : "On battery" },
        { id: "battTime", display: timeText },
      ],
    });
  }

  // 4. NETWORK
  if (modulesData.network) {
    const isOnline = modulesData.network.online;
    // -> Monitor
    state.monitors.push({
      id: "net",
      label: isOnline ? "ON" : "OFF",
      state: isOnline ? "normal" : "warning",
    });
    // -> Card
    state.cards.push({
      id: "network",
      content: [
        { id: "netStatus", display: isOnline ? "Online" : "Offline" },
        { id: "netIp", display: modulesData.network.ip || "--" },
      ],
    });
  }

  // 5. Autres Cartes (CPU Temp, Display, Storage, etc.)
  // On remplit uniquement le tableau 'cards' pour ceux-là
  if (modulesData.cpuTemp && modulesData.cpuTemp.tempC) {
    state.cards.push({
      id: "cpuTemp",
      content: [
        {
          id: "tempBar",
          value: Math.round((modulesData.cpuTemp.tempC / 100) * 100),
          display: `${modulesData.cpuTemp.tempC}°C`,
        },
      ],
    });
  }

  if (modulesData.storage) {
    const usedPct = modulesData.storage.totalBytes
      ? Math.round(
          (modulesData.storage.usedBytes / modulesData.storage.totalBytes) * 100
        )
      : 0;
    state.cards.push({
      id: "storage",
      content: [
        { id: "storageMain", display: `${usedPct}%` },
        { id: "storageDef", display: modulesData.storage.name },
      ],
    });
  }

  if (modulesData.system) {
    state.cards.push({
      id: "os",
      content: [
        { id: "osName", display: modulesData.system.os || "ChromeOS" },
        { id: "osPlatform", display: modulesData.system.platform },
      ],
    });
    state.cards.push({
      id: "chrome",
      content: [
        { id: "chromeVersion", display: modulesData.system.browserVer },
      ],
    });
  }

  if (modulesData.display) {
    state.cards.push({
      id: "display",
      content: [
        {
          id: "displayMain",
          display: `${modulesData.display.width}x${modulesData.display.height}`,
        },
        { id: "displayDef", display: "Résolution principale" },
      ],
    });
  }

  // 7. SETTINGS (Carte Statique)
  state.cards.push({
    id: "settings",
    content: [{ id: "appVersion", display: "1.0.0" }],
  });

  return state;
}

// --- 5. BOUCLE PRINCIPALE ---
async function gameLoop(timestamp) {
  const deltaTime = timestamp - lastTime;

  if (deltaTime >= UPDATE_INTERVAL) {
    lastTime = timestamp;

    // 1. Récupération des données fraîches
    // On demande le scope "cards" pour mettre à jour les valeurs du dashboard
    // (ou null si vous voulez économiser des ressources et ne mettre à jour que le topbar)
    const sysData = await store.getSystemState("cards");

    // 2. Transformation
    const renderState = transformDataToRenderFormat(sysData);

    // 3. Envoi à la vue
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
