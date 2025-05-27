document.addEventListener('DOMContentLoaded', function() {
  // CPU Information
  chrome.system.cpu.getInfo(function(cpuInfo) {
    document.getElementById('cpuModel').textContent = cpuInfo.modelName;
    document.getElementById('cpuArch').textContent = cpuInfo.archName;
    document.getElementById('cpuCores').textContent = cpuInfo.numOfProcessors;

    const processorsList = document.getElementById('cpuProcessors');
    processorsList.innerHTML = ''; // Clear previous entries
    cpuInfo.processors.forEach((processor, index) => {
      const listItem = document.createElement('li');
      listItem.textContent = `Processor ${index + 1}: Usage - ${Math.round(processor.usage.kernel + processor.usage.user)}% (Kernel: ${Math.round(processor.usage.kernel)}%, User: ${Math.round(processor.usage.user)}%, Idle: ${Math.round(processor.usage.idle)}%)`;
      processorsList.appendChild(listItem);
    });
    
    const temperaturesList = document.getElementById('cpuTemperatures');
    temperaturesList.innerHTML = ''; // Clear previous entries
    if (cpuInfo.temperatures && cpuInfo.temperatures.length > 0) {
        cpuInfo.temperatures.forEach((temp, index) => {
            const listItem = document.createElement('li');
            listItem.textContent = `CPU Temp ${index + 1}: ${temp}°C`;
            temperaturesList.appendChild(listItem);
        });
    } else {
        const listItem = document.createElement('li');
        listItem.textContent = 'Temperature data not available.';
        temperaturesList.appendChild(listItem);
    }
  });

  // Memory Information
  chrome.system.memory.getInfo(function(memoryInfo) {
    const capacityGB = (memoryInfo.capacity / (1024 * 1024 * 1024)).toFixed(2);
    const availableGB = (memoryInfo.availableCapacity / (1024 * 1024 * 1024)).toFixed(2);
    document.getElementById('memoryCapacity').textContent = capacityGB;
    document.getElementById('memoryAvailable').textContent = availableGB;
  });

  // Storage Information
  chrome.system.storage.getInfo(function(storageInfo) {
    const storageDiv = document.getElementById('storageInfo');
    storageDiv.innerHTML = ''; // Clear previous entries
    storageInfo.forEach(function(unit, index) {
      const unitDiv = document.createElement('div');
      unitDiv.innerHTML = `
        <p><strong>Storage Unit ${index + 1} (${unit.type}): ${unit.name}</strong></p>
        <p>ID: ${unit.id}</p>
        <p>Capacity: ${(unit.capacity / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
        <p>Available Capacity: ${(unit.availableCapacity / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
      `;
      storageDiv.appendChild(unitDiv);
      if(index < storageInfo.length -1) {
        const hr = document.createElement('hr');
        storageDiv.appendChild(hr);
      }
    });
  });

  // General Information
  chrome.runtime.getPlatformInfo(function(platformInfo) {
    document.getElementById('osInfo').textContent = platformInfo.os;
    document.getElementById('platformInfo').textContent = platformInfo.arch;
  });

  const userAgent = navigator.userAgent;
  const chromeVersionMatch = userAgent.match(/Chrome\/([0-9.]+)/);
  if (chromeVersionMatch && chromeVersionMatch[1]) {
    document.getElementById('chromeVersion').textContent = chromeVersionMatch[1];
  } else {
    document.getElementById('chromeVersion').textContent = 'Not available';
  }
});
