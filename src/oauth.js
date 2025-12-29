const JiraOAuth = (() => {
  const storageKey = 'jiraOAuth';
  const pkceKey = 'jiraOAuthPkce';
  const scope = [
    'read:jira-work',
    'read:jira-user',
    'offline_access'
  ].join(' ');

  const dom = {
    clientId: 'jiraClientId',
    redirect: 'jiraRedirect',
    status: 'oauthStatus',
    connect: 'oauthConnectBtn',
    disconnect: 'oauthDisconnectBtn',
    siteSelect: 'jiraSiteSelect',
    siteRow: 'jiraSiteRow'
  };

  const listeners = new Set();

  function parseStored() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
      return {};
    }
  }

  function storeAuth(next) {
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function updateStored(patch) {
    const current = parseStored();
    const next = { ...current, ...patch };
    storeAuth(next);
    return next;
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

  function notify() {
    listeners.forEach(cb => cb());
    window.dispatchEvent(new CustomEvent('jira-auth-changed'));
  }

  function addListener(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function base64UrlEncode(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function randomString(length = 64) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function generatePkce() {
    const verifier = randomString(64);
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const challenge = base64UrlEncode(hash);
    return { verifier, challenge };
  }

  function getAuthMeta() {
    const stored = parseStored();
    return {
      clientId: getInputValue(dom.clientId) || stored.clientId || '',
      redirectUri: getInputValue(dom.redirect) || stored.redirectUri || ''
    };
  }

  function isTokenValid(auth) {
    if (!auth?.access_token || !auth?.expires_at) return false;
    return Date.now() + 60000 < auth.expires_at;
  }

  async function exchangeToken(payload) {
    const resp = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const message = await resp.text();
      throw new Error(`OAuth token exchange failed (${resp.status}): ${message}`);
    }
    return resp.json();
  }

  async function refreshToken(auth, clientId) {
    if (!auth?.refresh_token) return null;
    const data = await exchangeToken({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: auth.refresh_token
    });
    const updated = {
      ...auth,
      access_token: data.access_token,
      refresh_token: data.refresh_token || auth.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000
    };
    storeAuth(updated);
    return updated;
  }

  async function getAccessToken() {
    const auth = parseStored();
    const { clientId } = getAuthMeta();
    if (isTokenValid(auth)) {
      return auth.access_token;
    }
    if (auth?.refresh_token && clientId) {
      try {
        const refreshed = await refreshToken(auth, clientId);
        return refreshed?.access_token || null;
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  }

  async function fetchSites() {
    const token = await getAccessToken();
    if (!token) return [];
    const resp = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
      return [];
    }
    return resp.json();
  }

  async function getCloudId() {
    const stored = parseStored();
    if (stored?.cloudId) return stored.cloudId;
    const sites = stored?.sites || [];
    if (sites.length === 1) {
      updateStored({ cloudId: sites[0].id });
      return sites[0].id;
    }
    return null;
  }

  function setCloudId(cloudId) {
    updateStored({ cloudId });
    notify();
  }

  function updateStatus(text) {
    const el = document.getElementById(dom.status);
    if (el) {
      el.textContent = text;
    }
  }

  function renderSites(sites, selectedId) {
    const select = document.getElementById(dom.siteSelect);
    const row = document.getElementById(dom.siteRow);
    if (!select || !row) return;
    select.innerHTML = '';
    if (!sites.length) {
      row.style.display = 'none';
      return;
    }
    sites.forEach(site => {
      const opt = document.createElement('option');
      opt.value = site.id;
      opt.textContent = `${site.name || site.url} (${site.url})`;
      select.appendChild(opt);
    });
    if (selectedId) {
      select.value = selectedId;
    }
    row.style.display = '';
  }

  function updateUi() {
    const auth = parseStored();
    const connected = isTokenValid(auth);
    const connectBtn = document.getElementById(dom.connect);
    const disconnectBtn = document.getElementById(dom.disconnect);
    if (connectBtn) connectBtn.disabled = connected;
    if (disconnectBtn) disconnectBtn.disabled = !connected;
    updateStatus(connected ? 'Connected' : 'Not connected');
    renderSites(auth.sites || [], auth.cloudId);
  }

  async function beginAuth() {
    const { clientId, redirectUri } = getAuthMeta();
    if (!clientId || !redirectUri) {
      alert('Enter OAuth Client ID and Redirect URI before connecting.');
      return;
    }
    const { verifier, challenge } = await generatePkce();
    const state = randomString(24);
    sessionStorage.setItem(pkceKey, JSON.stringify({ verifier, state, redirectUri, clientId }));
    updateStored({ clientId, redirectUri });
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
    window.location.href = `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  async function handleRedirect() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    if (error) {
      updateStatus(`OAuth error: ${error}`);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
      return;
    }
    if (!code) return;
    const metaRaw = sessionStorage.getItem(pkceKey);
    if (!metaRaw) return;
    const meta = JSON.parse(metaRaw);
    if (state !== meta.state) {
      throw new Error('OAuth state mismatch.');
    }
    const data = await exchangeToken({
      grant_type: 'authorization_code',
      client_id: meta.clientId,
      code,
      redirect_uri: meta.redirectUri,
      code_verifier: meta.verifier
    });
    const stored = updateStored({
      clientId: meta.clientId,
      redirectUri: meta.redirectUri,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000
    });
    sessionStorage.removeItem(pkceKey);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, '', url.toString());
    updateStatus('Connected');
    const sites = await fetchSites();
    if (sites.length) {
      stored.sites = sites;
      if (sites.length === 1) {
        stored.cloudId = sites[0].id;
      }
      storeAuth(stored);
    }
    updateUi();
    notify();
  }

  async function loadSitesIfNeeded() {
    const auth = parseStored();
    if (!isTokenValid(auth)) return;
    if (auth.sites && auth.sites.length) {
      renderSites(auth.sites, auth.cloudId);
      return;
    }
    const sites = await fetchSites();
    if (sites.length) {
      updateStored({ sites });
      if (sites.length === 1) {
        updateStored({ cloudId: sites[0].id });
      }
    }
    updateUi();
  }

  function disconnect() {
    clearStored();
    updateUi();
    notify();
  }

  function bindEvents() {
    const connectBtn = document.getElementById(dom.connect);
    if (connectBtn) connectBtn.addEventListener('click', beginAuth);
    const disconnectBtn = document.getElementById(dom.disconnect);
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);
    const siteSelect = document.getElementById(dom.siteSelect);
    if (siteSelect) {
      siteSelect.addEventListener('change', () => {
        setCloudId(siteSelect.value);
        updateUi();
      });
    }
  }

  async function init() {
    const defaultRedirect = `${window.location.origin}${window.location.pathname}`;
    const stored = parseStored();
    setInputValue(dom.clientId, stored.clientId);
    setInputValue(dom.redirect, stored.redirectUri || defaultRedirect);
    bindEvents();
    await handleRedirect();
    updateUi();
    await loadSitesIfNeeded();
  }

  return {
    init,
    addListener,
    hasValidToken: () => isTokenValid(parseStored()),
    getAccessToken,
    getCloudId,
    setCloudId,
    disconnect
  };
})();

window.JiraOAuth = JiraOAuth;
