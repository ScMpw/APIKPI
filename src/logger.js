const Logger = (() => {
  const levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  let currentLevel = levels.info;
  let listener = null;

  function normalizeLevel(level) {
    return typeof level === 'string' ? (levels[level] ?? levels.info) : levels.info;
  }

  function log(level, args) {
    const levelValue = normalizeLevel(level);
    if (levelValue < currentLevel) return;
    if (listener) {
      listener(level, args);
      return;
    }
    const consoleFn = console[level] || console.log;
    consoleFn(...args);
  }

  return {
    setLevel(level) {
      currentLevel = normalizeLevel(level);
    },
    setListener(fn) {
      listener = fn;
    },
    debug(...args) {
      log('debug', args);
    },
    info(...args) {
      log('info', args);
    },
    warn(...args) {
      log('warn', args);
    },
    error(...args) {
      log('error', args);
    }
  };
})();
