const DEFAULT_LOG_LEVEL = 3;

const readLogLevel = (): number => {
  const rawValue = process.env.NEXT_PUBLIC_LOG_LEVEL;

  if (!rawValue) {
    return DEFAULT_LOG_LEVEL;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_LOG_LEVEL;
  }

  return parsed;
};

const currentLogLevel = readLogLevel();

export type LogLevel = number;

export const log = (level: LogLevel, ...args: unknown[]): void => {
  if (!Number.isFinite(level) || level < 1) {
    return;
  }

  if (level > currentLogLevel) {
    return;
  }

  console.log(...args);
};
