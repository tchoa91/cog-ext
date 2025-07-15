const domCache = {};
let animationFrameId;
let lastUpdateTime = 0;
const updateInterval = 500; // ms
var previousCpuInfo;
let currentCpuTemperatureScale = 'Celsius'; // Default scale

function initLabels() {

  function setLabel(elementId, labelText) {
    var label = document.querySelector('label[for=' + elementId + ']');
    label.textContent = labelText;
  }

  setLabel('operating-system', 'Operating System');
  setLabel('platform', 'Platform');
  setLabel('chrome-version', 'Chrome Version');

  setLabel('cpu-name', 'CPU Name');
  setLabel('cpu-arch', 'CPU Architecture');
  setLabel('cpu-features', 'CPU Features');
  setLabel('cpu-usage', 'CPU Usage');
  setLabel('cpu-temperatures', 'CPU Temperatures');

  setLabel('internal-storage-units', 'Internal Storage Units');
  setLabel('external-storage-units', 'External Storage Units');

  setLabel('memory-capacity', 'Memory Capacity');
  setLabel('memory-usage', 'Memory Usage');

  setLabel('battery-status', 'Battery Status');
  setLabel('battery-time', 'Battery Time');
  setLabel('battery-level', 'Battery Level');

  setLabel('primary-display', 'Primary Display');
  setLabel('other-displays', 'Other Displays');

  setLabel('language', 'Language');
  setLabel('accept-languages', 'Accept Languages');

  setLabel('plugins-list', 'Plugins List');
}

function initInfo() {
  domCache.operatingSystem = document.querySelector('#operating-system');
  if (/CrOS/.test(navigator.userAgent)) {
    domCache.operatingSystem.textContent = 'Chrome OS';
  } else if (/Mac/.test(navigator.platform)) {
    domCache.operatingSystem.textContent = 'Mac OS';
  } else if (/Win/.test(navigator.platform)) {
    domCache.operatingSystem.textContent = 'Windows';
  } else if (/Android/.test(navigator.userAgent)) {
    domCache.operatingSystem.textContent = 'Android';
  } else if (/Linux/.test(navigator.userAgent)) {
    domCache.operatingSystem.textContent = 'Linux';
  } else {
    domCache.operatingSystem.textContent = '-';
  }

  domCache.chromeVersion = document.querySelector('#chrome-version');
  domCache.chromeVersion.textContent = navigator.userAgent.match('Chrome/([0-9]*\.[0-9]*\.[0-9]*\.[0-9]*)')[1];

  domCache.platform = document.querySelector('#platform');
  domCache.platform.textContent = navigator.platform.replace(/_/g, '-');

  domCache.language = document.querySelector('#language');
  domCache.language.textContent = navigator.language;

  domCache.acceptLanguages = document.querySelector('#accept-languages');
  chrome.i18n.getAcceptLanguages(function(languages) {
    domCache.acceptLanguages.textContent = languages.join(', ');
  });
}

function initBattery() {
  if (!navigator.getBattery) {
    return;
  }
  domCache.battery = document.querySelector('#battery');
  domCache.battery.classList.remove('hidden');

  domCache.batteryStatus = document.querySelector('#battery-status');
  domCache.batteryTime = document.querySelector('#battery-time');
  domCache.batteryLevel = document.querySelector('#battery-level');
  domCache.batteryLevelBar = domCache.batteryLevel.querySelector('.bar');
  domCache.batteryLevelUsed = domCache.batteryLevel.querySelector('.used');

  navigator.getBattery().then(function(batteryManager) {
    updateBattery(batteryManager);
    function update(event) {
      updateBattery(event.target);
    }

    batteryManager.onchargingchange = update;
    batteryManager.ondischargingtimechange = update;
    batteryManager.onchargingtimechange = update;
    batteryManager.onlevelchange = update;
  });
}

function updateBattery(batteryManager) {
    const newStatus = batteryManager.charging ? 'Charging' : 'Discharging';
    if (domCache.batteryStatus.textContent !== newStatus) {
      domCache.batteryStatus.textContent = newStatus;
    }

    let newTimeText;
    if (batteryManager.charging) {
      newTimeText = (batteryManager.chargingTime !== Infinity) ?
          formatSeconds(batteryManager.chargingTime) + ' until full' : '-';
    } else {
      newTimeText = (batteryManager.dischargingTime !== Infinity) ?
          formatSeconds(batteryManager.dischargingTime) + ' left' : '-';
    }
    if (domCache.batteryTime.textContent !== newTimeText) {
      domCache.batteryTime.textContent = newTimeText;
    }

    const newBatteryUsed = batteryManager.level.toFixed(2) * 100;
    const newTitle = newBatteryUsed.toFixed(0) + '%';
    const newWidth = newBatteryUsed + '%';

    if (domCache.batteryLevelBar.title !== newTitle) {
      domCache.batteryLevelBar.title = newTitle;
    }
    if (domCache.batteryLevelUsed.style.width !== newWidth) {
      domCache.batteryLevelUsed.style.width = newWidth;
    }
}

function initPlugins() {
  if (!navigator.plugins.length) {
    return;
  }
  domCache.plugins = document.querySelector('#plugins');
  domCache.plugins.classList.remove('hidden');

  domCache.pluginsList = document.querySelector('#plugins-list');
  // Optimize HTML construction using DocumentFragment
  let fragment = document.createDocumentFragment();
  for (var i = 0; i < navigator.plugins.length; i++) {
    let div = document.createElement('div');
    div.textContent = navigator.plugins[i].name;
    fragment.appendChild(div);
  }
  domCache.pluginsList.innerHTML = ''; // Clear existing content
  domCache.pluginsList.appendChild(fragment);
}

function updateStorage() {
  chrome.system.storage.getInfo(function(storageInfo) {
    if (!domCache.storage) {
        domCache.storage = document.querySelector('#storage');
    }
    if (storageInfo.length === 0) {
      domCache.storage.classList.add('hidden');
      return;
    }

    domCache.storage.classList.remove('hidden');

    if (!domCache.internalStorageUnits) {
        domCache.internalStorageUnits = document.querySelector('#internal-storage-units');
    }
    if (!domCache.externalStorageUnits) {
        domCache.externalStorageUnits = document.querySelector('#external-storage-units');
    }

    // Optimize HTML construction using DocumentFragment
    let internalFragment = document.createDocumentFragment();
    let externalFragment = document.createDocumentFragment();

    domCache.internalStorageUnits.innerHTML = ''; // Clear existing content
    domCache.externalStorageUnits.innerHTML = ''; // Clear existing content

    for (var i = 0; i < storageInfo.length; i++) {
      let div = document.createElement('div');
      div.textContent = storageInfo[i].name +
          (storageInfo[i].capacity ? ' - ' + formatBytes(storageInfo[i].capacity) : '');
      if (storageInfo[i].type === 'removable') {
        externalFragment.appendChild(div);
      } else {
        internalFragment.appendChild(div);
      }
    }

    domCache.internalStorageUnits.appendChild(internalFragment);
    domCache.externalStorageUnits.appendChild(externalFragment);

    if (!domCache.internalStorage) {
        domCache.internalStorage = document.querySelector('#internal-storage');
    }
    if (domCache.internalStorageUnits.textContent === '') {
      domCache.internalStorage.classList.add('hidden');
    } else {
      domCache.internalStorage.classList.remove('hidden');
    }
    if (!domCache.externalStorage) {
        domCache.externalStorage = document.querySelector('#external-storage');
    }
    if (domCache.externalStorageUnits.textContent === '') {
      domCache.externalStorage.classList.add('hidden');
    } else {
      domCache.externalStorage.classList.remove('hidden');
    }
  });
}

function initCpu() {
  chrome.system.cpu.getInfo(function(cpuInfo) {
    domCache.cpuName = document.querySelector('#cpu-name');
    domCache.cpuArch = document.querySelector('#cpu-arch');
    domCache.cpuFeatures = document.querySelector('#cpu-features');
    domCache.cpuTemperatures = document.querySelector('#cpu-temperatures');
    domCache.cpuUsage = document.querySelector('#cpu-usage');

    var cpuNameText = 'Unknown';
    if (cpuInfo.modelName.length != 0) {
      cpuNameText = cpuInfo.modelName.replace(/\(R\)/g, '®').replace(/\(TM\)/, '™');
    }
    domCache.cpuName.textContent = cpuNameText;

    domCache.cpuArch.textContent = cpuInfo.archName.replace(/_/g, '-');
    domCache.cpuFeatures.textContent = cpuInfo.features.join(', ').toUpperCase().replace(/_/g, '.') || '-';

    if ('temperatures' in cpuInfo) {
      // First, get the stored preference or use default
      chrome.storage.sync.get('cpuTemperatureScale', function(result) {
        if (result.cpuTemperatureScale) {
          currentCpuTemperatureScale = result.cpuTemperatureScale;
        }
        // Now that scale is set, update display
        updateCpuTemperatures(cpuInfo); // This will use currentCpuTemperatureScale

        // Add click listener to toggle and save
        if (domCache.cpuTemperatures) { // Check if element exists
          domCache.cpuTemperatures.addEventListener('click', function(event) {
            currentCpuTemperatureScale = (currentCpuTemperatureScale === 'Fahrenheit') ? 'Celsius' : 'Fahrenheit';
            chrome.storage.sync.set({cpuTemperatureScale: currentCpuTemperatureScale}, function() {
              // 'cpuInfo' here is from the outer scope of chrome.system.cpu.getInfo in initCpu
              // This ensures the update uses the data with which the listener was associated
              updateCpuTemperatures(cpuInfo);
            });
          });
        }
      });
    } else {
      if (domCache.cpuTemperatures) domCache.cpuTemperatures.textContent = 'N/A';
    }

    var width = parseInt(window.getComputedStyle(domCache.cpuUsage).width.replace(/px/g, ''));
    domCache.cpuUsageBars = [];
    for (var i = 0; i < cpuInfo.numOfProcessors; i++) {
      var bar = document.createElement('div');
      bar.classList.add('bar');
      var usedSection = document.createElement('span');
      usedSection.classList.add('bar-section', 'used');
      usedSection.style.transform = 'translate(-' + width + 'px, 0px)';
      bar.appendChild(usedSection);
      domCache.cpuUsage.appendChild(bar);
      domCache.cpuUsageBars.push(bar);
    }
  });
}

function updateCpuUsage() {
  chrome.system.cpu.getInfo(function(cpuInfo) {

    if ('temperatures' in cpuInfo) {
      updateCpuTemperatures(cpuInfo);
    }

    if (!domCache.cpuUsage) return; // Guard against calling before initCpu completes
    const width = parseInt(window.getComputedStyle(domCache.cpuUsage).width.replace(/px/g, '')); // width can be const if not changed later
    for (let i = 0; i < cpuInfo.numOfProcessors; i++) { // i needs to be let for the loop
        const usage = cpuInfo.processors[i].usage;
        let usedSectionWidth = 0; // Must be let as it's conditionally assigned

        if (previousCpuInfo) {
          const oldUsage = previousCpuInfo.processors[i].usage;
          const currentKernelUserTime = usage.kernel + usage.user;
          const previousKernelUserTime = oldUsage.kernel + oldUsage.user;
          const G = usage.total - oldUsage.total; // Denominator

          if (G > 0) {
              usedSectionWidth = Math.floor((currentKernelUserTime - previousKernelUserTime) / G * 100);
          } else {
              usedSectionWidth = 0; // Default to 0 if no change or invalid data
          }
        } else {
          const currentKernelUserTime = usage.kernel + usage.user;
          if (usage.total > 0) { // Check if usage.total is greater than zero
              usedSectionWidth = Math.floor(currentKernelUserTime / usage.total * 100);
          } else {
              usedSectionWidth = 0; // Default to 0 if total is zero
          }
        }

        // Ensure usedSectionWidth is a valid number between 0 and 100
        if (isNaN(usedSectionWidth) || !isFinite(usedSectionWidth)) {
          usedSectionWidth = 0;
        }
        usedSectionWidth = Math.max(0, Math.min(100, usedSectionWidth));

        const bar = domCache.cpuUsageBars[i];
        if (bar) { // Check if bar exists
          const barUsed = bar.querySelector('.used');
          const newTransform = 'translate(' + parseInt(usedSectionWidth * width / 100 - width) + 'px, 0px)';
          if (barUsed.style.transform !== newTransform) {
            barUsed.style.transform = newTransform;
          }
        }
    }
    previousCpuInfo = cpuInfo;
  });
}

function updateCpuTemperatures(cpuInfo) {
  if (!domCache.cpuTemperatures) return; // Guard if not cached
  if (!cpuInfo || !cpuInfo.temperatures) { // Guard for cpuInfo and its temperatures property
    // Optionally, set to 'N/A' or some other placeholder if data is missing
    // domCache.cpuTemperatures.textContent = 'N/A';
    return;
  }

  let newTemperaturesHtml;
  if (currentCpuTemperatureScale === 'Fahrenheit') {
    newTemperaturesHtml = cpuInfo.temperatures.map(t => (t * 1.8 + 32).toFixed(1) + ' °F').join('<br/>');
  } else { // 'Celsius'
    newTemperaturesHtml = cpuInfo.temperatures.map(t => t.toFixed(1) + ' °C').join('<br/>');
  }

  if (domCache.cpuTemperatures.innerHTML !== newTemperaturesHtml) {
    domCache.cpuTemperatures.innerHTML = newTemperaturesHtml;
  }
}

function initMemory() {
  chrome.system.memory.getInfo(function(memoryInfo) {
    domCache.memoryCapacity = document.querySelector('#memory-capacity');
    domCache.memoryCapacity.textContent = formatBytes(memoryInfo.capacity);

    domCache.memoryUsage = document.querySelector('#memory-usage');
    var bar = document.createElement('div');
    bar.classList.add('bar');
    var usedSection = document.createElement('span');
    usedSection.classList.add('bar-section', 'used');
    bar.appendChild(usedSection);
    domCache.memoryUsage.appendChild(bar);
    domCache.memoryUsageBar = bar; // Cache the bar itself
    domCache.memoryUsageUsed = usedSection; // Cache the used section
  });
}

function updateMemoryUsage() {
  chrome.system.memory.getInfo(function(memoryInfo) {
    if (!domCache.memoryUsageBar || !domCache.memoryUsageUsed) return; // Guard

    const usedMemoryPercent = 100 - Math.round(memoryInfo.availableCapacity / memoryInfo.capacity * 100);
    // Ensure formatBytes returns a consistent format, or consider comparing raw byte values if formatBytes is complex.
    // For now, assume title comparison is fine.
    const newTitle = formatBytes(memoryInfo.capacity - memoryInfo.availableCapacity) + ' GB : ' + usedMemoryPercent + ' %';
    const newWidth = usedMemoryPercent + '%';

    if (domCache.memoryUsageBar.title !== newTitle) {
      domCache.memoryUsageBar.title = newTitle;
    }
    if (domCache.memoryUsageUsed.style.width !== newWidth) {
      domCache.memoryUsageUsed.style.width = newWidth;
    }
  });
};

function updateDisplays() {
  chrome.system.display.getInfo(function(displayInfo) {
    if (!domCache.primaryDisplay) {
        domCache.primaryDisplay = document.querySelector('#primary-display');
    }
    if (!domCache.otherDisplays) {
        domCache.otherDisplays = document.querySelector('#other-displays');
    }

    let primaryDisplayHtml = '';
    let otherDisplaysHtml = '';

    for (var i = 0; i < displayInfo.length; i++) {
      var name = (displayInfo[i].name) ? displayInfo[i].name + ' - ' : '';
      var refreshRate = (displayInfo[i].refreshRate) ? ' (' + displayInfo[i].refreshRate + ')' : '';
      var dpi = (displayInfo[i].dpiX) ? ' - ' + parseInt(displayInfo[i].dpiX, 10) + 'dpi' : '';
      var displayHtml = '<div>' + name + displayInfo[i].bounds.width + 'x' +
                    displayInfo[i].bounds.height + refreshRate + dpi + '</div>';
      if (displayInfo[i].isPrimary) {
        primaryDisplayHtml += displayHtml;
      } else {
        otherDisplaysHtml += displayHtml;
      }
    }

    if (primaryDisplayHtml === '') primaryDisplayHtml = '-';
    if (otherDisplaysHtml === '') otherDisplaysHtml = '-';

    if (domCache.primaryDisplay.innerHTML !== primaryDisplayHtml) {
      domCache.primaryDisplay.innerHTML = primaryDisplayHtml;
    }
    if (domCache.otherDisplays.innerHTML !== otherDisplaysHtml) {
      domCache.otherDisplays.innerHTML = otherDisplaysHtml;
    }
  });
}

function updateAll() {
  updateCpuUsage();
  updateDisplays();
  updateMemoryUsage();
  updateStorage();
}

function animationLoop(timestamp) {
  animationFrameId = requestAnimationFrame(animationLoop);
  if (timestamp - lastUpdateTime >= updateInterval) {
    lastUpdateTime = timestamp;
    updateAll();
  }
}

chrome.runtime.onSuspend.addListener(function() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});

chrome.runtime.onSuspendCanceled.addListener(function() {
  lastUpdateTime = performance.now() - updateInterval; // Trigger update quickly on resume
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = requestAnimationFrame(animationLoop);
});

document.addEventListener('DOMContentLoaded', function() {
  domCache.topBar = document.querySelector('.topbar');

  // Add scroll event listener for topbar shadow
  window.addEventListener('scroll', function() {
    if (window.scrollY > 0) {
      domCache.topBar.classList.add('shadow');
    } else {
      domCache.topBar.classList.remove('shadow');
    }
  });
  domCache.topBar.innerHTML += ' ' + chrome.runtime.getManifest().version;

  initLabels();

  initInfo();
  initBattery();
  initCpu();
  initMemory();
  initPlugins();
  // Start the animation loop instead of calling updateAll directly
  lastUpdateTime = performance.now() - updateInterval; // To trigger the first update quickly
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId); // Ensure no multiple loops if event fires multiple times
  }
  animationFrameId = requestAnimationFrame(animationLoop);
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync' && changes.cpuTemperatureScale) {
    currentCpuTemperatureScale = changes.cpuTemperatureScale.newValue;
    // previousCpuInfo holds the last full cpuInfo object.
    if (previousCpuInfo && previousCpuInfo.temperatures) {
      updateCpuTemperatures(previousCpuInfo);
    }
  }
});
