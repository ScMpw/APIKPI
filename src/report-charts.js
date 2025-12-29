const ReportCharts = (() => {
  function renderBoardCharts(displaySprints, allSprints, container) {
    const sprintLabels = displaySprints.map(s => s.name);
    const completedSPAll = (allSprints || displaySprints).map(s => s.completed || 0);
    const completedSP = completedSPAll.slice(-displaySprints.length);
    const metricsArr = displaySprints.map(s => s.metrics || Disruption.calculateDisruptionMetrics(s.events));
    const pulledInCount = metricsArr.map(m => m.pulledInCount || 0);
    const blockedDays = metricsArr.map(m => Math.ceil((m.blockedDays || 0) * 10) / 10);
    const blockedCount = metricsArr.map(m => m.blockedCount || 0);
    const movedOutCount = metricsArr.map(m => m.movedOutCount || 0);
    const spilloverCount = metricsArr.map(m => m.spilloverCount || 0);
    const spilloverPulledInCount = metricsArr.map(m => m.spilloverPulledInCount || 0);
    const spilloverOnlyCount = spilloverCount.map((n, i) => n - spilloverPulledInCount[i]);

    function sumSP(events, pred, field = 'points') {
      return (events || []).reduce((sum, ev) => {
        if (!pred(ev)) return sum;
        let val = ev[field];
        if ((field === 'initialPoints' || field === 'completedPoints') && (val === undefined || val === null)) {
          val = ev.points;
        }
        return sum + (val || 0);
      }, 0);
    }

    const plannedPI = displaySprints.map(s =>
      sumSP(s.events, ev => !ev.addedAfterStart && !ev.removedBeforeStart && ev.piRelevant, 'initialPoints')
    );
    const plannedOther = displaySprints.map(s =>
      sumSP(s.events, ev => !ev.addedAfterStart && !ev.removedBeforeStart && !ev.piRelevant, 'initialPoints')
    );
    const completedPI = displaySprints.map(s =>
      sumSP(s.events, ev => ev.completed && ev.piRelevant, 'completedPoints')
    );
    const completedOther = displaySprints.map((s, i) =>
      Math.max(0, (s.completed || 0) - completedPI[i])
    );

    const initialCompleted = displaySprints.map(s =>
      (s.events || [])
        .filter(ev => !ev.addedAfterStart && !ev.removedBeforeStart && !ev.movedOut && ev.completed)
        .reduce((sum, ev) => sum + ((ev.completedPoints ?? ev.points) || 0), 0)
    );

    const throughputPerSprint = displaySprints.map(s =>
      (s.events || []).filter(ev => ev.completed).length
    );

    const cycleTimePerSprint = displaySprints.map((s, idx) => {
      const sprintStart = s.startDate ? new Date(s.startDate) : null;
      if (!sprintStart || sprintStart <= ReportData.constants.cycleTimeStart) return null;
      const windowSprints = displaySprints
        .slice(Math.max(0, idx - 4), idx + 1)
        .filter(ws => ws.startDate && new Date(ws.startDate) > ReportData.constants.cycleTimeStart);
      const times = [];
      windowSprints.forEach(ws => {
        (ws.events || []).forEach(ev => {
          if (typeof ev.cycleTime === 'number') times.push(ev.cycleTime);
        });
      });
      if (!times.length) return null;
      times.sort((a, b) => a - b);
      const mid = Math.floor(times.length / 2);
      const median = times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
      return Number(median.toFixed(1));
    });

    const chartWidth = Math.max(sprintLabels.length * 120, 600);
    const piTitle = document.createElement('h2');
    piTitle.textContent = 'Initially planned & completed';
    container.appendChild(piTitle);
    const piCanvas = document.createElement('canvas');
    piCanvas.width = chartWidth;
    piCanvas.height = 300;
    piCanvas.dataset.type = 'pi';
    container.appendChild(piCanvas);

    const completedTitle = document.createElement('h2');
    completedTitle.textContent = 'Rating Zone Chart';
    container.appendChild(completedTitle);
    const completedCanvas = document.createElement('canvas');
    completedCanvas.width = chartWidth;
    completedCanvas.height = 300;
    completedCanvas.dataset.type = 'rating';
    container.appendChild(completedCanvas);
    const ratingInfoFragment = ReportUI.createRatingZoneInfo();
    if (ratingInfoFragment) {
      container.appendChild(ratingInfoFragment);
    }

    const throughputTitle = document.createElement('h2');
    throughputTitle.textContent = 'Throughput per Sprint';
    container.appendChild(throughputTitle);
    const throughputCanvas = document.createElement('canvas');
    throughputCanvas.width = chartWidth;
    throughputCanvas.height = 300;
    throughputCanvas.dataset.type = 'throughput';
    container.appendChild(throughputCanvas);

    const cycleTitle = document.createElement('h2');
    cycleTitle.textContent = 'Cycle Time (5-sprint median)';
    container.appendChild(cycleTitle);
    const cycleCanvas = document.createElement('canvas');
    cycleCanvas.width = chartWidth;
    cycleCanvas.height = 300;
    cycleCanvas.dataset.type = 'cycle';
    container.appendChild(cycleCanvas);

    const disruptionTitle = document.createElement('h2');
    disruptionTitle.textContent = 'Disruption Metrics';
    container.appendChild(disruptionTitle);
    const disruptionCanvas = document.createElement('canvas');
    disruptionCanvas.width = chartWidth;
    disruptionCanvas.height = 300;
    disruptionCanvas.dataset.type = 'disruption';
    container.appendChild(disruptionCanvas);

    const zonesBySprintAll = [];
    const avgBySprintAll = [];
    completedSPAll.forEach((_, i) => {
      const start = Math.max(0, i - ReportData.constants.ratingWindow);
      const window = completedSPAll.slice(start, i);
      if (!window.length) {
        avgBySprintAll.push(0);
        zonesBySprintAll.push(null);
        return;
      }
      const avg = Kpis.calculateVelocity(window);
      const sd = Kpis.calculateStdDev(window, avg);
      const max = Math.max(...window, avg + 3 * sd);
      avgBySprintAll.push(avg);
      zonesBySprintAll.push([
        { yMin: 0, yMax: Math.max(avg - 2 * sd, 0), color: 'rgba(254,202,202,0.5)' },
        { yMin: Math.max(avg - 2 * sd, 0), yMax: avg - sd, color: 'rgba(254,249,195,0.5)' },
        { yMin: avg - sd, yMax: avg, color: 'rgba(34,197,94,0.5)' },
        { yMin: avg, yMax: avg + sd, color: 'rgba(21,128,61,0.5)' },
        { yMin: avg + sd, yMax: avg + 2 * sd, color: 'rgba(34,197,94,0.5)' },
        { yMin: avg + 2 * sd, yMax: max, color: 'rgba(254,249,195,0.5)' }
      ]);
    });
    const zonesBySprint = zonesBySprintAll.slice(-displaySprints.length);
    const avgBySprint = avgBySprintAll.slice(-displaySprints.length);
    const zoneMaxes = zonesBySprint.map(zs => zs ? zs[zs.length - 1].yMax : 0);
    const maxY = Math.max(...completedSP, ...zoneMaxes, ...avgBySprint);
    zonesBySprint.forEach(zs => { if (zs) { zs[zs.length - 1].yMax = maxY; } });

    const ratingZonesPlugin = {
      id: 'ratingZones',
      beforeDraw(chart, args, opts) {
        const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
        ctx.save();
        opts.zonesBySprint.forEach((zs, i) => {
          if (!zs) return;
          const isFirst = i === 0;
          const isLast = i === opts.zonesBySprint.length - 1;
          const xStart = isFirst ? left : x.getPixelForValue(i - 0.5);
          const xEnd = isLast ? right : x.getPixelForValue(i + 0.5);
          zs.forEach(z => {
            const yStart = y.getPixelForValue(z.yMax);
            const yEnd = y.getPixelForValue(z.yMin);
            ctx.fillStyle = z.color;
            ctx.fillRect(xStart, yStart, xEnd - xStart, yEnd - yStart);
          });
        });
        ctx.restore();
      }
    };

    const pctx = piCanvas.getContext('2d');

    function makeDiagonalPattern(ctx, color) {
      const size = 8;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.fillStyle = color;
      g.fillRect(0, 0, size, size);
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-2, 6); g.lineTo(6, -2);
      g.moveTo(2, 10); g.lineTo(10, 2);
      g.stroke();
      return ctx.createPattern(c, 'repeat');
    }
    const plannedPIColor = '#1d4ed8';
    const plannedOtherColor = '#60a5fa';
    const completedPIColor = '#16a34a';
    const completedOtherColor = '#86efac';
    const initialCompletedColor = '#f59e0b';

    const plannedPIFill = makeDiagonalPattern(pctx, plannedPIColor);
    const plannedOtherFill = makeDiagonalPattern(pctx, plannedOtherColor);

    const piMixChart = new Chart(pctx, {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: [
          { label: 'Initially Planned PI contributions', data: plannedPI, backgroundColor: plannedPIFill, borderColor: plannedPIColor, stack: 'planned', datalabels: { display: false } },
          {
            label: 'Initially Planned other',
            data: plannedOther,
            backgroundColor: plannedOtherFill,
            borderColor: plannedOtherColor,
            stack: 'planned',
            datalabels: {
              display: true,
              anchor: 'end',
              align: 'top',
              offset: -4,
              color: '#000',
              font: { weight: 'bold' },
              formatter: (v, ctx) => {
                const i = ctx.dataIndex;
                const plannedTotal = (plannedPI[i] || 0) + (plannedOther[i] || 0);
                return plannedTotal;
              }
            }
          },
          { label: 'Initial Plan completed', data: initialCompleted, backgroundColor: initialCompletedColor, borderColor: initialCompletedColor, stack: 'initialCompleted', datalabels: {
              display: true,
              anchor: 'end',
              align: 'top',
              offset: -4,
              color: '#000',
              font: { weight: 'bold' }
          } },
          { label: 'Completed PI contributions', data: completedPI, backgroundColor: completedPIColor, borderColor: completedPIColor, stack: 'completed', datalabels: { display: false } },
          {
            label: 'Completed other',
            data: completedOther,
            backgroundColor: completedOtherColor,
            borderColor: completedOtherColor,
            stack: 'completed',
            datalabels: {
              display: true,
              anchor: 'end',
              align: 'top',
              offset: -4,
              color: '#000',
              font: { weight: 'bold' },
              formatter: (v, ctx) => {
                const i = ctx.dataIndex;
                const completedTotal = (completedPI[i] || 0) + (completedOther[i] || 0);
                return completedTotal;
              }
            }
          },
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, offset: true },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Story Points' } }
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              footer(items) {
                const i = items[0].dataIndex;
                const plannedTotal = (plannedPI[i] || 0) + (plannedOther[i] || 0);
                const initCompleted = initialCompleted[i] || 0;
                const completedTotal = (completedPI[i] || 0) + (completedOther[i] || 0);
                return `Initially Planned total: ${plannedTotal}\nInitial Plan completed: ${initCompleted}\nCompleted total: ${completedTotal}`;
              }
            }
          },
          datalabels: { display: false }
        }
      }
    });

    const vctx = completedCanvas.getContext('2d');
    const completedChart = new Chart(vctx, {
      type: 'line',
      data: {
        labels: sprintLabels,
        datasets: [
          { label: 'Completed SP', data: completedSP, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.3)', fill: false, tension: 0.1 },
          { label: 'Average Velocity', data: avgBySprint, borderColor: '#000000', borderDash: [5,5], fill: false, tension: 0 }
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          x: { offset: true },
          y: { beginAtZero: true, suggestedMax: maxY, title: { display: true, text: 'Completed Story Points' } }
        },
        plugins: {
          legend: { position: 'bottom' },
          ratingZones: { zonesBySprint },
          datalabels: { display: false }
        }
      },
      plugins: [ratingZonesPlugin]
    });

    const tctx = throughputCanvas.getContext('2d');
    const throughputChart = new Chart(tctx, {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: [
          { label: 'Throughput per Sprint', data: throughputPerSprint, backgroundColor: '#f97316', borderColor: '#f97316' }
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          x: { offset: true },
          y: { beginAtZero: true, title: { display: true, text: 'Issues' } }
        },
        plugins: {
          legend: { position: 'bottom' },
          datalabels: {
            display: true,
            color: '#000',
            anchor: 'end',
            align: 'top'
          }
        }
      }
    });

    const cctx = cycleCanvas.getContext('2d');
    const cycleTimeChart = new Chart(cctx, {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: [
          { label: 'Cycle Time (5-sprint median)', data: cycleTimePerSprint, backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          x: { offset: true },
          y: { beginAtZero: true, title: { display: true, text: 'Days' } }
        },
        plugins: {
          legend: { position: 'bottom' },
          datalabels: {
            display: true,
            color: '#000',
            anchor: 'end',
            align: 'top'
          }
        }
      }
    });

    const dctx = disruptionCanvas.getContext('2d');
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 6;
    patternCanvas.height = 6;
    const patternCtx = patternCanvas.getContext('2d');
    patternCtx.fillStyle = '#f59e0b';
    patternCtx.fillRect(0, 0, 6, 6);
    patternCtx.strokeStyle = '#ffffff';
    patternCtx.beginPath();
    patternCtx.moveTo(0, 6);
    patternCtx.lineTo(6, 0);
    patternCtx.stroke();
    const hatchPattern = dctx.createPattern(patternCanvas, 'repeat');
    const disruptionChart = new Chart(dctx, {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: [
          { label: 'Pulled In Issues', data: pulledInCount, backgroundColor: '#3b82f6', borderColor: '#3b82f6', stack: 'pulledIn' },
          { label: 'Blocked Days', data: blockedDays, backgroundColor: '#ef4444', borderColor: '#ef4444', stack: 'blocked' },
          { label: 'Moved Out Issues', data: movedOutCount, backgroundColor: '#10b981', borderColor: '#10b981', stack: 'movedOut' },
          { label: 'Spillover Issues', data: spilloverOnlyCount, backgroundColor: '#f59e0b', borderColor: '#f59e0b', stack: 'spillover', datalabels: { display: false } },
          { label: 'Spillover & Pulled In Issues', data: spilloverPulledInCount, backgroundColor: hatchPattern, borderColor: '#f59e0b', stack: 'spillover', datalabels: { formatter: (v, ctx) => spilloverCount[ctx.dataIndex] } }
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          x: { offset: true, stacked: true },
          y: { beginAtZero: true, stacked: true, title: { display: true, text: 'Issue Count / Blocked Days' } }
        },
        plugins: {
          legend: { position: 'bottom' },
          datalabels: {
            display: true,
            color: '#000',
            anchor: 'end',
            align: 'top'
          }
        }
      }
    });

    return [piMixChart, completedChart, throughputChart, cycleTimeChart, disruptionChart];
  }

  function renderCharts(displaySprints, allSprints, boardLabels, chartInstances) {
    const section = document.getElementById('chartSection');
    if (!section) return [];
    section.innerHTML = '';
    (chartInstances || []).forEach(ch => ch.destroy());
    const nextInstances = [];
    const byBoardDisplay = {};
    (displaySprints || []).forEach(s => {
      const board = s.board;
      if (!byBoardDisplay[board]) byBoardDisplay[board] = [];
      byBoardDisplay[board].push(s);
    });
    const byBoardAll = {};
    (allSprints || []).forEach(s => {
      const board = s.board;
      if (!byBoardAll[board]) byBoardAll[board] = [];
      byBoardAll[board].push(s);
    });
    Object.keys(byBoardDisplay).forEach(boardId => {
      const title = document.createElement('h2');
      title.textContent = boardLabels[boardId] || `Board ${boardId}`;
      section.appendChild(title);
      const wrap = document.createElement('div');
      wrap.className = 'board-chart-wrapper';
      section.appendChild(wrap);
      const charts = renderBoardCharts(byBoardDisplay[boardId], byBoardAll[boardId] || [], wrap);
      nextInstances.push(...charts);
    });
    return nextInstances;
  }

  return {
    renderCharts
  };
})();
