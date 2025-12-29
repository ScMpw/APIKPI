const JiraAuth = (() => {
  async function getAuthHeaders() {
    if (typeof window !== 'undefined' && window.JiraOAuth?.getAccessToken) {
      const token = await window.JiraOAuth.getAccessToken();
      if (token) {
        return {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        };
      }
    }
    const email = document.getElementById('jiraEmail')?.value.trim();
    const token = document.getElementById('jiraToken')?.value.trim();
    if (!email || !token) {
      return { Accept: 'application/json' };
    }
    const basicAuth = btoa(`${email}:${token}`);
    return {
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth}`
    };
  }

  async function buildJiraUrl(domain, path) {
    if (typeof window !== 'undefined' && window.JiraOAuth?.getCloudId) {
      const cloudId = await window.JiraOAuth.getCloudId();
      if (cloudId) {
        return `https://api.atlassian.com/ex/jira/${cloudId}${path}`;
      }
    }
    return `https://${domain}${path}`;
  }

  async function hasJiraCloudId() {
    if (typeof window !== 'undefined' && window.JiraOAuth?.getCloudId) {
      const cloudId = await window.JiraOAuth.getCloudId();
      return !!cloudId;
    }
    return false;
  }

  async function jiraFetch(url, options = {}) {
    const authHeaders = await getAuthHeaders();
    const headers = { ...(options.headers || {}), ...authHeaders };
    return fetch(url, { ...options, headers });
  }

  window.getJiraAuthHeaders = getAuthHeaders;
  window.buildJiraUrl = buildJiraUrl;
  window.hasJiraCloudId = hasJiraCloudId;
  window.jiraFetch = jiraFetch;

  return { getAuthHeaders, jiraFetch, buildJiraUrl, hasJiraCloudId };
})();
