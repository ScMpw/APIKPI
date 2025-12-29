const Kpis = (() => {
  function calculateWorkDays(start, end) {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
    if (endDate <= startDate) return 0;

    let count = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const endDay = new Date(endDate);
    endDay.setHours(0, 0, 0, 0);

    while (current < endDay) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        count += 1;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  function calculateVelocity(values) {
    if (!values || !values.length) return 0;
    const total = values.reduce((sum, v) => sum + (Number(v) || 0), 0);
    return total / values.length;
  }

  function calculateStdDev(values, mean) {
    if (!values || !values.length) return 0;
    const avg = typeof mean === 'number' ? mean : calculateVelocity(values);
    const variance = values.reduce((sum, v) => {
      const diff = (Number(v) || 0) - avg;
      return sum + diff * diff;
    }, 0) / values.length;
    return Math.sqrt(variance);
  }

  return {
    calculateWorkDays,
    calculateVelocity,
    calculateStdDev
  };
})();
