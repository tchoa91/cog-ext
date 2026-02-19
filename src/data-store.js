/**
 * @file        data-store.js
 * @description Couche d'accès aux données (Data Layer). Interroge les APIs système Chrome
 * (CPU, Memory, Storage...) et normalise les données brutes pour l'application.
 * @author      François Bacconnet <https://github.com/tchoa91>
 * @copyright   2026 François Bacconnet
 * @license     GPL-3.0
 * @version     2.1
 * @homepage    https://ext.tchoa.com
 * @see         https://github.com/tchoa91/cog-ext
 */

const TTL = {
  FAST: 5000, // 5 secondes (Storage, Display, Network Basic)
  SLOW: 30000, // 30 secondes (IP)
};

export class DataStore {
  constructor() {
    this.cachedGpu = null;
    this.cachedStaticInfo = null;

    this.cache = {
      storage: { data: null, ts: 0 },
      display: { data: null, ts: 0 },
      network: { data: null, ts: 0, ipTs: 0 },
    };
  }

  /**
   * Récupère les données brutes du système.
   * @param {String|null} scope - null (Monitors), "cards" (Dashboard), ou "id" (Overlay)
   * @returns {Object} Structure : { cpu: {raw...}, mem: {raw...}, ... }
   */
  async getSystemState(scope = null) {
    // --- PHASE 1 : SELECTION DES API (Optimisation des entrées) ---

    // 1. Socle "Live" (Monitors) : Toujours requis pour la TopBar
    // Ces données sont vitales, on les fetch à chaque tick.
    const pCpuStats = this._fetchCpuStats();
    const pMem = this._fetchMemory();
    const pBatt = this._fetchBattery();
    const pNet = this._fetchNetwork();

    // 2. Initialisation des modules optionnels à NULL (Par défaut: on ne charge rien)
    // C'est ici l'économie de ressources : si on ne demande pas, on ne lance pas la promesse.
    let pSysStatic = Promise.resolve(null);
    let pStorage = Promise.resolve(null);
    let pDisplay = Promise.resolve(null);

    // 3. Aiguillage selon le Scope

    // CORRECTION :
    // - "cards" : Dashboard (Besoin pour carte OS et Chrome)
    // - "settings" : Overlay Réglages (Besoin pour version App)
    // - "chrome" : Overlay Chrome (Besoin pour extensions/langues)
    // - "cpuUsage" : Overlay CPU (Besoin des infos système architecture/modèle)
    if (["cards", "settings", "chrome", "cpuUsage"].includes(scope)) {
      pSysStatic = this._fetchSystemStatic();
    }

    // Cas A : Dashboard complet (Grille)
    if (scope === "cards") {
      pStorage = this._fetchStorageDetails();
      pDisplay = this._fetchDisplayDetails();
    }

    // Cas B : Focus Module spécifique (Overlay Dynamique) -> On charge les détails UNIQUEMENT pour ce module
    else if (scope === "storage") {
      pStorage = this._fetchStorageDetails(); // Version lourde (avec partitions)
    } else if (scope === "display") {
      pDisplay = this._fetchDisplayDetails(); // Version lourde (avec liste des écrans)
    }

    // Cas C : Mode Eco (scope === null)
    // On ne rentre dans aucun if, les promesses optionnelles restent à null.
    // Seul le socle (Monitors) sera exécuté.

    // --- PHASE 2 : EXECUTION (Parallèle) ---
    // On attend tout le monde. Les promesses initialisées à 'null' se résolvent instantanément.
    const results = await Promise.allSettled([
      pCpuStats,
      pMem,
      pBatt,
      pNet,
      pSysStatic,
      pStorage,
      pDisplay,
    ]);

    // Extraction sécurisée : Si une promesse échoue, on récupère null (et on log l'erreur discrètement)
    const [cpu, mem, batt, net, sysStatic, storage, display] = results.map(
      (res) => {
        if (res.status === "fulfilled") return res.value;
        console.warn("DataStore: Module failure", res.reason);
        return null;
      },
    );

    // --- PHASE 3 : ASSEMBLAGE PAR MODULE (Sorties Brutes) ---
    const output = {};

    // 1. MONITORS (Le socle vital)

    // CPU
    if (cpu) {
      output.cpuUsage = {
        usagePct: cpu.usageTotal,
        model: cpu.modelName,
        archName: cpu.archName,
        features: cpu.features,
      };
      // On n'ajoute les détails (coeurs) que s'ils sont pertinents pour l'overlay
      // (Note: dans notre implémentation mock actuelle, on a tout, mais on pourrait filtrer ici si l'API était lourde)
      if (scope === "cpuUsage") {
        output.cpuUsage.coresPct = cpu.cores;
        // output.cpuUsage.features = cpu.features;
      }

      // CPU TEMP (Module séparé)
      if (cpu.temp !== null) {
        output.cpuTemp = { tempC: cpu.temp };
        if (scope === "cpuTemp") {
          output.cpuTemp.zones = cpu.tempZones;
        }
      }
    }

    // MEMORY
    if (mem) output.memory = mem;

    // BATTERY
    if (batt) output.battery = batt; // Contient déjà level, charging, times...

    // NETWORK
    if (net) output.network = net; // Contient online, type, ip...

    // 2. MODULES OPTIONNELS (Existent uniquement si demandés en Phase 1)

    // SYSTEM (Static)
    if (sysStatic) {
      output.system = {
        os: sysStatic.os,
        platform: sysStatic.arch,
        browserVer: sysStatic.chromeVer,
        appVersion: sysStatic.appVersion,
        languages: sysStatic.chromeLanguages,
        extensions: sysStatic.chromeExtensions,
      };
    }

    // STORAGE
    if (storage) {
      output.storage = storage;
    }

    // DISPLAY
    if (display) {
      output.display = {
        width: display.width,
        height: display.height,
      };
      // Détection automatique : Si la version "Lourde" a été fetchée, elle contient 'screens'
      if (display.screens) {
        output.display.screens = display.screens;
      }
    }

    return output;
  }

  async _fetchCpuStats() {
    const info = await new Promise((resolve) =>
      chrome.system.cpu.getInfo(resolve),
    );

    // --- 1. LOGIQUE UTILISATEUR (Nettoyage) ---
    // Modèle
    let cpuNameText = "Unknown";
    if (info.modelName && info.modelName.length > 0) {
      cpuNameText = info.modelName
        .replace(/\(R\)/g, "®")
        .replace(/\(TM\)/, "™");
    }

    // Architecture
    const cpuArchText = info.archName
      ? info.archName.replace(/_/g, "-")
      : "N/A";

    // Features
    const cpuFeaturesText =
      info.features && info.features.length > 0
        ? info.features.join(", ").toUpperCase().replace(/_/g, ".")
        : "-";

    // --- 2. CALCUL CHARGE (Code existant) ---
    let totalUsageAcc = 0;
    let coresPct = [];

    if (this.previousCpuInfo) {
      coresPct = info.processors.map((proc, i) => {
        const prev = this.previousCpuInfo.processors[i];
        const deltaTotal = proc.usage.total - prev.usage.total;
        const deltaIdle = proc.usage.idle - prev.usage.idle;
        const pct =
          deltaTotal > 0 ? ((deltaTotal - deltaIdle) / deltaTotal) * 100 : 0;
        totalUsageAcc += pct;
        return Math.round(pct);
      });
    } else {
      coresPct = info.processors.map(() => 0);
    }

    this.previousCpuInfo = info;

    // --- 3. CALCUL TEMPÉRATURE (Code existant) ---
    let computedTemp = null;
    let zones = [];
    if (info.temperatures && info.temperatures.length > 0) {
      zones = info.temperatures;
      const sum = zones.reduce((a, b) => a + b, 0);
      computedTemp = Math.round(sum / zones.length);
    }

    // --- 4. RETOUR PROPRE ---
    const result = {
      usageTotal: Math.round(totalUsageAcc / info.processors.length),
      cores: coresPct,
      // On renvoie les versions nettoyées
      modelName: cpuNameText,
      archName: cpuArchText,
      features: cpuFeaturesText,
      temp: computedTemp,
      tempZones: zones,
    };

    return result;
  }

  async _fetchMemory() {
    const info = await new Promise((resolve) =>
      chrome.system.memory.getInfo(resolve),
    );
    return info;
  }

  async _fetchBattery() {
    // Si l'API n'existe pas (ex: PC fixe sans onduleur détecté par l'OS), on renvoie null.
    if (!navigator.getBattery) return null;

    try {
      const b = await navigator.getBattery();
      return {
        level: b.level,
        charging: b.charging,
        chargingTime: b.chargingTime,
        dischargingTime: b.dischargingTime,
      };
    } catch (e) {
      return null; // En cas d'erreur, on considère le module comme absent
    }
  }

  async _fetchNetwork() {
    const now = Date.now();

    // Initialisation du cache si vide
    if (!this.cache.network.data) {
      this.cache.network.data = {
        online: false,
        type: "unknown",
        ip: null,
        latency: null,
      };
    }
    const netCache = this.cache.network;

    // 1. Mise à jour Fréquente (Status + Latence) : TTL.FAST (5s)
    if (now - netCache.ts > TTL.FAST) {
      netCache.data.online = navigator.onLine;
      netCache.data.type = navigator.connection
        ? navigator.connection.effectiveType
        : "unknown";

      netCache.ts = now; // On met à jour le timestamp immédiatement

      if (netCache.data.online) {
        // Mesure Latence : On ping un serveur Anycast (Google) pour simuler un vrai Ping.
        // "generate_204" renvoie une réponse vide instantanée depuis le CDN le plus proche.
        try {
          const start = performance.now();
          await fetch("https://clients3.google.com/generate_204", {
            method: "HEAD",
            mode: "no-cors", // Mode opaque (plus rapide, évite le parsing)
            cache: "no-store",
          });
          netCache.data.latency = Math.round(performance.now() - start);
        } catch (e) {
          // En cas d'échec (firewall, etc.), on garde l'ancienne valeur
        }
      } else {
        netCache.data.ip = null;
        netCache.data.latency = null;
      }
    }

    // 2. Mise à jour IP (Seulement si en ligne et TTL expiré)
    if (netCache.data.online && now - netCache.ipTs > TTL.SLOW) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        // On ne mesure plus la latence ici, juste l'IP
        const response = await fetch("https://api.ipify.org", {
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const ip = await response.text();
          netCache.data.ip = ip;
          netCache.ipTs = now;
        }
      } catch (e) {
        // Si le fetch échoue (ex: bloqueur de pub), on garde l'info "Online" mais sans IP
        // On ne retourne pas null ici car "Online" est une info utile en soi.
      }
    }

    return { ...netCache.data };
  }

  async _fetchStorageDetails() {
    const now = Date.now();

    if (this.cache.storage.data && now - this.cache.storage.ts < TTL.FAST) {
      return this.cache.storage.data;
    }

    const units = await new Promise((resolve) =>
      chrome.system.storage.getInfo(resolve),
    );

    // Si aucun disque, on renvoie null et on ne cache rien (pour retenter plus tard si branchement)
    if (!units || units.length === 0) {
      return null;
    }

    // Préparation des appels asynchrones pour l'espace libre
    const canCheckFreeSpace =
      typeof chrome.system.storage.getAvailableCapacity === "function";

    const partitionsPromises = units.map(async (unit) => {
      const safeCapacity = unit.capacity || 0;
      const cleanName =
        (unit.name || unit.id || "Drive").replace(/[^a-z0-9]+/gi, " ").trim() ||
        "Drive";

      const baseInfo = {
        name: cleanName,
        type: unit.type,
        capacity: safeCapacity,
        // Par défaut availableCapacity est null (et pas 0, pour distinguer "plein" de "inconnu")
        availableCapacity: null,
      };

      // Si l'API le permet et que le disque a une taille
      if (canCheckFreeSpace && safeCapacity > 0) {
        const info = await new Promise((resolve) =>
          chrome.system.storage.getAvailableCapacity(unit.id, resolve),
        );
        if (!chrome.runtime.lastError && info) {
          baseInfo.availableCapacity = info.availableCapacity;
        }
      }

      return baseInfo;
    });

    const partitions = await Promise.all(partitionsPromises);

    // On stocke le résultat brute (c'est le main.js qui filtrera le 1er disque)
    this.cache.storage = { data: partitions, ts: Date.now() };

    return partitions;
  }

  async _fetchDisplayDetails() {
    const now = Date.now();

    if (this.cache.display.data && now - this.cache.display.ts < TTL.FAST) {
      return this.cache.display.data;
    }

    const displays = await new Promise((resolve) =>
      chrome.system.display.getInfo(resolve),
    );

    if (!displays || displays.length === 0) {
      console.warn("Display Info: Aucune information retournée.");
      return { width: 0, height: 0, gpu: "Unknown", screens: [] };
    }

    // 1. On mappe TOUTES les infos utiles (Nom, Interne, Résolution)
    const screenList = displays.map((d) => ({
      id: d.id,
      w: d.bounds.width,
      h: d.bounds.height,
      primary: d.isPrimary,
      internal: d.isInternal, // <--- AJOUT : Booléen (Vrai si écran de laptop/tablette)
      name: d.name || "Monitor", // <--- AJOUT : Nom du constructeur/modèle
    }));

    // 2. On isole le primaire pour un accès rapide (facultatif mais pratique)
    const primary = screenList.find((s) => s.primary) || screenList[0];

    const result = {
      width: primary.w,
      height: primary.h,
      gpu: this._resolveGpuName(),
      screens: screenList, // La liste contient maintenant les noms et types
    };
    this.cache.display = { data: result, ts: Date.now() };
    return result;
  }

  async _fetchSystemStatic() {
    // Si on a déjà l'info, on la renvoie immédiatement (promesse résolue)
    if (this.cachedStaticInfo) {
      return this.cachedStaticInfo;
    }

    // 1. Infos Plateforme (Arch, NaCl...)
    const platform = await new Promise((r) =>
      chrome.runtime.getPlatformInfo(r),
    );

    // 2. Langues acceptées (pour l'overlay Chrome)
    const langs = await new Promise((r) => chrome.i18n.getAcceptLanguages(r));

    // 3. Extensions installées (pour l'overlay Chrome)
    // Nécessite la permission "management" dans manifest.json
    let extList = "N/A";

    try {
      const exts = await new Promise((r) => chrome.management.getAll(r));
      const activeExts = exts.filter(
        (e) => e.enabled && e.type === "extension",
      );

      if (activeExts.length > 0) {
        extList = activeExts
          .map((e) => e.name)
          .sort((a, b) => a.localeCompare(b));
      } else {
        extList = ["None"];
      }
    } catch (e) {
      console.warn("DataStore: Permission 'management' manquante.");
    }

    const osMap = {
      mac: "macOS",
      win: "Windows",
      android: "Android",
      cros: "ChromeOS",
      linux: "Linux",
      openbsd: "OpenBSD",
    };

    const result = {
      os: osMap[platform.os] || platform.os,
      arch: platform.arch,
      chromeVer: /Chrome\/([0-9.]+)/.exec(navigator.userAgent)[1],
      chromeLanguages: langs.slice(0, 3).join(", "),
      chromeExtensions: extList,
      appVersion: chrome.runtime.getManifest().version,
    };

    this.cachedStaticInfo = result;

    return result;
  }

  // --- NOUVELLE MÉTHODE UTILITAIRE (Helper) ---
  // Permet de centraliser la logique "lourde" du WebGL
  _resolveGpuName() {
    if (this.cachedGpu) return this.cachedGpu;

    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          this.cachedGpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
        // Nettoyage immédiat pour éviter le warning "Too many active WebGL contexts"
        const ext = gl.getExtension("WEBGL_lose_context");
        if (ext) ext.loseContext();
      }
    } catch (e) {
      console.warn("GPU Detection failed", e);
    }

    // Fallback si échec ou null
    this.cachedGpu = this.cachedGpu || "Integrated / Unknown";
    return this.cachedGpu;
  }
}
