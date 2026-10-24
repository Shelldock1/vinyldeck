/**
 * Minimal logger. Debug chatter is stripped from production builds, while
 * warnings and errors remain visible for diagnosing failures in the field.
 */
const isDev = import.meta.env.DEV;

function call(method: "debug" | "warn" | "error", args: unknown[]) {
  // eslint-disable-next-line no-console
  console[method](...args);
}

export const logger = {
  debug(...args: unknown[]) {
    if (isDev) call("debug", args);
  },
  warn(...args: unknown[]) {
    call("warn", args);
  },
  error(...args: unknown[]) {
    call("error", args);
  },
};
