/**
 * @file        config.js
 * @description Configuration statique de l'interface et des seuils.
 */

const t = chrome.i18n.getMessage;

export const UI_CONFIG = {
  monitors: [
    {
      id: "cpu",
      title: t("monitor_cpu"),
      cardLink: "cpuUsage",
      type: "bar",
      hasOvelay: true,
    },
    { id: "mem", title: t("monitor_mem"), cardLink: "memory", type: "bar" },
    { id: "batt", title: t("monitor_batt"), cardLink: "battery", type: "bar" },
    { id: "net", title: t("monitor_net"), cardLink: "network", type: "dot" },
  ],
  cards: [
    {
      id: "cpuUsage",
      title: t("card_cpu_title"),
      hasOvelay: true,
      isDynamic: true,
      content: [{ id: "loadBar", type: "cardBar" }],
    },
    {
      id: "memory",
      title: t("card_mem_title"),
      isDynamic: true,
      content: [
        { id: "memBar", type: "cardBar" },
        { id: "memtotal", type: "kv", title: t("label_mem_total") },
        { id: "memUsed", type: "kv", title: t("label_mem_used") },
      ],
    },
    {
      id: "cpuTemp",
      title: t("card_temp_title"),
      hasOvelay: true,
      isDynamic: true,
      content: [{ id: "tempBar", type: "cardBar" }],
    },
    {
      id: "battery",
      title: t("card_batt_title"),
      isDynamic: true,
      content: [
        { id: "battBar", type: "cardBar" },
        { id: "battStatus", type: "value" },
        {
          id: "battTime",
          type: "kv",
          title: t("label_batt_time_general"),
        },
      ],
    },
    {
      id: "display",
      title: t("card_disp_title"),
      hasOvelay: true,
      isDynamic: true,
      content: [
        { id: "displayMain", type: "value" },
        { id: "displayDef", type: "value" },
      ],
    },
    {
      id: "network",
      title: t("card_net_title"),
      isDynamic: true,
      content: [
        { id: "netStatus", type: "value" },
        { id: "netIp", type: "kv", title: t("label_ip") },
      ],
    },
    {
      id: "chrome",
      title: t("card_chrome_title"),
      hasOvelay: true,
      content: [{ id: "chromeVersion", type: "value" }],
    },
    {
      id: "os",
      title: t("card_os_title"),
      content: [
        { id: "osName", type: "value" },
        { id: "osPlatform", type: "kv", title: t("label_platform") },
      ],
    },
    {
      id: "storage",
      title: t("card_storage_title"),
      hasOvelay: true,
      content: [{ id: "storageMain", type: "disk" }],
    },
    {
      id: "settings",
      title: t("card_settings_title"),
      hasOvelay: true,
      content: [{ id: "appVersion", type: "kv", title: t("label_version") }],
    },
  ],
  overlays: [
    {
      id: "cpuUsage",
      title: t("overlay_cpu_title"),
      isDynamic: true,
      content: [
        { id: "cpuLoadAverage", type: "olBar", title: t("detail_cpu_avg") },
        { id: "cpuLoadList", type: "olLoadList", title: t("detail_cpu_core") },
        { id: "cpuArc", type: "kv", title: t("detail_cpu_arch") },
        { id: "cpuName", type: "kv", title: t("detail_cpu_model") },
        { id: "cpuFeatures", type: "kv", title: t("detail_cpu_features") },
      ],
    },
    {
      id: "cpuTemp",
      title: t("overlay_temp_title"),
      isDynamic: true,
      content: [
        {
          id: "cpuTempAverage",
          type: "olBar",
          title: t("detail_temp_avg"),
        },
        {
          id: "cpuTempList",
          type: "olTempList",
          title: t("detail_temp_sensor"),
        },
      ],
    },
    {
      id: "display",
      title: t("overlay_disp_title"),
      isDynamic: true,
      content: [
        { id: "gpu", type: "kv", title: t("detail_gpu") },
        { id: "primDisplay", type: "kv", title: t("detail_disp_prim") },
        {
          id: "otherDisplays",
          type: "olTextList",
          title: t("detail_disp_other"),
        },
      ],
    },
    {
      id: "chrome",
      title: t("overlay_chrome_title"),
      content: [
        { id: "chromeVersion", type: "kv", title: t("label_version") },
        { id: "chromeLanguages", type: "kv", title: t("detail_chrome_langs") },
        {
          id: "chromeExtensions",
          type: "olTextList",
          title: t("detail_chrome_exts"),
        },
      ],
    },
    {
      id: "storage",
      title: t("overlay_storage_title"),
      content: [
        {
          id: "storageList",
          type: "disk",
          title: t("detail_storage_discs"),
        },
      ],
    },
    {
      id: "settings",
      title: t("card_settings_title"),
      content: [
        { id: "appVersion", type: "kv", title: t("label_version") },
        { id: "toggleTheme", type: "switch", title: t("settings_theme") },
        { id: "toggleUnit", type: "switch", title: t("settings_unit") },
        {
          id: "settingsFooter",
          type: "html",
          value: t("settings_footer"),
        },
      ],
    },
  ],
};

export const THRESHOLDS = {
  cpu: { warn: 70, alert: 90 }, // % Usage
  cpuCores: { warn: 60, alert: 85 },
  temp: { warn: 80, alert: 95 }, // °C
  memory: { warn: 81, alert: 96 }, // % Usage
  battery: { warn: 30, alert: 15 }, // % Restant (Sens inversé)
  storage: { warn: 90, alert: 95 }, // % Usage
};
