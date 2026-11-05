/* Tiny dependency-free logger with timestamps and levels. */
const ts = () => new Date().toISOString();

export const logger = {
  info: (...args) => console.log(`[${ts()}] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${ts()}] [WARN]`, ...args),
  error: (...args) => console.error(`[${ts()}] [ERROR]`, ...args),
  debug: (...args) => {
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      console.log(`[${ts()}] [DEBUG]`, ...args);
    }
  },
};

export default logger;
