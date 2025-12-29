const Jira = (() => {
  function jiraFetch(url, options = {}) {
    if (typeof window !== 'undefined' && typeof window.jiraFetch === 'function') {
      return window.jiraFetch(url, options);
    }
    const headers = { ...(options.headers || {}), Accept: 'application/json' };
    return fetch(url, { ...options, headers });
  }

  async function fetchBoardsByJql(domain) {
    const boards = [];
    let startAt = 0;
    const maxResults = 50;
    let keepGoing = true;
    while (keepGoing) {
      const url = await window.buildJiraUrl(domain, `/rest/agile/1.0/board?startAt=${startAt}&maxResults=${maxResults}`);
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
    fetchBoardsByJql
  };
})();
