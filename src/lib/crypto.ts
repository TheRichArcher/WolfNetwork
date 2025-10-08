import { randomBytes, createCipheriv, createDecipheriv, createHmac } from 'crypto';
import { getEnv } from './env';

const ENC_ALGO = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16; // bytes

function getKey(): Buffer {
  const key = getEnv().ENCRYPTION_KEY || '';
  if (!key) throw new Error('ENCRYPTION_KEY missing');
  // Derive a 32-byte key from provided string using HMAC-SHA256
  const h = createHmac('sha256', 'wolf-key-derivation');
  h.update(key);
  return h.digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // recommended for GCM
  const cipher = createCipheriv(ENC_ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(ciphertextB64: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertextB64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 12 + AUTH_TAG_LENGTH);
  const data = buf.subarray(12 + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ENC_ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}


