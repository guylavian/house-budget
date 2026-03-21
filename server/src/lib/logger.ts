// eslint-disable-next-line @typescript-eslint/no-require-imports
const log = require('log') as {
  get: (namespace: string) => Logger;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  notice: (...args: unknown[]) => void;
  warning: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export interface Logger {
  get: (namespace: string) => Logger;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  notice: (...args: unknown[]) => void;
  warning: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export default log as unknown as Logger;
