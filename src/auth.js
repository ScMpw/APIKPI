const JiraAuth = (() => {
  function getAuthHeaders() {
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

  function jiraFetch(url, options = {}) {
    const headers = { ...(options.headers || {}), ...getAuthHeaders() };
    return fetch(url, { ...options, headers });
  }

  window.getJiraAuthHeaders = getAuthHeaders;
  window.jiraFetch = jiraFetch;

  return { getAuthHeaders, jiraFetch };
})();
