// --- src/data-store.js ---

export class DataStore {
  constructor() {
    this.version = "2.1";
  }

  getInitPacket() {
    // Données EN DUR comme demandé
    return {
      type: "INIT",
      timestamp: Date.now(),
      modules: {
        cpuUsage: {
          hero: {
            load: 15,
          },
          details: {
            load: 15,
            architecture: "x86_64",
            features: ["mmx", "sse", "avx"],
            cores: [
              { id: 0, load: 9 },
              { id: 1, load: 11 },
              { id: 2, load: 5 },
              { id: 3, load: 20 },
            ],
          },
        },
        memory: {
          hero: {
            load: 50,
            used: "4.2 GB",
            total: "8 GB",
            type: "DDR4",
            free: 50,
          },
        },
        network: {
          hero: {
            online: true,
          },
        },
        battery: {
          hero: {
            level: 75,
            timeLeftSeconds: 30000,
            isCharging: false,
          },
        },
        cpuTemp: {
          hero: {
            temp: 45,
          },
          details: {
            temp: 45,
            cores: [
              { id: 0, temp: 45 },
              { id: 1, temp: 46 },
              { id: 2, temp: 42 },
              { id: 3, temp: 48 },
            ],
          },
        },
        gpu: {
          hero: {
            name: "NVIDIA RTX 3060",
          },
        },
        display: {
          hero: {
            primaryName: "Built-in Display",
            resolution: "1920 x 1080",
          },
          details: {
            primaryName: "Built-in Display",
            resolution: "1920 x 1080",
            dpi: 160,
            colorDepth: 24,
            secondaryDisplays: [
              {
                name: "Samsung SMS27",
                resolution: "2560 x 1440",
                dpi: 92,
              },
            ],
          },
        },
        system: {
          hero: {
            osName: "ChromeOS",
            chromeVersion: "120.0.6099",
          },
          details: {
            osName: "ChromeOS",
            platform: "Linux x86_64",
            chromeVersion: "120.0.6099",
            channel: "Stable",
            language: "fr-FR",
            otherLanguages: ["en-US", "en-GB"],
            plugins: [
              { name: "Chromium PDF Viewer" },
              { name: "Native Client" },
            ],
          },
        },
        settings: {
          hero: {
            appName: "COGext",
            version: this.version,
          },
          details: {
            description: "System Monitor for Chrome",
            actions: {
              theme: "dark",
              tempUnit: "C",
            },
          },
        },
      },
    };
  }

  getUpdatePacket() {
    // Valeurs simples pour tester l'animation, sans logique d'état
    return {
      type: "UPDATE",
      timestamp: Date.now(),
      modules: {
        cpuUsage: { load: 18 },
        memory: { load: 51 },
        battery: { level: 75 },
        network: { Online: true },
      },
    };
  }
}
