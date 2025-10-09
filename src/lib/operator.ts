import { getEnv } from './env';

export function getOperatorNumber(): string | null {
  const env = getEnv();
  const num = (env.TWILIO_OPERATOR_NUMBER || '').trim();
  return num || null;
}


