export class DataStore {
  constructor() {
    this.version = "5.1 - Pure Raw Data";
    this.cachedGpu = null; // Pour éviter la boucle infinie de contextes WebGL
    this.cachedStaticInfo = null;
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

    // Cas A : Dashboard complet (Grille) -> On charge les résumés pour remplir les cartes
    if (scope === "cards") {
      pSysStatic = this._fetchSystemStatic(); // Info OS/Version
      pStorage = this._fetchStorageSummary(); // Juste l'espace libre global
      pDisplay = this._fetchDisplaySummary(); // Juste la résolution principale
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
      };
      // On n'ajoute les détails (coeurs) que s'ils sont pertinents pour l'overlay
      // (Note: dans notre implémentation mock actuelle, on a tout, mais on pourrait filtrer ici si l'API était lourde)
      if (scope === "cpuUsage") {
        output.cpuUsage.coresPct = cpu.cores;
        output.cpuUsage.features = cpu.features;
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
      output.storage = {
        usedBytes: storage.used,
        totalBytes: storage.total,
        name: storage.name,
      };
      // Détection automatique : Si la version "Lourde" a été fetchée, elle contient 'partitions'
      if (storage.partitions) {
        output.storage.partitions = storage.partitions;
      }
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
        // Variables pour le calcul de CHARGE
        let totalUsageAcc = 0;
        let coresPct = [];

        // A. CALCUL DIFFERENTIEL DE LA CHARGE
        // On a besoin de l'état précédent pour comparer T2 - T1
        if (this.previousCpuInfo) {
          coresPct = info.processors.map((proc, i) => {
            const prev = this.previousCpuInfo.processors[i];

            // Delta (Différence de temps total et idle entre les deux mesures)
            const deltaTotal = proc.usage.total - prev.usage.total;
            const deltaIdle = proc.usage.idle - prev.usage.idle;

            // Calcul du pourcentage utilisé
            const pct =
              deltaTotal > 0
                ? ((deltaTotal - deltaIdle) / deltaTotal) * 100
                : 0;

            totalUsageAcc += pct; // On cumule pour la moyenne globale
            return Math.round(pct);
          });
        } else {
          // Premier lancement : pas d'historique, on met tout à 0
          coresPct = info.processors.map(() => 0);
        }

        // On sauvegarde l'état actuel pour le prochain tick
        this.previousCpuInfo = info;

        // B. GESTION TEMPÉRATURE (Spécifique ChromeOS)
        let computedTemp = null;
        let zones = [];

        if (info.temperatures && info.temperatures.length > 0) {
          zones = info.temperatures;
          // Moyenne pondérée des sondes
          const sum = zones.reduce((a, b) => a + b, 0);
          computedTemp = Math.round(sum / zones.length);
        }

        // C. RETOUR FINAL
        resolve({
          // Partie USAGE
          usageTotal: Math.round(totalUsageAcc / info.processors.length),
          cores: coresPct,
          modelName: info.modelName,
          features: info.features,

          // Partie TEMP (null si non dispo)
          temp: computedTemp,
          tempZones: zones,
        });
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
    const details = await this._fetchStorageDetails();
    if (!details) return null; // Si pas de disque, pas de summary

    return {
      used: details.used,
      total: details.total,
      name: details.name,
    };
  }

  async _fetchStorageDetails() {
    return new Promise((resolve) => {
      chrome.system.storage.getInfo(async (units) => {
        // Règle v1.2 : Si tableau vide, on renvoie null pour cacher la carte
        if (!units || units.length === 0) {
          return resolve(null);
        }

        const partitionsPromises = units.map((unit) => {
          return new Promise((resUnit) => {
            chrome.system.storage.getAvailableCapacity(unit.id, (info) => {
              const free = chrome.runtime.lastError
                ? 0
                : info.availableCapacity;

              // Règle v1.2 : Nettoyage du nom (suppression caractères non-ascii)
              let cleanName = (unit.name || `Partition ${unit.id}`)
                .replace(/[^\x20-\x7E]/g, "")
                .trim();

              resUnit({
                id: unit.id,
                label: cleanName,
                size: unit.capacity,
                free: free,
                type: unit.type,
              });
            });
          });
        });

        const partitions = await Promise.all(partitionsPromises);

        // Sécurité supplémentaire : si après filtrage on a un souci
        if (partitions.length === 0) return resolve(null);

        const mainDisk =
          partitions.find((p) => p.type === "fixed") || partitions[0];

        resolve({
          used: mainDisk.size - mainDisk.free,
          total: mainDisk.size,
          name: mainDisk.label,
          partitions: partitions,
        });
      });
    });
  }

  async _fetchDisplaySummary() {
    // Même stratégie : on fetch tout, on filtre après.
    const details = await this._fetchDisplayDetails();
    return { width: details.width, height: details.height };
  }

  async _fetchDisplayDetails() {
    return new Promise((resolve) => {
      chrome.system.display.getInfo((displays) => {
        const primary = displays.find((d) => d.isPrimary) || displays[0];

        const screenList = displays.map((d) => ({
          id: d.id,
          w: d.bounds.width,
          h: d.bounds.height,
          primary: d.isPrimary,
        }));

        resolve({
          width: primary.bounds.width,
          height: primary.bounds.height,
          // Ajout du GPU ici, cohérent avec l'overlay Display
          gpu: this._resolveGpuName(),
          screens: screenList,
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
        chrome.runtime.getPlatformInfo(r)
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
          (e) => e.enabled && e.type === "extension"
        );
        extCount = activeExts.length;
        // On affiche le nombre + les 3 premières pour ne pas casser l'UI
        extList = `${extCount} active(s)`;
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
