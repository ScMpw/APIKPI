const ReportMock = (() => {
  function makeEvent(key, points, opts = {}) {
    return {
      key,
      points,
      initialPoints: opts.initialPoints ?? points,
      completedPoints: opts.completedPoints ?? points,
      addedAfterStart: !!opts.addedAfterStart,
      removedBeforeStart: !!opts.removedBeforeStart,
      blocked: !!opts.blocked,
      blockedDays: opts.blockedDays ?? 0,
      movedOut: !!opts.movedOut,
      completed: !!opts.completed,
      piRelevant: !!opts.piRelevant,
      cycleTime: opts.cycleTime ?? null
    };
  }

  function buildSprint(board, name, startDate, events) {
    const initiallyPlanned = events
      .filter(ev => !ev.addedAfterStart && !ev.removedBeforeStart)
      .reduce((sum, ev) => sum + (ev.initialPoints ?? ev.points ?? 0), 0);
    const completed = events
      .filter(ev => ev.completed)
      .reduce((sum, ev) => sum + (ev.completedPoints ?? ev.points ?? 0), 0);

    return {
      board,
      id: `${board}-${name}`,
      name,
      startDate,
      events,
      initiallyPlanned,
      completed,
      initiallyPlannedSource: 'mock data',
      completedSource: 'mock data'
    };
  }

  function generateMockData() {
    const baseDate = new Date();
    const boards = [
      { id: 'SCO', label: 'SCO' },
      { id: 'MCO', label: 'MCO' }
    ];

    const sprints = [];
    boards.forEach((board, boardIndex) => {
      for (let i = 0; i < 6; i += 1) {
        const sprintNumber = 6 - i;
        const startDate = new Date(baseDate);
        startDate.setDate(startDate.getDate() - (boardIndex * 60 + i * 14));

        const events = [
          makeEvent(`${board.id}-${sprintNumber}-A`, 5, { completed: true, piRelevant: true, cycleTime: 4 }),
          makeEvent(`${board.id}-${sprintNumber}-B`, 8, { completed: true, cycleTime: 6 }),
          makeEvent(`${board.id}-${sprintNumber}-C`, 3, { completed: false, blocked: true, blockedDays: 2 }),
          makeEvent(`${board.id}-${sprintNumber}-D`, 5, { completed: true, addedAfterStart: true }),
          makeEvent(`${board.id}-${sprintNumber}-E`, 2, { completed: false, movedOut: true }),
          makeEvent(`${board.id}-${sprintNumber}-F`, 8, { completed: true, piRelevant: true }),
          makeEvent(`${board.id}-${sprintNumber}-G`, 3, { completed: false })
        ];

        sprints.push(buildSprint(board.id, `${board.id} Sprint ${sprintNumber}`, startDate.toISOString(), events));
      }
    });

    const boardLabels = boards.reduce((acc, board) => {
      acc[board.id] = board.label;
      return acc;
    }, {});

    return { sprints, boardLabels };
  }

  return { generateMockData };
})();
