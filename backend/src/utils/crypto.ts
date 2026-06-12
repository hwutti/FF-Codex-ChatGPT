import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bit

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw) {
    throw new Error('ENCRYPTION_KEY nicht in .env gesetzt');
  }
  // SHA-256 des Keys → immer 32 Bytes egal wie lang der Input ist
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Verschlüsselt einen Plaintext-String.
 * Format: hex(iv):hex(authTag):hex(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96 bit IV für GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Entschlüsselt einen mit encrypt() verschlüsselten String.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Ungültiges Ciphertext-Format');
  const [ivHex, authTagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Maskiert einen GitHub-Token für die Anzeige.
 * ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx → ghp_****...xxxx
 */
export function decryptSecret(value?: string | null): string {
  if (!value) return '';
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

export function isMaskedSecret(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed === '********' || trimmed.includes('****') || trimmed.includes('•');
}

export function prepareSecretForStorage(input: unknown, current?: string | null): string | null {
  if (input === undefined) return current || null;
  const value = String(input || '').trim();
  if (!value) return null;
  if (isMaskedSecret(value)) return current || null;
  return encrypt(value);
}

export function maskSecret(value?: string | null): string {
  return decryptSecret(value) ? '********' : '';
}

export function maskToken(token: string): string {
  if (!token || token.length < 12) return '****';
  const prefix = token.substring(0, 4);  // "ghp_"
  const suffix = token.substring(token.length - 4); // letzte 4
  return `${prefix}****...${suffix}`;
}
