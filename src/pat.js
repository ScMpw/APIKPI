const JiraPat = (() => {
  const storageKey = 'jiraPatToken';

  const dom = {
    token: 'jiraPatToken',
    status: 'patStatus',
    connect: 'patConnectBtn',
    disconnect: 'patDisconnectBtn',
    domain: 'jiraDomain',
    baseUrl: 'patBaseUrl',
    tokenName: 'patTokenName',
    expiration: 'patExpirationDays',
    endpoint: 'patEndpoint',
    jsonBody: 'patJsonBody',
    curlBasic: 'patCurlBasic',
    curlPat: 'patCurlPat',
    systemProps: 'patSystemProps'
  };

  const systemProperties = [
    {
      key: 'atlassian.pats.enabled',
      description: 'Enable or disable personal access tokens (true/false).'
    },
    {
      key: 'atlassian.pats.max.tokens.per.user',
      description: 'Limit the number of tokens each user can create.'
    },
    {
      key: 'atlassian.pats.expiry.days',
      description: 'Set the maximum/default expiry window (days).'
    }
  ];

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

  function normalizeBaseUrl(value) {
    if (!value) return '';
    const trimmed = value.trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }

  function buildDefaultBaseUrl() {
    const domainValue = getInputValue(dom.domain);
    return normalizeBaseUrl(domainValue);
  }

  function getJsonBody() {
    const name = getInputValue(dom.tokenName) || 'tokenName';
    const expirationValue = getInputValue(dom.expiration);
    const body = { name };
    if (expirationValue) {
      const days = Number.parseInt(expirationValue, 10);
      if (!Number.isNaN(days)) {
        body.expirationDuration = days;
      }
    }
    return JSON.stringify(body, null, 2);
  }

  function setAutoBaseUrl() {
    const el = document.getElementById(dom.baseUrl);
    if (!el) return;
    const nextAuto = buildDefaultBaseUrl();
    const lastAuto = el.dataset.autoValue || '';
    if (!el.value || el.value === lastAuto) {
      el.value = nextAuto;
      el.dataset.autoValue = nextAuto;
    }
  }

  function updatePatHelper() {
    const baseUrlEl = document.getElementById(dom.baseUrl);
    const endpointEl = document.getElementById(dom.endpoint);
    const jsonEl = document.getElementById(dom.jsonBody);
    const curlBasicEl = document.getElementById(dom.curlBasic);
    const curlPatEl = document.getElementById(dom.curlPat);
    if (!baseUrlEl || !endpointEl || !jsonEl || !curlBasicEl || !curlPatEl) {
      return;
    }

    const baseUrl = normalizeBaseUrl(baseUrlEl.value);
    const endpoint = baseUrl ? `${baseUrl}/rest/pat/latest/tokens` : '';
    const jsonBody = getJsonBody();

    endpointEl.value = endpoint;
    jsonEl.value = jsonBody;

    const basicCurl = endpoint
      ? `curl -X POST ${endpoint} -H "Content-Type: application/json" -d '${jsonBody}' --user "username:password"`
      : '';
    const patCurl = endpoint
      ? `curl -X POST ${endpoint} -H "Authorization: Bearer <Token>" -H "Content-Type: application/json" -d '${jsonBody}'`
      : '';

    curlBasicEl.value = basicCurl;
    curlPatEl.value = patCurl;
  }

  function renderSystemProperties() {
    const list = document.getElementById(dom.systemProps);
    if (!list) return;
    list.innerHTML = '';
    systemProperties.forEach(prop => {
      const item = document.createElement('li');
      item.textContent = `${prop.key} — ${prop.description}`;
      list.appendChild(item);
    });
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
    const domainInput = document.getElementById(dom.domain);
    if (domainInput) {
      domainInput.addEventListener('input', () => {
        setAutoBaseUrl();
        updatePatHelper();
      });
    }
    const baseUrlInput = document.getElementById(dom.baseUrl);
    if (baseUrlInput) baseUrlInput.addEventListener('input', updatePatHelper);
    const tokenNameInput = document.getElementById(dom.tokenName);
    if (tokenNameInput) tokenNameInput.addEventListener('input', updatePatHelper);
    const expirationInput = document.getElementById(dom.expiration);
    if (expirationInput) expirationInput.addEventListener('input', updatePatHelper);
  }

  function init() {
    const stored = parseStored();
    setInputValue(dom.token, stored.token);
    setAutoBaseUrl();
    renderSystemProperties();
    updatePatHelper();
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
