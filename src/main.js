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
    { id: "cpu", label: "CPU", cardLink: "cpuUsage" },
    { id: "mem", label: "MEM", cardLink: "memory" },
    { id: "net", label: "NET", cardLink: "network" },
    { id: "batt", label: "BAT", cardLink: "battery" },
  ],
  cards: [
    { id: "cpuTemp", title: "CPU Temperature" },
    { id: "system", title: "System Identity" },
    { id: "cpuUsage", title: "Processor" },
    { id: "network", title: "Network" },
    { id: "memory", title: "Memory" },
    { id: "gpu", title: "Graphic Card" },
    { id: "battery", title: "Battery" },
    { id: "display", title: "Display" },
    { id: "storage", title: "Storage" },
    { id: "settings", title: "COGext - setting" },
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
document.addEventListener("DOMContentLoaded", () => {
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
    onUnitToggle: () => {
      // Logique de changement d'unité dans le store...
      console.log("Main: Changement d'unité demandé");
      store.toggleTempUnit(); // Méthode hypothétique du store
    },
  };

  const initPacket = store.getInitPacket();
  //console.log("📦 INIT:", initPacket);

  // B. Enrichissement de la config (Runtime)
  // On mappe les cartes UI vers les modules Data pour savoir si on active l'overlay
  const runtimeConfig = {
    ...UI_CONFIG,
    cards: UI_CONFIG.cards
      .map((card) => {
        const data = initPacket.modules[card.id];
        if (!data) return null;

        return {
          ...card,
          isInteractive: !!data.details,
        };
      })
      .filter(Boolean),
  };

  // C. Construction Interface
  initRenderer(runtimeConfig, callbacks);

  // ÉTAPE 3 : Main injecte les datas initiales
  // On transforme le InitPacket en format compatible pour updateInterface
  const initialState = transformDataToRenderFormat(initPacket.modules);
  console.log("📦 INIT_STATE:", initialState);

  updateInterface(initialState);

  // Démarrage de la boucle
  requestAnimationFrame(gameLoop);
});

// --- 4. TRANSFORMATEUR DE DONNÉES (Adapter / Mapper) ---
/**
 * Adapte les données du DataStore (format { hero: ... }) vers le format Renderer.
 * Gère les règles d'affichage (Title, Text, Percent, Barre, Spot...).
 * * @param {Object} modulesData - L'objet 'modules' du paquet INIT ou UPDATE
 * @returns {Array} Liste d'objets d'état pour updateInterface()
 */
function transformDataToRenderFormat(modulesData) {
  const renderList = [];

  Object.entries(modulesData).forEach(([id, moduleContent]) => {
    // Règle 1 : On ne traite que les modules qui ont des données 'hero'
    // (Le paquet UPDATE peut ne contenir qu'un sous-ensemble de modules)
    if (!moduleContent || !moduleContent.hero) return;

    const h = moduleContent.hero;

    // Objet de rendu par défaut
    // On prépare les champs pour le futur renderer (text, text_sm, spot, etc.)
    // Tout en assurant la rétro-compatibilité avec le renderer actuel (mainText, barPercent)
    let renderItem = {
      id: id,
      mainText: "--", // Compatible Renderer V1
      barPercent: 0, // Compatible Renderer V1
      forceTextUpdate: true,

      // Champs sémantiques pour futur Renderer V2
      // type: 'text' | 'bar' | 'spot' | ... (à implémenter plus tard côté vue)
    };

    // Règle 2 : Application des formats spécifiques par module
    switch (id) {
      case "cpuUsage":
        if (h.load !== undefined) {
          renderItem.mainText = `${h.load}%`;
          renderItem.barPercent = h.load;
        }
        break;

      case "memory":
        // Priorité : Afficher le % d'usage, et peut-être la valeur absolue en petit plus tard
        if (h.load !== undefined) {
          renderItem.mainText = `${h.load}%`;
          renderItem.barPercent = h.load;
        }
        // Si on a 'used' (ex: "4.2 GB") et pas de load, on pourrait l'afficher,
        // mais pour l'instant restons cohérents sur le %.
        // Note: Si vous préférez "4.2 GB" en texte principal :
        if (h.used) {
          renderItem.mainText = h.used; // Override si 'used' est présent (INIT)
        }
        break;

      case "battery":
        if (h.level !== undefined) {
          renderItem.mainText = `${h.level}%`;
          renderItem.barPercent = h.level;
          // Ici on pourrait ajouter un indicateur de charge dans le futur (spot: h.isCharging)
        }
        break;

      case "cpuTemp":
        if (h.temp !== undefined) {
          renderItem.mainText = `${h.temp}°C`;
          renderItem.barPercent = h.temp; // Echelle 0-100 arbitraire pour la barre
        }
        break;

      case "network":
        if (h.online !== undefined) {
          renderItem.mainText = h.online ? "Online" : "Offline";
          renderItem.barPercent = h.online ? 100 : 0; // 100% = Vert/Connecté, 0% = Rouge/Déco
        }
        break;

      case "gpu":
        if (h.name) renderItem.mainText = h.name;
        break;

      case "display":
        // On affiche la résolution en priorité, sinon le nom
        if (h.resolution) renderItem.mainText = h.resolution;
        else if (h.primaryName) renderItem.mainText = h.primaryName;
        break;

      case "system":
        if (h.osName) renderItem.mainText = h.osName;
        if (h.chromeVersion) renderItem.mainText += ` ${h.chromeVersion}`; // Concaténation simple
        break;

      case "settings":
        if (h.version) renderItem.mainText = `v${h.version}`;
        break;

      default:
        // Pour les modules inconnus ou sans règle spécifique
        renderItem.mainText = JSON.stringify(h);
        break;
    }

    renderList.push(renderItem);
  });

  return renderList;
}

// --- 5. BOUCLE PRINCIPALE ---
function gameLoop(timestamp) {
  const deltaTime = timestamp - lastTime;

  if (deltaTime >= UPDATE_INTERVAL) {
    lastTime = timestamp;

    // 1. Récupération des données fraîches
    const updatePacket = store.getUpdatePacket();

    // 2. Transformation
    // Note: getUpdatePacket renvoie une structure similaire à initPacket.hardware.modules
    // mais simplifiée. On adapte notre transformateur ou on le réutilise si la structure matche.
    // Dans le mock actuel, la structure 'modules' est compatible.
    const renderState = transformDataToRenderFormat(updatePacket.modules); // Attention: structure légèrement différente dans le mock, à adapter

    // Pour l'instant, le mock updatePacket.modules a : { cpu: { value: 'XX%', subValue: 'XX' } }
    // Alors que initPacket avait : { cpu: { hero: { value... } } }
    // J'adapte le transformateur ci-dessous pour gérer les deux cas (Hero ou Direct)

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
