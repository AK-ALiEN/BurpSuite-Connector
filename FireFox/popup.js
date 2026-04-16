const api = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', async function() {
  const hostInput = document.getElementById('host');
  const portInput = document.getElementById('port');
  const statusDiv = document.getElementById('status');
  const connectButton = document.getElementById('connectBtn');
  
  let currentConfig = null;

  async function loadConfiguration() {
    currentConfig = await api.runtime.sendMessage({ action: 'getConfig' });
    updateUI();
  }

  function updateUI() {
    if (!currentConfig) return;
    
    hostInput.value = currentConfig.host;
    portInput.value = currentConfig.port;
    
    if (currentConfig.enabled) {
      statusDiv.textContent = `Connected to ${currentConfig.host}:${currentConfig.port}`;
      statusDiv.className = 'status status-enabled';
      connectButton.textContent = 'Disconnect';
      connectButton.className = 'connect-btn disconnect';
    } else {
      statusDiv.textContent = 'Disconnected';
      statusDiv.className = 'status status-disabled';
      connectButton.textContent = 'Connect';
      connectButton.className = 'connect-btn';
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const saveSettings = debounce(async function() {
    if (!currentConfig) return;
    
    const host = hostInput.value.trim();
    const port = portInput.value.trim();
    
    if (!host) {
      alert('Please enter a host name');
      hostInput.value = currentConfig.host;
      return;
    }
    
    if (!port || parseInt(port) < 1 || parseInt(port) > 65535) {
      alert('Please enter a valid port number (1-65535)');
      portInput.value = currentConfig.port;
      return;
    }
    
    try {
      await api.runtime.sendMessage({
        action: 'updateSettings',
        host: host,
        port: port
      });
      
      await loadConfiguration();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, 500);

  hostInput.addEventListener('input', saveSettings);
  portInput.addEventListener('input', saveSettings);

  connectButton.addEventListener('click', async function() {
    try {
      const result = await api.runtime.sendMessage({ action: 'toggleProxy' });
      if (result.success) {
        currentConfig = result.config;
        updateUI();
      }
    } catch (error) {
      console.error('Error toggling proxy:', error);
      alert('Error toggling proxy connection');
    }
  });

  api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'statusChanged') {
      currentConfig = request.config;
      updateUI();
    }
  });

  await loadConfiguration();
});