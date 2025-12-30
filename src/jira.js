const Jira = (() => {
  const apiBaseOverride = typeof window !== 'undefined' ? (window.JIRA_API_BASE || '') : '';

  function getOAuthBase() {
    if (typeof window !== 'undefined' && window.JiraOAuth?.getApiBase) {
      const base = window.JiraOAuth.getApiBase();
      if (base) return base;
    }
    return '';
  }

  function buildJiraUrl(domain, path) {
    const oauthBase = getOAuthBase();
    if (oauthBase) {
      return `${oauthBase}${path}`;
    }
    const base = apiBaseOverride
      ? String(apiBaseOverride).replace(/\/$/, '')
      : `https://${domain}`;
    return `${base}${path}`;
  }

  async function getJiraUrl(domain, path) {
    return buildJiraUrl(domain, path);
  }

  async function getAuthHeaders() {
    const headers = { Accept: 'application/json' };
    if (typeof window !== 'undefined' && window.JiraOAuth?.getAccessToken) {
      const token = await window.JiraOAuth.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async function jiraFetch(url, options = {}) {
    const authHeaders = await getAuthHeaders();
    const headers = { ...authHeaders, ...(options.headers || {}) };
    return fetch(url, { ...options, headers });
  }

  async function fetchBoardsByJql(domain) {
    const boards = [];
    let startAt = 0;
    const maxResults = 50;
    let keepGoing = true;
    while (keepGoing) {
      const url = await getJiraUrl(domain, `/rest/agile/1.0/board?startAt=${startAt}&maxResults=${maxResults}`);
      const response = await jiraFetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load boards (${response.status})`);
      }
      const payload = await response.json();
      const values = payload.values || [];
      boards.push(...values);
      startAt += values.length;
      keepGoing = !payload.isLast && values.length === maxResults;
    }
    return boards;
  }

  return {
    buildJiraUrl,
    getJiraUrl,
    jiraFetch,
    fetchBoardsByJql
  };
})();
