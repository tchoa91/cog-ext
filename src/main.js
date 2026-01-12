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
        { id: "gpu", type: "kv", title: "GPU :" },
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

// Rythme de base : 5Hz (Fluidité des barres)
const UPDATE_INTERVAL = 200;
// Ratio : Le texte ne change qu'une fois sur 5 (soit 1Hz)
const TEXT_UPDATE_RATIO = 5;

let activeOverlayId = null;

// --- 3. INITIALISATION (Le Flux que vous avez défini) ---
document.addEventListener("DOMContentLoaded", async () => {
  const callbacks = {
    // Signal d'ouverture
    onOpen: async (cardId) => {
      // 1. Gestion Toggle OFF (Fermeture si on clique sur le même)
      if (activeOverlayId === cardId) {
        activeOverlayId = null;
        setOverlayState(false);
        return;
      }

      // 2. Préparation de l'ouverture
      const config = getOverlayConfig(cardId);
      const isDynamic = config ? config.isDynamic : false;
      const title = config ? config.title : cardId.toUpperCase();

      // 3. Cas STATIC (Mode Eco) : "Settings" ou Info fixe
      // On fait un rendu UNIQUE immédiat pour ne plus y toucher après.
      if (!isDynamic) {
        console.log(`Main: Ouverture Overlay Statique (${cardId})`);

        // On récupère juste les infos système statiques (pas besoin de CPU/RAM ici)
        // Note: On peut demander 'cards' pour avoir les infos génériques,
        // ou créer un scope spécial si besoin. Ici 'cards' suffit pour avoir "system" etc.
        const staticData = await store.getSystemState("cards");

        // On force l'objet overlay pour le renderer
        const renderState = transformDataToRenderFormat(staticData);
        // On précise manuellement l'ID de l'overlay à afficher maintenant
        renderState.overlay = { id: cardId, ...renderState.overlay };

        // Injection immédiate dans le DOM
        updateInterface(renderState);
      }

      // 4. Mise à jour de l'état global
      activeOverlayId = cardId;
      setOverlayState(true, { title: title });

      // Si c'est dynamique, la prochaine frame du gameLoop s'occupera du contenu.
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
  // console.log("📦 INIT:", initData);

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
 * Gère les règles d'affichage et le "Throttle" (lissage du texte).
 * @param {Object} modulesData - L'objet 'modules' du paquet INIT ou UPDATE
 * @param {Boolean} updateText - Si false, on ne met pas à jour les textes (optimisation 5Hz)
 * @returns {Object} Objet d'état pour updateInterface()
 */
function transformDataToRenderFormat(modulesData, updateText = true) {
  // Structure stricte demandée
  const state = {
    monitors: [],
    cards: [],
    overlay: null,
  };

  // Helper pour le throttle du texte
  // Si updateText est false, on renvoie undefined, ce qui dit au Renderer "Touche pas au DOM"
  const txt = (val) => (updateText ? val : undefined);

  // --- 1. CPU (Usage & Temp) ---
  if (modulesData.cpuUsage) {
    const usage = modulesData.cpuUsage.usagePct;

    // A. MONITOR
    state.monitors.push({
      id: "cpu",
      label: txt(`${usage}%`), // Texte freiné
      percent: usage, // Barre fluide (5Hz)
      state: usage > 80 ? "high" : "normal",
    });

    // B. OVERLAY DETECTED?
    if (modulesData.cpuUsage.coresPct) {
      state.overlay = {
        id: "cpuUsage",
        content: [
          {
            id: "cpuLoadAverage",
            type: "olBar",
            value: usage,
            display: txt(`${usage}%`),
          },
          { id: "cpuName", display: txt(modulesData.cpuUsage.model) },
          // Pour les listes complexes, on peut choisir de tout freiner ou non.
          // Ici on freine pour éviter le scintillement des chiffres.
          {
            id: "cpuLoadList",
            type: "olLoadList",
            value: updateText ? modulesData.cpuUsage.coresPct : undefined,
          },
          {
            id: "cpuFeatures",
            display: txt((modulesData.cpuUsage.features || []).join(", ")),
          },
        ],
      };
    }
    // C. CARD
    else {
      state.cards.push({
        id: "cpuUsage",
        content: [
          {
            id: "loadBar",
            value: usage,
            display: txt(`${usage}%`),
          },
        ],
      });
    }
  }

  // --- 1b. CPU TEMP ---
  if (modulesData.cpuTemp) {
    const temp = modulesData.cpuTemp.tempC;

    if (modulesData.cpuTemp.zones) {
      state.overlay = {
        id: "cpuTemp",
        content: [
          {
            id: "cpuTempAverage",
            type: "olBar",
            value: temp,
            display: txt(`${temp}°C`),
          },
          {
            id: "cpuTempList",
            type: "olTempList",
            value: updateText ? modulesData.cpuTemp.zones : undefined,
          },
        ],
      };
    } else {
      state.cards.push({
        id: "cpuTemp",
        content: [
          {
            id: "tempBar",
            value: temp,
            display: txt(`${temp}°C`),
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

    state.monitors.push({
      id: "mem",
      label: txt(`${pct}%`),
      percent: pct,
      state: pct > 90 ? "high" : "normal",
    });

    state.cards.push({
      id: "memory",
      content: [
        { id: "memBar", value: pct, display: txt(`${pct}%`) },
        { id: "memtotal", display: txt((total / 1e9).toFixed(1) + " GB") },
        { id: "memUsed", display: txt((used / 1e9).toFixed(1) + " GB") },
      ],
    });
  }

  // --- 3. BATTERY ---
  if (modulesData.battery) {
    const pct = Math.round(modulesData.battery.level * 100);
    const isCharging = modulesData.battery.charging;

    state.monitors.push({
      id: "batt",
      label: txt(`${pct}%`),
      percent: pct,
      icon: isCharging ? "bolt" : "",
      state: pct < 20 && !isCharging ? "warning" : "normal",
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

    state.cards.push({
      id: "battery",
      content: [
        { id: "battBar", value: pct, display: txt(`${pct}%`) },
        {
          id: "battStatus",
          display: txt(isCharging ? "Charging" : "On battery"),
        },
        {
          id: "battTime",
          display: txt(timeText),
          label: txt(labelText), // Mise à jour dynamique du label
        },
      ],
    });
  }

  // --- 4. NETWORK ---
  if (modulesData.network) {
    const isOnline = modulesData.network.online;

    state.monitors.push({
      id: "net",
      label: txt(isOnline ? "ON" : "OFF"),
      state: isOnline ? "normal" : "warning",
    });

    state.cards.push({
      id: "network",
      content: [
        { id: "netStatus", display: txt(isOnline ? "Online" : "Offline") },
        { id: "netIp", display: txt(modulesData.network.ip || "Hidden/Local") },
      ],
    });
  }

  // --- 5. STORAGE ---
  if (modulesData.storage) {
    // A. OVERLAY
    if (modulesData.storage.partitions) {
      state.overlay = {
        id: "storage",
        content: [
          {
            id: "storageTotal",
            display: txt(
              (modulesData.storage.totalBytes / 1e9).toFixed(0) + " GB"
            ),
          },
          {
            id: "storageFree",
            display: txt(
              (
                (modulesData.storage.totalBytes -
                  modulesData.storage.usedBytes) /
                1e9
              ).toFixed(1) + " GB"
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
    else {
      const usedPct = modulesData.storage.totalBytes
        ? Math.round(
            (modulesData.storage.usedBytes / modulesData.storage.totalBytes) *
              100
          )
        : 0;

      state.cards.push({
        id: "storage",
        content: [
          {
            id: "storagePerc",
            value: 100 - usedPct,
            display: txt(`${100 - usedPct}%`),
          },
          {
            id: "storageFree",
            display: txt(
              (
                (modulesData.storage.totalBytes -
                  modulesData.storage.usedBytes) /
                1e9
              ).toFixed(1) + " GB"
            ),
          },
        ],
      });
    }
  }

  // --- 6. DISPLAY ---
  if (modulesData.display) {
    // A. OVERLAY
    if (modulesData.display.screens) {
      const others =
        modulesData.display.screens.length > 1
          ? modulesData.display.screens
              .slice(1)
              .map((s) => `${s.w}x${s.h}`)
              .join(", ")
          : "None";

      state.overlay = {
        id: "display",
        content: [
          {
            id: "primDisplay",
            display: txt(
              `${modulesData.display.width}x${modulesData.display.height}`
            ),
          },
          { id: "otherDisplays", display: txt(others) },
          // Récupération du GPU depuis le module Display (Correction architecture)
          { id: "gpu", display: txt(modulesData.display.gpu || "Unknown") },
        ],
      };
    }
    // B. CARD
    else {
      state.cards.push({
        id: "display",
        content: [
          {
            id: "displayMain",
            display: txt(
              `${modulesData.display.width}x${modulesData.display.height}`
            ),
          },
          { id: "displayDef", display: txt("Primary") },
        ],
      });
    }
  }

  // --- 7. SYSTEM / OS / CHROME ---
  if (modulesData.system) {
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

    // OVERLAY CHROME DETECTED (Si on est en mode overlay chrome)
    if (state.overlay === null && modulesData.system.languages) {
      // Petit hack : comme "system" est toujours là, on ne peut pas déduire l'overlay
      // juste par la présence de modulesData.system. Mais si on a fetché les langues,
      // c'est qu'on a probablement besoin de l'overlay Chrome (ou que c'est en cache).
      // Cependant, l'orchestrateur (Main) force déjà l'ID de l'overlay si besoin.
      // Ici on remplit juste si l'ID correspond.
    }

    // Note : Pour l'overlay Chrome, si l'ID est activé, on peut remplir les champs
    // J'ajoute une vérification explicite si on doit générer l'overlay Chrome
    // (Cela suppose que modulesData.system contienne les infos étendues)
    if (modulesData.system.languages) {
      // On ne l'ajoute que si c'est l'overlay actif ou demandé
      // (Dans ton architecture actuelle, 'state.overlay' est unique)
      // On peut le laisser null ici et laisser le Main gérer l'ID,
      // mais il faut préparer le contenu "au cas où".
      // Pour simplifier : Si on a les données étendues, on prépare l'objet.
      const chromeOverlay = {
        id: "chrome",
        content: [
          { id: "chromeVersion", display: txt(modulesData.system.browserVer) },
          { id: "chromeLanguages", display: txt(modulesData.system.languages) },
          {
            id: "chromeExtensions",
            display: txt(modulesData.system.extensions),
          },
        ],
      };
      // Si on est en train de construire l'overlay chrome, on l'assigne
      // (Le main.js décidera d'utiliser cet objet si activeOverlayId === 'chrome')
      // Mais comme transformData est stateless, on renvoie l'objet si on a les datas.
      // Le main écrasera si ce n'est pas le bon ID.
      if (!state.overlay) state.overlay = chromeOverlay;
    }
  }

  // --- 8. SETTINGS ---
  // On récupère la version depuis system si dispo, sinon fallback
  const ver =
    modulesData.system && modulesData.system.appVersion
      ? modulesData.system.appVersion
      : "unknown";

  state.cards.push({
    id: "settings",
    content: [{ id: "appVersion", display: txt(ver) }],
  });

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
    const renderState = transformDataToRenderFormat(sysData, updateText);

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
