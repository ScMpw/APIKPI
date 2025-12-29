const Report = (() => {
  let boardChoices;
  let boardLabels = {};
  let sprints = [];
  let allSprints = [];
  let chartInstances = [];

  function appendLog(level, args) {
    const el = document.getElementById('logPanel');
    if (!el) return;
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    el.textContent += `[${level}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
    el.style.display = '';
  }

  function switchVersion(v) {
    window.location.href = v;
  }

  function applySprintData(nextSprints, nextLabels) {
    sprints = nextSprints;
    allSprints = nextSprints;
    boardLabels = nextLabels || {};

    sprints.forEach(s => { s.metrics = Disruption.calculateDisruptionMetrics(s.events); });
    ReportUI.renderTable(sprints);
    ReportUI.renderSprintList(sprints);
    document.getElementById('sprintRow').style.display = sprints.length ? '' : 'none';
    ReportUI.renderVelocityStats(allSprints);
    chartInstances = ReportCharts.renderCharts(sprints, allSprints, boardLabels, chartInstances);
  }

  async function loadDisruption() {
    const jiraDomain = document.getElementById('jiraDomain').value.trim();
    const hasCloud = typeof window.hasJiraCloudId === 'function' ? await window.hasJiraCloudId() : false;
    const selected = boardChoices ? boardChoices.getValue() : [];
    const boards = selected.map(b => b.value);
    boardLabels = {};
    selected.forEach(b => { boardLabels[b.value] = b.label; });
    if ((!jiraDomain && !hasCloud) || !boards.length) {
      alert('Enter Jira domain or connect via OAuth, then select boards.');
      return;
    }
    Logger.info('Loading disruption report for boards', boards.join(','));
    const { sprints: fetchedSprints, boardToGroups } = await ReportData.fetchDisruptionData(jiraDomain, boards);
    allSprints = fetchedSprints;
    fetchedSprints.forEach(s => { s.metrics = Disruption.calculateDisruptionMetrics(s.events); });
    const byBoard = {};
    fetchedSprints.forEach(s => {
      if (!byBoard[s.board]) byBoard[s.board] = [];
      byBoard[s.board].push(s);
    });
    Object.values(byBoard).forEach(arr => arr.sort((a, b) => new Date(a.startDate) - new Date(b.startDate)));

    const groupMap = {};
    Object.entries(boardToGroups || {}).forEach(([boardId, groups]) => {
      groups.forEach(g => {
        if (!groupMap[g]) groupMap[g] = [];
        groupMap[g].push(boardId);
      });
    });

    Object.entries(groupMap).forEach(([group, boardIds]) => {
      const aggregated = [];
      for (let i = 0; i < ReportData.constants.displaySprintCount; i++) {
        const agg = {
          board: group,
          id: '',
          name: '',
          startDate: null,
          events: [],
          initiallyPlanned: 0,
          completed: 0,
          metrics: {
            pulledIn: 0,
            blockedDays: 0,
            movedOut: 0,
            spillover: 0,
            pulledInIssues: new Set(),
            blockedIssues: new Set(),
            movedOutIssues: new Set(),
            spilloverIssues: new Set()
          }
        };
        let found = false;
        boardIds.forEach(id => {
          const arr = byBoard[id] || [];
          const s = arr[arr.length - 1 - i];
          if (!s) return;
          found = true;
          if (!agg.name) {
            const sprintNum = i + 1;
            const sprintName = `${group} ${sprintNum}`;
            agg.name = sprintName;
            agg.id = sprintName;
          }
          if (!agg.startDate || new Date(agg.startDate) > new Date(s.startDate)) {
            agg.startDate = s.startDate;
          }
          agg.events = agg.events.concat(s.events || []);
          agg.initiallyPlanned += s.initiallyPlanned || 0;
          agg.completed += s.completed || 0;
          const m = s.metrics || {};
          agg.metrics.pulledIn += m.pulledIn || 0;
          agg.metrics.blockedDays += m.blockedDays || 0;
          agg.metrics.movedOut += m.movedOut || 0;
          agg.metrics.spillover += m.spillover || 0;
          (m.pulledInIssues || []).forEach(k => agg.metrics.pulledInIssues.add(k));
          (m.blockedIssues || []).forEach(k => agg.metrics.blockedIssues.add(k));
          (m.movedOutIssues || []).forEach(k => agg.metrics.movedOutIssues.add(k));
          (m.spilloverIssues || []).forEach(k => agg.metrics.spilloverIssues.add(k));
        });
        if (!found) break;
        aggregated.push(agg);
      }
      aggregated.forEach(s => {
        const m = s.metrics;
        const pulledSet = m.pulledInIssues;
        const blockedSet = m.blockedIssues;
        const movedOutSet = m.movedOutIssues;
        const spillSet = m.spilloverIssues;
        const spillPullSet = new Set([...pulledSet].filter(k => spillSet.has(k)));
        m.pulledInCount = pulledSet.size;
        m.blockedCount = blockedSet.size;
        m.movedOutCount = movedOutSet.size;
        m.spilloverCount = spillSet.size;
        m.spilloverPulledInCount = spillPullSet.size;
        m.pulledInIssues = Array.from(pulledSet);
        m.blockedIssues = Array.from(blockedSet);
        m.movedOutIssues = Array.from(movedOutSet);
        m.spilloverIssues = Array.from(spillSet);
        m.spilloverPulledInIssues = Array.from(spillPullSet);
      });
      aggregated.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      byBoard[group] = aggregated;
    });

    const selectedDisplay = [];
    const selectedAll = [];
    boards.forEach(b => {
      const arr = byBoard[b];
      if (arr) {
        selectedAll.push(...arr);
        selectedDisplay.push(...arr.slice(-ReportData.constants.displaySprintCount));
      }
    });
    sprints = selectedDisplay;
    allSprints = selectedAll;
    ReportUI.renderTable(sprints);
    ReportUI.renderSprintList(sprints);
    document.getElementById('sprintRow').style.display = sprints.length ? '' : 'none';
    ReportUI.renderVelocityStats(allSprints);
    chartInstances = ReportCharts.renderCharts(sprints, allSprints, boardLabels, chartInstances);
    Logger.info('Disruption report rendered');
  }

  function loadMockData() {
    const { sprints: mockSprints, boardLabels: mockLabels } = ReportMock.generateMockData();
    Logger.info('Loaded mock KPI data');
    applySprintData(mockSprints, mockLabels);
  }

  function exportPDF() {
    return ReportPDF.exportPDF(chartInstances);
  }

  function init() {
    Logger.setLevel('debug');
    Logger.setListener((level, args) => appendLog(level, args));
    Chart.register(ChartDataLabels);

    const boardSelect = document.getElementById('boardNum');
    boardChoices = new Choices(boardSelect, { removeItemButton: true });

    if (window.JiraOAuth?.init) {
      window.JiraOAuth.init();
      window.addEventListener('jira-auth-changed', () => ReportData.populateBoards(boardChoices));
    }

    document.getElementById('jiraDomain').addEventListener('change', () => ReportData.populateBoards(boardChoices));
    document.getElementById('jiraEmail').addEventListener('change', () => ReportData.populateBoards(boardChoices));
    document.getElementById('jiraToken').addEventListener('change', () => ReportData.populateBoards(boardChoices));

    ReportData.populateBoards(boardChoices);

    const mockButton = document.getElementById('mockBtn');
    if (mockButton) {
      mockButton.addEventListener('click', loadMockData);
    }

    const versionSelect = document.getElementById('versionSelect');
    if (versionSelect) {
      versionSelect.value = 'KPI_Report.html';
    }
  }

  return {
    init,
    switchVersion,
    loadDisruption,
    exportPDF,
    extractSprintKey: ReportData.extractSprintKey
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  Report.init();
});

window.switchVersion = Report.switchVersion;
window.loadDisruption = Report.loadDisruption;
window.exportPDF = Report.exportPDF;
