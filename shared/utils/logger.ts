type LogMethod = (...args: unknown[]) => void;

const logInfo: LogMethod = (...args) => {
  console.log(...args);
};

const logWarn: LogMethod = (...args) => {
  console.warn(...args);
};

const logError: LogMethod = (...args) => {
  console.error(...args);
};

const logDebug: LogMethod = (...args) => {
  console.debug(...args);
};

export const logger = {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
};
