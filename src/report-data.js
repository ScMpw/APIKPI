const ReportData = (() => {
  const constants = {
    boardGroups: {
      SCO: ['4133', '4132', '4131'],
      MCO: ['2796', '2526', '6346'],
      Butterfly: ['6347', '6390'],
      ACOSS: ['2796', '2526', '6346', '4133', '4132', '4131', '6347', '6390', '4894']
    },
    displaySprintCount: 6,
    ratingWindow: 4,
    cycleTimeStart: new Date('2025-06-09'),
    piLabelRe: /\b(?:BF_)?\d{4}_PI\d+_committ?ed\b/i,
    sprintKeyRe: /\b(?:\d{4}[-_ ]?)?(?:PI)?(\d+)[-_ ]?(\d+)(?:[|/](\d+))?\b/i
  };

  let epicCache = new Map();

  async function buildJiraUrl(domain, path) {
    return Jira.getJiraUrl(domain, path);
  }

  function extractSprintKey(name) {
    const m = (name || '').match(constants.sprintKeyRe);
    if (!m) return name;
    const pi = m[1];
    let sprint = m[2] || '';
    if (m[3]) {
      sprint = m[2];
    } else if (sprint.length > 1) {
      sprint = sprint[0];
    }
    return `PI${pi}-${sprint}`;
  }

  function filterRecentSprints(allSprintsList, excludeIds = [], desiredCount = constants.displaySprintCount) {
    const excluded = new Set((excludeIds || []).map(String));

    const sorted = allSprintsList.slice().sort((a, b) => {
      const ad = a.endDate || a.completeDate || a.startDate || '';
      const bd = b.endDate || b.completeDate || b.startDate || '';
      return ad && bd ? new Date(bd) - new Date(ad) : 0;
    });
    return sorted.slice(0, desiredCount).filter(s => !excluded.has(String(s.id)));
  }

  async function runBatches(items, batchSize, handler) {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map(handler));
    }
  }

  async function getEpicInfo(domain, epicKey) {
    let cached = epicCache.get(epicKey);
    if (cached) return cached;

    const url = await buildJiraUrl(domain, `/rest/api/3/issue/${epicKey}?fields=issuetype,labels`);
    const r = await Jira.jiraFetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const isEpic = (j.fields?.issuetype?.name || '').toLowerCase() === 'epic';
    const labels = j.fields?.labels || [];
    const info = { isEpic, labels };
    epicCache.set(epicKey, info);
    return info;
  }

  async function populateBoards(boardChoices) {
    const domain = document.getElementById('jiraDomain').value.trim();
    const hasOAuthToken = typeof window.JiraOAuth?.hasValidToken === 'function' ? window.JiraOAuth.hasValidToken() : false;
    const hasCloud = typeof window.JiraOAuth?.getCloudId === 'function' ? !!(await window.JiraOAuth.getCloudId()) : false;
    if ((!domain && !hasCloud) || !boardChoices || !hasOAuthToken) return;
    try {
      const boards = await Jira.fetchBoardsByJql(domain);
      boardChoices.clearChoices();
      const groupChoices = Object.keys(constants.boardGroups).map(g => ({ value: g, label: g }));
      boardChoices.setChoices([
        ...boards.map(b => ({ value: String(b.id), label: b.name })),
        ...groupChoices
      ], 'value', 'label', true);
      boardChoices.removeActiveItems();
      const show = boards.length ? '' : 'none';
      document.getElementById('boardLabel').style.display = show;
      document.getElementById('loadBtn').style.display = show;
    } catch (e) {
      Logger.error('Failed to load boards', e);
    }
  }

  async function fetchDisruptionData(jiraDomain, boardNums = []) {
    Logger.info('Fetching disruption data for boards', boardNums.join(','));
    const combined = {};
    const issueCache = new Map();
    try {
      const boardToGroups = {};
      const uniqueBoards = [];
      boardNums.forEach(b => {
        if (constants.boardGroups[b]) {
          constants.boardGroups[b].forEach(id => {
            uniqueBoards.push(id);
            if (!boardToGroups[id]) boardToGroups[id] = [];
            boardToGroups[id].push(b);
          });
        } else {
          uniqueBoards.push(b);
        }
      });
      const fetchBoards = Array.from(new Set(uniqueBoards));
      await runBatches(fetchBoards, 3, async boardNum => {
        const boardKey = boardNum;

        const isBfBoard = ['6347', '6390'].includes(String(boardNum));
        const velocityUrl = await buildJiraUrl(
          jiraDomain,
          `/rest/greenhopper/1.0/rapid/charts/velocity?rapidViewId=${boardNum}`
        );
        const resp = await Jira.jiraFetch(velocityUrl);
        let data = {};
        if (resp.ok) {
          data = await resp.json();
        } else {
          Logger.warn('Velocity report unavailable, falling back to sprint list', resp.status);
        }

        let closed = (data.sprints || []).filter(
          s => s.state === 'CLOSED' && s.startDate && String(s.originBoardId) === String(boardNum)
        );

        if (!closed.length) {
          let allSprintsList = [];
          let startAt = 0;
          const maxResults = 50;
          let loops = 0;
          while (true) {
            const sUrl = await buildJiraUrl(
              jiraDomain,
              `/rest/agile/1.0/board/${boardNum}/sprint?state=active,closed&startAt=${startAt}&maxResults=${maxResults}`
            );
            const sResp = await Jira.jiraFetch(sUrl);
            if (!sResp.ok) {
              Logger.error('Failed to fetch sprint list', sResp.status);
              break;
            }
            const sData = await sResp.json();
            const values = sData.values || [];
            allSprintsList = allSprintsList.concat(values);
            startAt += values.length;
            loops++;
            if (sData.isLast || values.length < maxResults || loops > 100) break;
          }
          closed = allSprintsList.filter(
            s => (s.state || '').toUpperCase() === 'CLOSED' && s.startDate && String(s.originBoardId) === String(boardNum)
          );
        }

        closed = filterRecentSprints(closed, [], constants.displaySprintCount + constants.ratingWindow);

        await runBatches(closed, 2, async s => {

          try {
            const sprintReportUrl = await buildJiraUrl(
              jiraDomain,
              `/rest/greenhopper/1.0/rapid/charts/sprintreport?rapidViewId=${boardNum}&sprintId=${s.id}`
            );
            const r = await Jira.jiraFetch(sprintReportUrl);
            if (!r.ok) return;
            const d = await r.json();
            let events = [];
            const collect = (arr, completed = false) => {
              (arr || []).forEach(it => {
                events.push({
                  key: it.key,
                  points: it.estimateStatistic?.statFieldValue?.value || 0,
                  addedAfterStart: false,
                  blocked: !!it.flagged,
                  movedOut: false,
                  completed
                });
              });
            };
            collect(d.contents.completedIssues, true);
            collect(d.contents.issuesNotCompletedInCurrentSprint, false);
            collect(d.contents.puntedIssues, false);
            // Include issues that were removed from the sprint. These appear only as
            // keys in the sprint report, so convert them into events so they are
            // fetched and processed like other issues.
            (d.contents?.issueKeysRemovedFromSprint || []).forEach(k => {
              if (!k) return;
              const existing = events.find(e => e.key === k);
              if (existing) {
                existing.movedOut = true;
                existing.completed = false;
              } else {
                events.push({
                  key: k,
                  points: 0,
                  addedAfterStart: false,
                  blocked: false,
                  movedOut: true,
                  completed: false
                });
              }
            });
            if (isBfBoard) {
              events = events.filter(ev => ev.key && ev.key.startsWith('BF-'));
            }

            let sprintStart = s.startDate ? new Date(s.startDate) : null;
            const sprintEnd = s.completeDate ? new Date(s.completeDate) : (s.endDate ? new Date(s.endDate) : null);
            if (sprintStart && sprintEnd && sprintStart > sprintEnd) {
              sprintStart = null;
            }

            await runBatches(events, 10, async ev => {
              try {
                let cached = issueCache.get(ev.key);
                let histories, currentStatus, created, resolutionDate, piRelevant, parentKey;
                if (cached) {
                  ({ histories, currentStatus, created, resolutionDate, piRelevant, parentKey } = cached);
                } else {
                  const u = await buildJiraUrl(
                    jiraDomain,
                    `/rest/api/3/issue/${ev.key}?expand=changelog&fields=flagged,status,created,resolutiondate,labels,parent,customfield_10002`
                  );
                  const ir = await Jira.jiraFetch(u);
                  if (!ir.ok) return;
                  const id = await ir.json();
                  histories = id.changelog?.histories || [];
                  currentStatus = id.fields?.status?.name || '';
                  created = id.fields?.created;
                  resolutionDate = id.fields?.resolutiondate;
                  parentKey = id.fields?.parent?.key;
                  ev.points = ev.points || Number(id.fields?.customfield_10002) || 0;
                  ev.blocked = ev.blocked || !!(id.fields?.flagged && id.fields.flagged.length);
                  ev.blocked = ev.blocked || currentStatus.toLowerCase().includes('block');
                  // Determine story points at sprint start
                  let initialPoints = ev.points || 0;
                  if (histories && sprintStart) {
                    const sortedHist = histories.slice().sort((a, b) => new Date(a.created) - new Date(b.created));
                    outer: for (const h of sortedHist) {
                      const chDate = new Date(h.created);
                      for (const item of h.items || []) {
                        const fieldName = (item.field || '').toLowerCase();
                        if (fieldName === 'story points' || fieldName === 'customfield_10002') {
                          const toVal = Number(item.toString || item.to);
                          const fromVal = Number(item.fromString || item.from);
                          if (chDate <= sprintStart) {
                            if (!isNaN(toVal)) initialPoints = toVal;
                          } else {
                            initialPoints = !isNaN(fromVal) ? fromVal : 0;
                            break outer;
                          }
                        }
                      }
                    }
                  }
                  ev.initialPoints = initialPoints;
                  piRelevant = false;
                  if (parentKey) {
                    const epic = await getEpicInfo(jiraDomain, parentKey);
                    if (epic?.isEpic && (epic.labels || []).some(l => constants.piLabelRe.test(l))) {
                      piRelevant = true;
                    }
                  }
                  issueCache.set(ev.key, { histories, currentStatus, created, resolutionDate, piRelevant, parentKey });
                }
                ev.piRelevant = piRelevant || false;

                const isBlockedStatus = name => (name || '').toLowerCase().includes('block');

                // determine status at sprint start by walking histories backwards
                const statusAt = (date) => {
                  let status = currentStatus;
                  const desc = histories.slice().sort((a, b) => new Date(b.created) - new Date(a.created));
                  for (const h of desc) {
                    const changeDate = new Date(h.created);
                    if (changeDate > date) {
                      const stItem = (h.items || []).find(i => i.field === 'status');
                      if (stItem) status = stItem.fromString || stItem.from || status;
                    } else {
                      break;
                    }
                  }
                  return status;
                };

                const startStatus = sprintStart ? statusAt(sprintStart) : currentStatus;
                let curBlocked = isBlockedStatus(startStatus);
                let blockStart = curBlocked ? sprintStart : null;
                const blockedPeriods = [];
                const sortedHist = histories.slice().sort((a, b) => new Date(a.created) - new Date(b.created));
                let devStart = null;
                for (const h of sortedHist) {
                  const date = new Date(h.created);
                  if (sprintStart && date < sprintStart) continue;
                  if (sprintEnd && date > sprintEnd) break;
                  const stItem = (h.items || []).find(i => i.field === 'status');
                  if (!stItem) continue;
                  const toStatus = stItem.toString || stItem.to || '';
                  if (!devStart && toStatus.toLowerCase() === 'in development') devStart = date;
                  const toBlocked = isBlockedStatus(toStatus);
                  if (curBlocked && !toBlocked) {
                    blockedPeriods.push([blockStart, date]);
                    curBlocked = false;
                    blockStart = null;
                  } else if (!curBlocked && toBlocked) {
                    curBlocked = true;
                    blockStart = date;
                  }
                }
                if (curBlocked) blockedPeriods.push([blockStart, sprintEnd || new Date()]);
                if (!blockedPeriods.length && ev.blocked) {
                  blockedPeriods.push([sprintStart, sprintEnd || new Date()]);
                }
                ev.blockedDays = blockedPeriods.reduce((sum, [start, end]) => {
                  const sClamped = sprintStart && start < sprintStart ? sprintStart : start;
                  const eClamped = sprintEnd && end > sprintEnd ? sprintEnd : end;
                  return eClamped > sClamped
                    ? sum + Kpis.calculateWorkDays(sClamped, eClamped)
                    : sum;
                }, 0);
                ev.blocked = ev.blocked || blockedPeriods.length > 0;
                ev.completedDate = resolutionDate;
                if (devStart && resolutionDate) {
                  ev.cycleTime = Kpis.calculateWorkDays(devStart, new Date(resolutionDate));
                }

                let pointsAtClose = ev.points || 0;
                if (sprintEnd) {
                  for (const h of sortedHist) {
                    const date = new Date(h.created);
                    if (date > sprintEnd) break;
                    for (const item of h.items || []) {
                      if (item.field === 'Story Points' || item.field === 'Story point estimate') {
                        const val = Number(item.toString || item.to);
                        if (!isNaN(val)) pointsAtClose = val;
                      }
                    }
                  }
                }
                ev.completedPoints = pointsAtClose;

                let addedDate = null;
                let inSprint = false;
                let wasInSprintAtStart = false;
                const sprintHist = histories.slice().sort((a, b) => new Date(a.created) - new Date(b.created));
                for (const h of sprintHist) {
                  const chDate = new Date(h.created);
                  for (const item of (h.items || [])) {
                    if (item.field === 'Sprint') {
                      const from = (item.fromString || item.from || '').toString();
                      const to = (item.toString || item.to || '').toString();
                      const sprintIdStr = String(s.id);
                      const sprintName = s.name || '';
                      const fromHas = from.includes(sprintIdStr) || from.includes(sprintName);
                      const toHas = to.includes(sprintIdStr) || to.includes(sprintName);
                      if (fromHas && !toHas) {
                        ev.movedOut = true;
                        if (sprintStart && chDate < sprintStart) ev.removedBeforeStart = true;
                        inSprint = false;
                      }
                      if (!fromHas && toHas) {
                        if (sprintStart && chDate < sprintStart) {
                          ev.removedBeforeStart = false;
                          inSprint = true;
                        } else if (!inSprint) {
                          inSprint = true;
                          addedDate = chDate;
                        }
                      }
                    }
                  }
                  if (sprintStart && chDate <= sprintStart) {
                    wasInSprintAtStart = inSprint;
                  }
                }

                if (!addedDate && sprintStart && created) {
                  const createdDate = new Date(created);
                  if (!inSprint && createdDate >= sprintStart) {
                    addedDate = createdDate;
                  }
                }

                if (addedDate && sprintStart && addedDate >= sprintStart && !wasInSprintAtStart) {
                  ev.addedAfterStart = true;
                }

              } catch (e) {}
            });

            const entry = data.velocityStatEntries?.[s.id] || {};
            let completed = entry.completed?.value || 0;
            let completedSource = 'velocityStatEntries.completed';
            if (!completed) {
              completed = d.contents?.completedIssuesEstimateSum?.value || 0;
              completedSource = 'completedIssuesEstimateSum';
            }

            const initiallyPlanned = events
              .filter(ev => !ev.addedAfterStart && !ev.removedBeforeStart)
              .reduce((sum, ev) => sum + (ev.initialPoints ?? ev.points ?? 0), 0);
            const initiallyPlannedSource = 'sum of events not added after start';

            const boardSprintName = s.name;
            const boardEntryKey = `${boardKey}-${boardNum}-${s.id}`;
            const existingBoard = combined[boardEntryKey] || { board: boardKey, id: s.id, name: boardSprintName, startDate: s.startDate, events: [], initiallyPlanned: 0, completed: 0, initiallyPlannedSource, completedSource };
            existingBoard.startDate = !existingBoard.startDate || new Date(existingBoard.startDate) > new Date(s.startDate) ? s.startDate : existingBoard.startDate;
            existingBoard.events = existingBoard.events.concat(events);
            existingBoard.initiallyPlanned += initiallyPlanned || 0;
            existingBoard.completed += completed || 0;
            combined[boardEntryKey] = existingBoard;
          } catch (e) {
            Logger.error('sprint fetch failed', e);
          }
        });
      });
      Logger.info('Disruption data fetched for', Object.keys(combined).length, 'sprints');
      const sprintsArr = Object.values(combined).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      return { sprints: sprintsArr, boardToGroups };
    } catch (e) {
      Logger.error('Failed to fetch disruption data', e);
      alert('Failed to fetch disruption data.');
      return { sprints: [] };
    }
  }

  return {
    constants,
    extractSprintKey,
    filterRecentSprints,
    populateBoards,
    fetchDisruptionData
  };
})();
