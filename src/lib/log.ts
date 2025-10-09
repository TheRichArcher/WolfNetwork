export type LogLevel = 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown> & {
  event: string;
  timestamp?: string;
};

export function logEvent(fields: LogFields, level: LogLevel = 'info'): void {
  const payload = {
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'warn') {
    console.warn(line);
  } else if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}


