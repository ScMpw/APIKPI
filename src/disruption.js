const Disruption = (() => {
  function sumPoints(events) {
    return (events || []).reduce((sum, ev) => sum + (ev.points || 0), 0);
  }

  function calculateDisruptionMetrics(events = []) {
    const pulledInEvents = events.filter(ev => ev.addedAfterStart && !ev.movedOut);
    const blockedEvents = events.filter(ev => ev.blocked);
    const movedOutEvents = events.filter(ev => ev.movedOut);
    const spilloverEvents = events.filter(ev => !ev.completed && !ev.movedOut);

    const metrics = {
      pulledIn: sumPoints(pulledInEvents),
      pulledInCount: pulledInEvents.length,
      pulledInIssues: pulledInEvents.map(ev => ev.key).filter(Boolean),
      blockedDays: blockedEvents.reduce((sum, ev) => sum + (ev.blockedDays || 0), 0),
      blockedCount: blockedEvents.length,
      blockedIssues: blockedEvents.map(ev => ev.key).filter(Boolean),
      movedOut: sumPoints(movedOutEvents),
      movedOutCount: movedOutEvents.length,
      movedOutIssues: movedOutEvents.map(ev => ev.key).filter(Boolean),
      spillover: sumPoints(spilloverEvents),
      spilloverCount: spilloverEvents.length,
      spilloverIssues: spilloverEvents.map(ev => ev.key).filter(Boolean)
    };

    metrics.spilloverPulledInCount = metrics.spilloverIssues.filter(issue =>
      metrics.pulledInIssues.includes(issue)
    ).length;

    return metrics;
  }

  return {
    calculateDisruptionMetrics
  };
})();
