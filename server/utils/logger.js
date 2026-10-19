// This module is the console wrapper for the whole server; the no-console rule
// is disabled for this file in eslint.config.js.

const LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };

const activeLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'info');

const shouldLog = (level) => LEVEL_ORDER[level] >= (LEVEL_ORDER[activeLevel] ?? LEVEL_ORDER.info);

const format = (level, message, meta) => {
  const stamp = new Date().toISOString();
  const tail = meta && Object.keys(meta).length > 0 ? ` ${safeJson(meta)}` : '';
  return `${stamp} [${level.toUpperCase()}] ${message}${tail}`;
};

const safeJson = (value) => {
  try {
    return JSON.stringify(value, (_key, val) => (val instanceof Error ? serializeError(val) : val));
  } catch {
    return '[unserializable meta]';
  }
};

const serializeError = (error) => ({
  name: error.name,
  message: error.message,
  ...(error.statusCode ? { statusCode: error.statusCode } : {}),
});

export const logger = {
  debug(message, meta) {
    if (shouldLog('debug')) console.debug(format('debug', message, meta));
  },
  info(message, meta) {
    if (shouldLog('info')) console.info(format('info', message, meta));
  },
  warn(message, meta) {
    if (shouldLog('warn')) console.warn(format('warn', message, meta));
  },
  error(message, meta) {
    if (shouldLog('error')) console.error(format('error', message, meta));
  },
};

export default logger;
