const JiraApiToken = (() => {
  const storageKey = 'jiraApiToken';

  const dom = {
    status: 'apiStatus',
    disconnect: 'apiDisconnectBtn'
  };

  function parseStored() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
      return {};
    }
  }

  function clearStored() {
    localStorage.removeItem(storageKey);
  }

  function hasToken(data = parseStored()) {
    return !!(data.email && data.token);
  }

  function updateStatus(text) {
    const el = document.getElementById(dom.status);
    if (el) {
      el.textContent = text;
    }
  }

  function updateUi() {
    const stored = parseStored();
    const connected = hasToken(stored);
    const disconnectBtn = document.getElementById(dom.disconnect);
    if (disconnectBtn) disconnectBtn.disabled = !connected;
    updateStatus(connected ? 'Connected' : 'Not connected');
  }

  function disconnect() {
    clearStored();
    updateUi();
  }

  function getBasicAuthHeader() {
    const stored = parseStored();
    if (!hasToken(stored)) return null;
    return btoa(`${stored.email}:${stored.token}`);
  }

  function bindEvents() {
    const disconnectBtn = document.getElementById(dom.disconnect);
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);
  }

  function init() {
    bindEvents();
    updateUi();
  }

  return {
    init,
    hasToken,
    getBasicAuthHeader,
    disconnect
  };
})();

window.JiraApiToken = JiraApiToken;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (window.JiraApiToken?.init) {
      window.JiraApiToken.init();
    }
  });
}
