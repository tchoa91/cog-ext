export class DataStore {
  constructor() {
    this.version = "5.1 - Pure Raw Data";
  }

  /**
   * Récupère les données brutes du système.
   * @param {String|null} scope - null (Monitors), "cards" (Dashboard), ou "id" (Overlay)
   * @returns {Object} Structure : { cpu: {raw...}, mem: {raw...}, ... }
   */
  async getSystemState(scope = null) {
    // --- PHASE 1 : SELECTION DES API (Optimisation des entrées) ---
    // On ne déclenche que les fetchs strictement nécessaires.

    // Socle "Live" (Monitors) : Toujours requis
    const pCpuStats = this._fetchCpuStats(); // Usage + Temp (évite le doublon)
    const pMem = this._fetchMemory();
    const pBatt = this._fetchBattery();
    const pNet = this._fetchNetwork();

    // Extensions "Dashboard" (Cards)
    let pSysStatic = Promise.resolve(null);
    let pStorage = Promise.resolve(null);
    let pDisplay = Promise.resolve(null);

    const isDashboard = scope === "cards";

    if (isDashboard) {
      // En mode grille, on veut les infos statiques pour tout le monde
      pSysStatic = this._fetchSystemStatic(); // OS, GPU, CPU Model...
      pStorage = this._fetchStorageSummary();
      pDisplay = this._fetchDisplaySummary();
    }
    // Extensions "Overlay" (Détail ciblé)
    // On ajoute l'appel lourd uniquement si l'overlay spécifique est demandé
    else if (scope === "storage") {
      pStorage = this._fetchStorageDetails(); // Version détaillée (partitions)
    } else if (scope === "display") {
      pDisplay = this._fetchDisplayDetails(); // Version détaillée (liste écrans)
    }
    // Note: Pour CPU, Mem, Batt, Net, les détails lourds sont souvent
    // récupérables via le même appel ou un appel dédié qu'on pourrait ajouter ici.

    // --- PHASE 2 : EXECUTION (Parallèle) ---

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
    // On crée un objet propre par module, avec filtrage Court/Long selon le scope.

    const output = {};
    const isOverlay = typeof scope === "string" && scope !== "cards";

    // 1. MODULE CPU USAGE (Toujours présent si l'API répond)
    if (cpu) {
      output.cpuUsage = {
        usagePct: cpu.usageTotal,
        model: cpu.modelName,
      };

      // Données étendues pour l'Overlay USAGE
      if (scope === "cpuUsage") {
        output.cpuUsage.coresPct = cpu.cores;
        output.cpuUsage.features = cpu.features;
      }
    }

    // 1b. MODULE CPU TEMP (Séparé et Conditionnel)
    // On ne crée le module QUE si le matériel a remonté une température valide
    if (cpu && cpu.temp !== null) {
      output.cpuTemp = {
        tempC: cpu.temp,
      };

      // Données étendues pour l'Overlay TEMP
      if (scope === "cpuTemp") {
        output.cpuTemp.zones = cpu.tempZones;
      }
    }

    // 2. MODULE MEMOIRE
    // Simplification : On passe l'objet brut de l'API (capacity, availableCapacity)
    output.memory = mem;

    // 3. MODULE BATTERIE
    if (batt) {
      output.battery = {
        level: batt.level, // Nom standard W3C (0.0 à 1.0)
        charging: batt.charging,
        chargingTime: batt.chargingTime,
        dischargingTime: batt.dischargingTime,
      };
    }

    // 4. MODULE RESEAU
    if (net) {
      output.network = {
        online: net.online,
        type: net.type,
      };
      // L'IP est dispo pour tout le monde si on l'a trouvée
      if (net.ip) {
        output.network.ip = net.ip;
      }
    }

    // 5. MODULES SECONDAIRES (Seulement si fetchés)

    if (sysStatic) {
      // Pas de monitor, donc présent uniquement si isDashboard ou scope=system
      output.system = {
        os: sysStatic.os,
        platform: sysStatic.arch,
        browserVer: sysStatic.chromeVer,
      };
      output.gpu = {
        model: sysStatic.gpu,
      };
      if (scope === "system") {
        output.system.kernel = "5.15.x";
        output.system.user = "User";
      }
    }

    if (storage) {
      output.storage = {
        usedBytes: storage.used,
        totalBytes: storage.total,
        name: storage.name,
      };
      // Si c'est l'appel "Details", on a reçu 'partitions' en plus
      if (storage.partitions) {
        output.storage.partitions = storage.partitions; // Array brut
      }
    }

    if (display) {
      output.display = {
        width: display.width,
        height: display.height,
      };
      if (display.screens) {
        output.display.screens = display.screens; // Array brut
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

  async _fetchSystemStatic() {
    return {
      os: "ChromeOS",
      arch: "x86_64",
      chromeVer: "120.0",
      gpu: "Intel UHD",
      cpuModel: "i5-1240P",
    };
  }

  // Exemple: API légère pour le dashboard
  async _fetchStorageSummary() {
    return { used: 60000000000, total: 128000000000, name: "Internal" };
  }
  // Exemple: API lourde pour l'overlay (peut être la même avec un paramètre 'detail' en vrai)
  async _fetchStorageDetails() {
    return {
      used: 60000000000,
      total: 128000000000,
      name: "Internal",
      partitions: [
        { id: "root", size: 4000000000 },
        { id: "user", size: 120000000000 },
      ],
    };
  }

  async _fetchDisplaySummary() {
    return { width: 1920, height: 1080 };
  }
  async _fetchDisplayDetails() {
    return {
      width: 1920,
      height: 1080,
      screens: [
        { w: 1920, h: 1080 },
        { w: 2560, h: 1440 },
      ],
    };
  }
}
