// --- src/main.js ---

import {
  initRenderer,
  updateInterface,
  setOverlayState,
  toggleTheme,
} from "./renderer.js";

import { DataStore } from "./data-store.js"; // On importe le cerveau

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
        { id: "storageMain", type: "value" },
        { id: "storageDef", type: "value" },
      ],
    },
    {
      id: "settings",
      title: "COGext - settings",
      hasOvelay: true,
      content: [{ id: "appVersion", type: "kv", title: "Version : " }],
    },
  ],
  overlays: {
    cpuLoad: {
      title: "Détails CPU",
      content: [
        { type: "header", title: "Par Cœur" },
        { id: "coresList", type: "list", title: "Cœurs Logiques" },
      ],
    },
    settings: {
      title: "Configuration",
      content: [
        { type: "header", title: "Apparence" },
        { id: "toggleTheme", type: "button", title: "Mode Sombre/Clair" },
        { type: "header", title: "Système" },
        { id: "sysInfo", type: "kv", title: "OS" },
      ],
    },
    // Ajout d'une entrée vide pour les cartes sans config spécifique (fallback)
    // ou à définir au besoin.
  },
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
 * * @param {Object} modulesData - L'objet 'modules' du paquet INIT ou UPDATE
 * @returns {Array} Liste d'objets d'état pour updateInterface()
 *
 * Adapte les données brutes (v5.1) vers le format Renderer (Atomic Design).
 * Mappe les données du store vers les sous-éléments (loadBar, memVal, etc.).
 */
function transformDataToRenderFormat(modulesData) {
  const renderList = [];

  // 1. Traitement des modules de données dynamiques
  Object.entries(modulesData).forEach(([storeKey, rawData]) => {
    if (!rawData) return;

    // A. CPU USAGE (Aligné avec l'ID 'cpuUsage' désormais)
    if (storeKey === "cpuUsage") {
      const updates = {};
      if (rawData.usagePct !== undefined) {
        updates.loadBar = {
          perc: rawData.usagePct, // Valeur numérique pour la barre CSS (0-100)
          display: `${rawData.usagePct}%`, // Texte à afficher
        };
      }
      renderList.push({ id: "cpuUsage", updates });
    }

    // B. MEMORY
    else if (storeKey === "memory") {
      const updates = {};
      if (rawData.capacity && rawData.availableCapacity) {
        const usedBytes = rawData.capacity - rawData.availableCapacity;
        const pct = Math.round((usedBytes / rawData.capacity) * 100);

        updates.memBar = {
          perc: pct,
          display: `${pct}%`,
        };
        // Conversion basique en GB pour l'affichage KV
        updates.memtotal = (rawData.capacity / 1073741824).toFixed(1) + " GB";
        updates.memUsed = (usedBytes / 1073741824).toFixed(1) + " GB";
      }
      renderList.push({ id: "memory", updates });
    }

    // C. BATTERY
    else if (storeKey === "battery") {
      const updates = {};
      if (rawData.level !== undefined) {
        const pct = Math.round(rawData.level * 100);
        updates.battBar = {
          perc: pct,
          display: `${pct}%`,
        };
        updates.battStatus = rawData.charging ? "Charging" : "On battery";
        updates.isCharging = rawData.charging;

        // Formatage simple du temps restant
        if (rawData.chargingTime !== Infinity && rawData.chargingTime > 0) {
          updates.battTime = `${Math.round(
            rawData.chargingTime / 60
          )} min (Charge)`;
        } else if (
          rawData.dischargingTime !== Infinity &&
          rawData.dischargingTime > 0
        ) {
          updates.battTime = `${Math.round(
            rawData.dischargingTime / 60
          )} min (Restant)`;
        } else {
          updates.battTime = "--";
        }
      }
      renderList.push({ id: "battery", updates });
    }

    // D. NETWORK
    else if (storeKey === "network") {
      renderList.push({
        id: "network",
        updates: {
          netStatus: rawData.online ? "Online" : "Offline",
          isConnected: rawData.online,
          netIp: rawData.ip || "--",
        },
      });
    }

    // E. CPU TEMP
    else if (storeKey === "cpuTemp") {
      if (rawData.tempC !== undefined) {
        // Règle de 3 : 0 à 120°C -> 0 à 100%
        let barPct = Math.round((rawData.tempC / 120) * 100);
        // Sécurité : on borne à 100% max pour ne pas dépasser graphiquement
        if (barPct > 100) barPct = 100;

        renderList.push({
          id: "cpuTemp",
          updates: {
            tempBar: {
              perc: barPct, // La barre suit l'échelle 0-120
              display: `${rawData.tempC}°C`, // Le texte affiche la vraie température
            },
          },
        });
      }
    }

    // F. DISPLAY
    else if (storeKey === "display") {
      if (rawData.width && rawData.height) {
        renderList.push({
          id: "display",
          updates: {
            displayMain: `${rawData.width}x${rawData.height}`,
            displayDef: "Résolution principale",
          },
        });
      }
    }

    // G. STORAGE
    else if (storeKey === "storage") {
      if (rawData.name) {
        // Calcul d'un % d'usage si on a les données
        const usedPct = rawData.totalBytes
          ? Math.round((rawData.usedBytes / rawData.totalBytes) * 100)
          : 0;

        renderList.push({
          id: "storage",
          updates: {
            storageMain: `${usedPct}%`, // ou rawData.name
            storageDef: rawData.name, // ou "Utilisé"
            // Si vous aviez une barre dans la config storage, ce serait ici
          },
        });
      }
    }

    // H. SYSTEM (Cas spécial : alimente OS et CHROME)
    else if (storeKey === "system") {
      // Carte OS
      renderList.push({
        id: "os",
        updates: {
          osName: rawData.os || "ChromeOS",
          osPlatform: rawData.platform || "x86_64",
        },
      });

      // Carte Chrome
      renderList.push({
        id: "chrome",
        updates: {
          chromeVersion: rawData.browserVer || "Unknown",
        },
      });
    }
  });

  // 2. Ajout manuel pour les cartes sans source de données directe (Settings)
  renderList.push({
    id: "settings",
    updates: {
      appVersion: "1.0.0", // Valeur statique ou récupérée ailleurs
    },
  });

  return renderList;
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
