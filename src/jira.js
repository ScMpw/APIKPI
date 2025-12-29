const Jira = (() => {
  function getAuthHeaders() {
    if (typeof window !== 'undefined' && typeof window.getJiraAuthHeaders === 'function') {
      return window.getJiraAuthHeaders();
    }
    return { Accept: 'application/json' };
  }

  async function fetchBoardsByJql(domain) {
    const boards = [];
    let startAt = 0;
    const maxResults = 50;
    let keepGoing = true;
    while (keepGoing) {
      const url = `https://${domain}/rest/agile/1.0/board?startAt=${startAt}&maxResults=${maxResults}`;
      const response = await fetch(url, { headers: getAuthHeaders() });
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
