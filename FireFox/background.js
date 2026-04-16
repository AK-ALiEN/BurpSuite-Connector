const api = (typeof browser !== 'undefined') ? browser : chrome;
const isFirefox = (typeof browser !== 'undefined');

const STORAGE_KEY = 'burpConfig';
const DEFAULT_CONFIG = { host: '127.0.0.1', port: '8080', enabled: false };

function getStorage(key) {
  return new Promise((resolve) => {
    (api.storage || chrome.storage).local.get([key], res => resolve(res[key]));
  });
}
function setStorage(obj) {
  return new Promise((resolve) => {
    (api.storage || chrome.storage).local.set(obj, () => resolve());
  });
}

function setIcon(enabled) {
  const on = { "16":"icons/icon16-on.png","32":"icons/icon32-on.png","48":"icons/icon48-on.png","128":"icons/icon128-on.png" };
  const off= { "16":"icons/icon16.png","32":"icons/icon32.png","48":"icons/icon48.png","128":"icons/icon128.png" };
  if (api.action && api.action.setIcon) api.action.setIcon({ path: enabled ? on : off });
  else if (api.browserAction && api.browserAction.setIcon) api.browserAction.setIcon({ path: enabled ? on : off });
}

let currentCfg = Object.assign({}, DEFAULT_CONFIG);
let resolverAttached = false;
let resolverListener = null;

function makeResolverListener() {
  return function(details) {
    const url = details.url || "";
    if (url.startsWith("about:") || url.startsWith("moz-extension:") || url.startsWith("chrome:")) {
      return { type: "direct" };
    }
    return { type: "http", host: currentCfg.host, port: parseInt(currentCfg.port, 10) };
  };
}

function attachResolver() {
  if (!isFirefox) return;
  if (resolverAttached) return;
  resolverListener = makeResolverListener();
  try {
    api.proxy.onRequest.addListener(resolverListener, { urls: ["<all_urls>"] });
    resolverAttached = true;
    console.log("Proxy resolver attached");
  } catch (e) {
    console.error("attachResolver error:", e);
  }
}

function detachResolver() {
  if (!isFirefox) return;
  if (!resolverAttached) return;
  try {
    if (resolverListener && api.proxy.onRequest.removeListener) {
      api.proxy.onRequest.removeListener(resolverListener);
    }
  } catch (e) {
    console.warn("detachResolver removeListener failed:", e);
  }
  resolverListener = null;
  resolverAttached = false;
  console.log("Proxy resolver detached");
}

async function loadConfig() {
  const stored = await getStorage(STORAGE_KEY);
  currentCfg = Object.assign({}, DEFAULT_CONFIG, stored || {});
  return currentCfg;
}
async function saveConfig(cfg) {
  currentCfg = Object.assign({}, DEFAULT_CONFIG, cfg);
  await setStorage({ [STORAGE_KEY]: currentCfg });
}

async function applyState() {
  if (currentCfg.enabled) {
    attachResolver();
    setIcon(true);
  } else {
    detachResolver();
    setIcon(false);
  }
  try { api.runtime.sendMessage({ action: "statusChanged", config: currentCfg }); } catch (_) {}
}

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    if (!request || !request.action) return;
    if (request.action === 'getConfig') {
      await loadConfig();
      sendResponse(currentCfg); return;
    }
    if (request.action === 'toggleProxy') {
      await loadConfig();
      currentCfg.enabled = !currentCfg.enabled;
      await saveConfig(currentCfg);
      await applyState();
      sendResponse({ success: true, config: currentCfg }); return;
    }
    if (request.action === 'updateSettings') {
      await loadConfig();
      currentCfg.host = request.host || currentCfg.host;
      currentCfg.port = request.port || currentCfg.port;
      await saveConfig(currentCfg);
      await applyState();
      sendResponse({ success: true, config: currentCfg }); return;
    }
  })();
  return true;
});

(api.runtime.onInstalled || { addListener: ()=>{} }).addListener(async () => { await loadConfig(); await applyState(); });
(api.runtime.onStartup   || { addListener: ()=>{} }).addListener(async () => { await loadConfig(); await applyState(); });
