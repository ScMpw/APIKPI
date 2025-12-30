const JiraApiToken = (() => {
  const storageKey = 'jiraApiToken';

  const dom = {
    email: 'jiraApiEmail',
    token: 'jiraApiToken',
    status: 'apiStatus',
    connect: 'apiConnectBtn',
    disconnect: 'apiDisconnectBtn'
  };

  function parseStored() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
      return {};
    }
  }

  function store(next) {
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function clearStored() {
    localStorage.removeItem(storageKey);
  }

  function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el && value) {
      el.value = value;
    }
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
    const connectBtn = document.getElementById(dom.connect);
    const disconnectBtn = document.getElementById(dom.disconnect);
    if (connectBtn) connectBtn.disabled = connected;
    if (disconnectBtn) disconnectBtn.disabled = !connected;
    updateStatus(connected ? 'Connected' : 'Not connected');
  }

  function connect() {
    const email = getInputValue(dom.email);
    const token = getInputValue(dom.token);
    if (!email || !token) {
      alert('Enter Jira email and API token before saving.');
      return;
    }
    store({ email, token });
    updateUi();
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
    const connectBtn = document.getElementById(dom.connect);
    if (connectBtn) connectBtn.addEventListener('click', connect);
    const disconnectBtn = document.getElementById(dom.disconnect);
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);
  }

  function init() {
    const stored = parseStored();
    setInputValue(dom.email, stored.email);
    setInputValue(dom.token, stored.token);
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
