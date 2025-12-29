const ReportUI = (() => {
  function createRatingZoneInfo() {
    const tpl = document.getElementById('ratingZoneTemplate');
    if (!tpl) return null;
    const fragment = tpl.content.cloneNode(true);
    const info = fragment.querySelector('.rating-zone-description');
    const toggle = info?.querySelector('.rating-zone-toggle');
    const details = info?.querySelector('.rating-zone-details');
    if (toggle && details) {
      toggle.addEventListener('click', () => {
        const hidden = details.style.display === 'none';
        details.style.display = hidden ? '' : 'none';
        toggle.innerHTML = `<strong>Rating zones (${hidden ? 'hide' : 'show'})</strong>`;
      });
    }
    return fragment;
  }

  function renderSprintList(sprints) {
    const wrap = document.getElementById('sprintList');
    if (!wrap) return;
    wrap.innerHTML = (sprints || []).map(s =>
      `<span class="sprint-item">[${s.board}] ${s.name}</span>`
    ).join('');
  }

  function renderTable(data) {
    const tbody = document.getElementById('metricsBody');
    let html = '';
    const sorted = (data || []).slice().sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
    sorted.forEach((sprint, idx) => {
      const metrics = sprint.metrics || Disruption.calculateDisruptionMetrics(sprint.events);
      const detailsId = `details-${idx}`;
      const events = sprint.events || [];
      const piCompleted = events.filter(ev => ev.piRelevant && ev.completed).map(ev => ev.key);
      const piNotCompleted = events
        .filter(ev => ev.piRelevant && !ev.completed && !ev.movedOut)
        .map(ev => ev.key);
      const otherCompleted = events.filter(ev => !ev.piRelevant && ev.completed).map(ev => ev.key);
      const otherNotCompleted = events
        .filter(ev => !ev.piRelevant && !ev.completed && !ev.movedOut)
        .map(ev => ev.key);
      const initiallyPlannedIssues = Array.from(new Set(
        events.filter(ev => !ev.addedAfterStart && !ev.removedBeforeStart).map(ev => ev.key)
      ));
      const completedIssues = Array.from(new Set(
        events.filter(ev => ev.completed && !ev.movedOut).map(ev => ev.key)
      ));
      html += `<tr>
        <td>[${sprint.board}] ${sprint.name}</td>
        <td title="${sprint.initiallyPlannedSource}">${sprint.initiallyPlanned || 0}</td>
        <td title="${sprint.completedSource}">${sprint.completed || 0}</td>
        <td title="${metrics.pulledInIssues.join(', ')}">${metrics.pulledIn || 0} (${metrics.pulledInCount || 0})</td>
        <td title="${metrics.blockedIssues.join(', ')}">${(Math.ceil((metrics.blockedDays || 0) * 10) / 10).toFixed(1)} (${metrics.blockedCount || 0})</td>
        <td title="${metrics.movedOutIssues.join(', ')}">${metrics.movedOut || 0} (${metrics.movedOutCount || 0})</td>
        <td title="${metrics.spilloverIssues.join(', ')}">${metrics.spillover || 0} (${metrics.spilloverCount || 0})</td>
        <td title="${piCompleted.join(', ')}">${piCompleted.length}</td>
        <td title="${piNotCompleted.join(', ')}">${piNotCompleted.length}</td>
        <td title="${otherCompleted.join(', ')}">${otherCompleted.length}</td>
        <td title="${otherNotCompleted.join(', ')}">${otherNotCompleted.length}</td>
        <td><button class="btn details-toggle" onclick="toggleDetails('${detailsId}', this)">Show Details</button></td>
      </tr>`;
      html += `<tr id="${detailsId}" style="display:none"><td colspan="12">
        <table class="story-table">
          <thead><tr><th>Metric</th><th>Stories</th></tr></thead>
          <tbody>
            <tr><td>Initially Planned</td><td>${initiallyPlannedIssues.join(', ') || '-'}</td></tr>
            <tr><td>Completed</td><td>${completedIssues.join(', ') || '-'}</td></tr>
            <tr><td>Pulled In</td><td>${metrics.pulledInIssues.join(', ') || '-'}</td></tr>
            <tr><td>Blocked</td><td>${metrics.blockedIssues.join(', ') || '-'}</td></tr>
            <tr><td>Moved Out</td><td>${metrics.movedOutIssues.join(', ') || '-'}</td></tr>
            <tr><td>Spillover</td><td>${metrics.spilloverIssues.join(', ') || '-'}</td></tr>
            <tr><td>PI Completed</td><td>${piCompleted.join(', ') || '-'}</td></tr>
            <tr><td>PI Not Completed</td><td>${piNotCompleted.join(', ') || '-'}</td></tr>
            <tr><td>Other Completed</td><td>${otherCompleted.join(', ') || '-'}</td></tr>
            <tr><td>Other Not Completed</td><td>${otherNotCompleted.join(', ') || '-'}</td></tr>
          </tbody>
        </table>
      </td></tr>`;
    });
    tbody.innerHTML = html;
  }

  function renderVelocityStats(allSprints) {
    const wrap = document.getElementById('velocityStats');
    if (!wrap) return;

    let totalCompleted = 0;
    let totalCycle = 0;
    let cycleCount = 0;
    const sprintCount = (allSprints || []).length;

    (allSprints || []).forEach(s => {
      (s.events || []).forEach(ev => {
        if (ev.completed) {
          totalCompleted++;
          const sprintStart = s.startDate ? new Date(s.startDate) : null;
          if (sprintStart && sprintStart > ReportData.constants.cycleTimeStart && typeof ev.cycleTime === 'number') {
            totalCycle += ev.cycleTime;
            cycleCount++;
          }
        }
      });
    });

    const sprintThroughput = sprintCount ? totalCompleted / sprintCount : 0;
    const meanCycleTime = cycleCount ? totalCycle / cycleCount : 0;

    const html = '<h2>Throughput & Cycle Time</h2>' +
      '<table><thead><tr><th>Sprint Throughput</th><th>Mean Cycle Time (days)</th></tr></thead><tbody>' +
      `<tr><td>${sprintThroughput.toFixed(2)}</td><td>${(Math.ceil(meanCycleTime * 10) / 10).toFixed(1)}</td></tr></tbody></table>`;
    wrap.innerHTML = html;
  }

  function toggleDetails(id, btn) {
    const row = document.getElementById(id);
    if (row) {
      const hidden = row.style.display === 'none';
      row.style.display = hidden ? '' : 'none';
      if (btn) btn.textContent = hidden ? 'Hide Details' : 'Show Details';
    }
  }

  return {
    createRatingZoneInfo,
    renderSprintList,
    renderTable,
    renderVelocityStats,
    toggleDetails
  };
})();

window.toggleDetails = ReportUI.toggleDetails;
