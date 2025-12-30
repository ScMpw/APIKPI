const JiraPat = (() => {
  const storageKey = 'jiraPatToken';

  const dom = {
    token: 'jiraPatToken',
    status: 'patStatus',
    connect: 'patConnectBtn',
    disconnect: 'patDisconnectBtn'
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
    return !!data.token;
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
    const token = getInputValue(dom.token);
    if (!token) {
      alert('Enter a Jira personal access token before saving.');
      return;
    }
    store({ token });
    updateUi();
  }

  function disconnect() {
    clearStored();
    updateUi();
  }

  function getBearerHeader() {
    const stored = parseStored();
    if (!hasToken(stored)) return null;
    return stored.token;
  }

  function bindEvents() {
    const connectBtn = document.getElementById(dom.connect);
    if (connectBtn) connectBtn.addEventListener('click', connect);
    const disconnectBtn = document.getElementById(dom.disconnect);
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);
  }

  function init() {
    const stored = parseStored();
    setInputValue(dom.token, stored.token);
    bindEvents();
    updateUi();
  }

  return {
    init,
    hasToken,
    getBearerHeader,
    disconnect
  };
})();

window.JiraPat = JiraPat;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (window.JiraPat?.init) {
      window.JiraPat.init();
    }
  });
}
