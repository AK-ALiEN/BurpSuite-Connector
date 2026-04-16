const DEFAULT_CONFIG = {
  host: '127.0.0.1',
  port: '8080',
  enabled: false
};

async function loadConfig() {
  const result = await chrome.storage.local.get(['burpConfig']);
  return result.burpConfig || DEFAULT_CONFIG;
}

async function saveConfig(config) {
  await chrome.storage.local.set({ burpConfig: config });
}

function updateIcon(enabled) {
  const iconPath = enabled ? {
    "16": "icons/icon16-on.png",
    "32": "icons/icon32-on.png",
    "48": "icons/icon48-on.png",
    "128": "icons/icon128-on.png"
  } : {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  };
  
  chrome.action.setIcon({ path: iconPath });
}

async function setupProxy(config) {
  if (config.enabled) {
    const proxyConfig = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "http",
          host: config.host,
          port: parseInt(config.port)
        },
        bypassList: ["localhost", "127.0.0.1"]
      }
    };

    try {
      await chrome.proxy.settings.set({
        value: proxyConfig,
        scope: 'regular'
      });
      console.log('Proxy enabled:', config.host + ':' + config.port);
    } catch (error) {
      console.error('Error setting proxy:', error);
    }
  } else {
    try {
      await chrome.proxy.settings.clear({ scope: 'regular' });
      console.log('Proxy disabled');
    } catch (error) {
      console.error('Error clearing proxy:', error);
    }
  }
  
  updateIcon(config.enabled);
  chrome.runtime.sendMessage({
    action: 'statusChanged',
    config: config
  }).catch(() => {
  });
}

chrome.runtime.onStartup.addListener(async () => {
  const config = await loadConfig();
  await setupProxy(config);
});

chrome.runtime.onInstalled.addListener(async () => {
  const config = await loadConfig();
  await setupProxy(config);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    loadConfig().then(sendResponse);
    return true;
  }
  
  if (request.action === 'toggleProxy') {
    loadConfig().then(async (config) => {
      const newConfig = {
        ...config,
        enabled: !config.enabled
      };
      await saveConfig(newConfig);
      await setupProxy(newConfig);
      sendResponse({ success: true, config: newConfig });
    });
    return true;
  }
  
  if (request.action === 'updateSettings') {
    loadConfig().then(async (currentConfig) => {
      const newConfig = {
        ...currentConfig,
        host: request.host,
        port: request.port
      };
      await saveConfig(newConfig);
      
      if (currentConfig.enabled) {
        await setupProxy(newConfig);
      }
      
      sendResponse({ success: true, config: newConfig });
    });
    return true;
  }
});