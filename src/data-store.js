/**
 * @file        data-store.js
 * @description Couche d'accès aux données (Data Layer). Interroge les APIs système Chrome
 * (CPU, Memory, Storage...) et normalise les données brutes pour l'application.
 * @author      François Bacconnet <https://github.com/tchoa91>
 * @copyright   2026 François Bacconnet
 * @license     GPL-3.0
 * @version     2.0
 * @homepage    https://ext.tchoa.com
 * @see         https://github.com/tchoa91/cog-ext
 */

export class DataStore {
  constructor() {
    this.version = "5.1 - Pure Raw Data";
    this.cachedGpu = null;
    this.cachedStaticInfo = null;
    this.cachedStorage = null;
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
      pStorage = this._fetchStorageSummary();
      pDisplay = this._fetchDisplaySummary();
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
    const [cpu, mem, batt, net, sysStatic, storage, display] =
      await Promise.all([
        pCpuStats,
        pMem,
        pBatt,
        pNet,
        pSysStatic,
        pStorage,
        pDisplay,
      ]);

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
    return new Promise((resolve) => {
      chrome.system.cpu.getInfo((info) => {
        // [DEBUG] On regarde ce que Chrome nous donne vraiment
        // console.log("🔍 [DataStore] RAW CPU Info:", info);

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
              deltaTotal > 0
                ? ((deltaTotal - deltaIdle) / deltaTotal) * 100
                : 0;
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

        resolve(result);
      });
    });
  }

  async _fetchMemory() {
    return new Promise((resolve) => {
      // Renvoie directement { capacity: double, availableCapacity: double }
      chrome.system.memory.getInfo(resolve);
    });
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
    // Socle minimal
    const netInfo = {
      online: navigator.onLine,
      type: navigator.connection
        ? navigator.connection.effectiveType
        : "unknown",
      ip: null,
    };

    // Si on est en ligne, on tente de récupérer l'IP Publique
    if (netInfo.online) {
      try {
        const response = await fetch("https://api.ipify.org?format=json");
        const data = await response.json();
        netInfo.ip = data.ip;
      } catch (e) {
        // Si le fetch échoue (ex: bloqueur de pub), on garde l'info "Online" mais sans IP
        // On ne retourne pas null ici car "Online" est une info utile en soi.
      }
    }
    return netInfo;
  }

  async _fetchStorageSummary() {
    return await this._fetchStorageDetails();
  }

  async _fetchStorageDetails() {
    // 1. Si on a déjà les données en cache, on les renvoie direct (Statique)
    if (this.cachedStorage) return this.cachedStorage;

    return new Promise((resolve) => {
      chrome.system.storage.getInfo(async (units) => {
        // Si aucun disque, on renvoie null et on ne cache rien (pour retenter plus tard si branchement)
        if (!units || units.length === 0) {
          return resolve(null);
        }

        // Préparation des appels asynchrones pour l'espace libre
        const canCheckFreeSpace =
          typeof chrome.system.storage.getAvailableCapacity === "function";

        const partitionsPromises = units.map((unit) => {
          return new Promise((resUnit) => {
            const safeCapacity = unit.capacity || 0;

            // Nettoyage basique du nom
            // Note: sur ChromeOS, le nom est souvent vide ou générique, on garde l'ID si besoin
            let cleanName = (
              unit.name || unit.id.replace(/[^a-z0-9]/gi, " ")
            ).trim();
            if (!cleanName) cleanName = "Drive";

            const baseInfo = {
              name: cleanName,
              type: unit.type,
              capacity: safeCapacity,
              // Par défaut availableCapacity est null (et pas 0, pour distinguer "plein" de "inconnu")
              availableCapacity: null,
            };

            // Si l'API le permet et que le disque a une taille
            if (canCheckFreeSpace && safeCapacity > 0) {
              chrome.system.storage.getAvailableCapacity(unit.id, (info) => {
                if (!chrome.runtime.lastError && info) {
                  baseInfo.availableCapacity = info.availableCapacity;
                }
                resUnit(baseInfo);
              });
            } else {
              resUnit(baseInfo);
            }
          });
        });

        const partitions = await Promise.all(partitionsPromises);

        // On stocke le résultat brute (c'est le main.js qui filtrera le 1er disque)
        this.cachedStorage = partitions;

        resolve(partitions);
      });
    });
  }

  async _fetchDisplaySummary() {
    return await this._fetchDisplayDetails();
  }

  async _fetchDisplayDetails() {
    return new Promise((resolve) => {
      chrome.system.display.getInfo((displays) => {
        if (!displays || displays.length === 0) {
          console.warn("Display Info: Aucune information retournée.");
          return resolve({ width: 0, height: 0, gpu: "Unknown", screens: [] });
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

        resolve({
          width: primary.w,
          height: primary.h,
          gpu: this._resolveGpuName(),
          screens: screenList, // La liste contient maintenant les noms et types
        });
      });
    });
  }

  async _fetchSystemStatic() {
    // Si on a déjà l'info, on la renvoie immédiatement (promesse résolue)
    if (this.cachedStaticInfo) {
      return this.cachedStaticInfo;
    }

    return new Promise(async (resolve) => {
      // 1. Infos Plateforme (Arch, NaCl...)
      const platform = await new Promise((r) =>
        chrome.runtime.getPlatformInfo(r),
      );

      // 2. Langues acceptées (pour l'overlay Chrome)
      const langs = await new Promise((r) => chrome.i18n.getAcceptLanguages(r));

      // 3. Extensions installées (pour l'overlay Chrome)
      // Nécessite la permission "management" dans manifest.json
      let extCount = 0;
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

      const result = {
        os: "ChromeOS",
        arch: platform.arch,
        chromeVer: /Chrome\/([0-9.]+)/.exec(navigator.userAgent)[1],
        chromeLanguages: langs.slice(0, 3).join(", "),
        chromeExtensions: extList,
        appVersion: chrome.runtime.getManifest().version,
      };

      this.cachedStaticInfo = result;

      resolve(result);
    });
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
