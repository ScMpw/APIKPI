const JiraOAuth = (() => {
  const storageKey = 'jiraOAuth';
  const sessionKey = 'jiraOAuthState';

  const dom = {
    clientId: 'jiraClientId',
    redirectUri: 'jiraRedirectUri',
    redirectUriPreview: 'jiraRedirectUriPreview',
    status: 'oauthStatus',
    connect: 'oauthConnectBtn',
    disconnect: 'oauthDisconnectBtn',
    domain: 'jiraDomain',
    scopes: 'oauthScopes'
  };

  const defaultScopes = [
    'read:jira-work',
    'read:user:jira',
    'read:board-scope:jira-software',
    'read:sprint:jira-software'
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

  function updateStatus(text) {
    const el = document.getElementById(dom.status);
    if (el) el.textContent = text;
  }

  function updateUi() {
    const stored = parseStored();
    const connected = !!stored.accessToken;
    const connectBtn = document.getElementById(dom.connect);
    const disconnectBtn = document.getElementById(dom.disconnect);
    if (connectBtn) connectBtn.disabled = connected;
    if (disconnectBtn) disconnectBtn.disabled = !connected;
    updateStatus(connected ? 'Connected' : 'Not connected');
  }

  function buildRedirectUri() {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}`;
  }

  function isLocalhost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  function validateRedirectUri(inputValue) {
    const computed = buildRedirectUri();
    const redirectUri = inputValue || computed;
    if (!redirectUri) {
      return { ok: false, message: 'Enter a redirect URI that matches the app configuration.' };
    }
    try {
      const url = new URL(redirectUri);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { ok: false, message: 'Redirect URI must use http or https. Hosting from file:// is not supported.' };
      }
      if (url.protocol === 'http:' && !isLocalhost(url.hostname)) {
        return { ok: false, message: 'Use https for non-localhost redirect URIs.' };
      }
    } catch (e) {
      return { ok: false, message: 'Redirect URI is not a valid URL.' };
    }
    if (computed && redirectUri !== computed) {
      return {
        ok: false,
        message: `Redirect URI must exactly match the current page URL: ${computed}`
      };
    }
    return { ok: true, redirectUri };
  }

  function setAutoRedirectUri() {
    const el = document.getElementById(dom.redirectUri);
    if (!el) return;
    const nextAuto = buildRedirectUri();
    const lastAuto = el.dataset.autoValue || '';
    if (!el.value || el.value === lastAuto) {
      el.value = nextAuto;
      el.dataset.autoValue = nextAuto;
    }
    const preview = document.getElementById(dom.redirectUriPreview);
    if (preview) {
      preview.value = nextAuto;
    }
  }

  function base64UrlEncode(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function sha256(input) {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(hash);
  }

  function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
  }

  function buildAuthUrl({ clientId, redirectUri, scopes, state, codeChallenge }) {
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: scopes.join(' '),
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  function getScopes() {
    const value = getInputValue(dom.scopes);
    if (!value) return defaultScopes;
    return value.split(/\s+/).filter(Boolean);
  }

  async function startAuthFlow() {
    const clientId = getInputValue(dom.clientId);
    if (!clientId) {
      alert('Enter your Atlassian OAuth Client ID.');
      return;
    }
    const redirectCheck = validateRedirectUri(getInputValue(dom.redirectUri));
    if (!redirectCheck.ok) {
      alert(redirectCheck.message);
      return;
    }
    const redirectUri = redirectCheck.redirectUri;

    const verifier = generateCodeVerifier();
    const state = crypto.randomUUID();
    const codeChallenge = await sha256(verifier);
    const scopes = getScopes();

    sessionStorage.setItem(sessionKey, JSON.stringify({ verifier, state, clientId, redirectUri, scopes }));
    window.location.href = buildAuthUrl({ clientId, redirectUri, scopes, state, codeChallenge });
  }

  async function exchangeToken({ code, verifier, clientId, redirectUri }) {
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OAuth token exchange failed: ${response.status} ${text}`);
    }

    return response.json();
  }

  async function refreshAccessToken(refreshToken, clientId) {
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OAuth refresh failed: ${response.status} ${text}`);
    }

    return response.json();
  }

  function normalizeDomain(value) {
    if (!value) return '';
    return value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }

  async function fetchAccessibleResources(accessToken, domainValue) {
    const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to load accessible resources: ${response.status} ${text}`);
    }
    const resources = await response.json();
    if (!Array.isArray(resources) || !resources.length) return null;

    const normalizedDomain = normalizeDomain(domainValue);
    if (normalizedDomain) {
      const match = resources.find(resource => {
        try {
          const url = new URL(resource.url);
          return url.host.toLowerCase() === normalizedDomain.toLowerCase();
        } catch (e) {
          return false;
        }
      });
      if (match) return match;
    }

    return resources[0];
  }

  async function handleCallback() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return;

    const sessionData = sessionStorage.getItem(sessionKey);
    if (!sessionData) {
      updateStatus('OAuth state missing. Try connecting again.');
      return;
    }
    const { verifier, state: storedState, clientId, redirectUri, scopes } = JSON.parse(sessionData);
    if (state !== storedState) {
      updateStatus('OAuth state mismatch. Try connecting again.');
      return;
    }

    try {
      const token = await exchangeToken({ code, verifier, clientId, redirectUri });
      const expiresAt = Date.now() + (token.expires_in || 0) * 1000;
      const domain = getInputValue(dom.domain);
      const resource = await fetchAccessibleResources(token.access_token, domain);
      const next = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt,
        scope: token.scope || scopes.join(' '),
        clientId,
        redirectUri,
        cloudId: resource ? resource.id : '',
        cloudUrl: resource ? resource.url : ''
      };
      store(next);
      if (!domain && resource?.url) {
        try {
          const url = new URL(resource.url);
          setInputValue(dom.domain, url.host);
        } catch (e) {
          // ignore
        }
      }
      updateUi();
    } catch (e) {
      updateStatus(e.message || 'OAuth failed');
    } finally {
      sessionStorage.removeItem(sessionKey);
      window.history.replaceState({}, document.title, buildRedirectUri());
    }
  }

  async function getAccessToken() {
    const stored = parseStored();
    if (!stored.accessToken) return null;
    if (!stored.expiresAt || Date.now() < stored.expiresAt - 30000) {
      return stored.accessToken;
    }
    if (!stored.refreshToken || !stored.clientId) return stored.accessToken;

    try {
      const refreshed = await refreshAccessToken(stored.refreshToken, stored.clientId);
      const expiresAt = Date.now() + (refreshed.expires_in || 0) * 1000;
      const next = {
        ...stored,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || stored.refreshToken,
        expiresAt,
        scope: refreshed.scope || stored.scope
      };
      store(next);
      return next.accessToken;
    } catch (e) {
      updateStatus('OAuth refresh failed. Reconnect.');
      return stored.accessToken;
    }
  }

  function getApiBase() {
    const stored = parseStored();
    if (!stored.cloudId) return '';
    return `https://api.atlassian.com/ex/jira/${stored.cloudId}`;
  }

  function hasToken() {
    return !!parseStored().accessToken;
  }

  function hasSite() {
    return !!parseStored().cloudId;
  }

  function disconnect() {
    clearStored();
    updateUi();
  }

  function init() {
    setAutoRedirectUri();
    const stored = parseStored();
    setInputValue(dom.clientId, stored.clientId);
    setInputValue(dom.redirectUri, stored.redirectUri);
    if (stored.scope) setInputValue(dom.scopes, stored.scope);
    handleCallback();
    updateUi();

    const connectBtn = document.getElementById(dom.connect);
    if (connectBtn) connectBtn.addEventListener('click', startAuthFlow);
    const disconnectBtn = document.getElementById(dom.disconnect);
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);
    const redirectInput = document.getElementById(dom.redirectUri);
    if (redirectInput) redirectInput.addEventListener('input', setAutoRedirectUri);
  }

  return {
    init,
    getAccessToken,
    getApiBase,
    hasToken,
    hasSite,
    disconnect
  };
})();

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    JiraOAuth.init();
  });
}
