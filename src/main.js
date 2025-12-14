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
  topBar: [
    { id: "cpu", label: "CPU", cardLink: "cpuUsage", hasOvelay: true },
    { id: "mem", label: "MEM", cardLink: "memory" },
    { id: "net", label: "NET", cardLink: "network" },
    { id: "batt", label: "BAT", cardLink: "battery" },
  ],
  cards: [
    {
      id: "cpuTemp",
      title: "CPU Temperature",
      hasOvelay: true,
      isDynamic: true,
    },
    { id: "memory", title: "Memory", isDynamic: true },
    { id: "cpuUsage", title: "CPU Load", hasOvelay: true, isDynamic: true },
    { id: "network", title: "Network", isDynamic: true },
    { id: "system", title: "System Identity", hasOvelay: true },
    { id: "battery", title: "Battery", isDynamic: true },
    { id: "display", title: "Display", hasOvelay: true, isDynamic: true },
    { id: "gpu", title: "Graphic Card" },
    { id: "storage", title: "Storage", hasOvelay: true, isDynamic: true },
    { id: "settings", title: "COGext - setting", hasOvelay: true },
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
    // CORRECTION : On garde la carte si elle a des données OU si c'est "settings"
    cards: UI_CONFIG.cards.filter(
      (card) => initData[card.id] || card.id === "settings"
    ),
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
 * Adapte les données brutes (v5.1) vers le format Renderer.
 */
function transformDataToRenderFormat(modulesData) {
  const renderList = [];

  Object.entries(modulesData).forEach(([id, rawData]) => {
    if (!rawData) return;

    let renderItem = {
      id: id,
      mainText: "--",
      barPercent: 0,
      forceTextUpdate: true,
    };

    // Mappage des nouvelles clés du DataStore v5.1
    switch (id) {
      case "cpuUsage":
        // rawData: { usagePct: 45, model: ... }
        if (rawData.usagePct !== undefined) {
          renderItem.mainText = `${rawData.usagePct}%`;
          renderItem.barPercent = rawData.usagePct;
        }
        break;

      case "memory":
        if (rawData.capacity && rawData.availableCapacity) {
          // 1. Calculs
          const usedBytes = rawData.capacity - rawData.availableCapacity;
          const pct = Math.round((usedBytes / rawData.capacity) * 100);

          // 2. Formatage pour l'affichage
          renderItem.mainText = `${pct}%`;
          renderItem.barPercent = pct;

          // Optionnel : Tu pourrais aussi formater les Gb ici pour un tooltip plus tard
          // renderItem.subText = (usedBytes / 1073741824).toFixed(1) + " GB";
        }
        break;

      case "battery":
        if (rawData.level !== undefined) {
          // Conversion 0.8 -> 80
          const pct = Math.round(rawData.level * 100);
          const statusIcon = rawData.charging ? "⚡" : "";

          renderItem.mainText = `${statusIcon}${pct}%`;
          renderItem.barPercent = pct;
        } else {
          renderItem.mainText = "--";
          renderItem.barPercent = 0;
        }
        break;

      case "network":
        // rawData: { online: true, ip: "82.124.xx.xx", type: "4g" }
        if (rawData.online) {
          // On affiche l'IP publique, c'est le plus informatif
          renderItem.mainText = rawData.ip || "Online";
          renderItem.barPercent = 100;
        } else {
          renderItem.mainText = "Offline";
          renderItem.barPercent = 0;
        }
        break;

      case "cpuTemp":
        // rawData: { tempC: 50 }
        if (rawData.tempC !== undefined) {
          renderItem.mainText = `${rawData.tempC}°C`;
          renderItem.barPercent = rawData.tempC;
        }
        break;

      case "gpu":
        // rawData: { model: 'Intel UHD' }
        if (rawData.model) renderItem.mainText = rawData.model;
        break;

      case "display":
        // rawData: { width: 1920, height: 1080 }
        if (rawData.width && rawData.height) {
          renderItem.mainText = `${rawData.width}x${rawData.height}`;
        }
        break;

      case "storage":
        // rawData: { name: 'Internal', usedBytes: ... }
        if (rawData.name) renderItem.mainText = rawData.name;
        // Note: On pourrait calculer un % ici avec usedBytes / totalBytes
        break;

      case "system":
        // rawData: { os: 'ChromeOS', browserVer: '120.0' ... }
        if (rawData.os) {
          renderItem.mainText = `${rawData.os} ${rawData.browserVer || ""}`;
        }
        break;

      default:
        renderItem.mainText = "N/A";
        break;
    }

    // 2. AJOUT MANUEL DES CARTES UI STATIQUES
    // Comme "settings" n'est pas dans modulesData, on l'ajoute explicitement ici.
    renderList.push({
      id: "settings",
      mainText: "Menu", // Ou une icône si vous préférez "⚙️"
      barPercent: 0, // Pas de barre
      forceTextUpdate: true,
    });

    renderList.push(renderItem);
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
