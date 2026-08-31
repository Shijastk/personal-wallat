/**
 * Client-side AES-256-GCM encryption using the Web Crypto API.
 * The master password is never stored. A derived key (PBKDF2) is kept in
 * memory only for the current session and is cleared on lock.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

const PBKDF2_ITERATIONS = 250000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encrypt(plaintext: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return `${toBase64(salt)}:${toBase64(iv)}:${toBase64(cipher)}`;
}

export async function decrypt(payload: string, password: string): Promise<string> {
  const [saltB64, ivB64, cipherB64] = payload.split(':');
  if (!saltB64 || !ivB64 || !cipherB64) throw new Error('Invalid encrypted payload');
  const salt = fromBase64(saltB64);
  const iv = fromBase64(ivB64);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    fromBase64(cipherB64)
  );
  return dec.decode(plain);
}

let sessionKey: string | null = null;

export function setSessionKey(key: string) {
  sessionKey = key;
}

export function getSessionKey(): string | null {
  return sessionKey;
}

export function clearSessionKey() {
  sessionKey = null;
}

export function hasSessionKey(): boolean {
  return sessionKey !== null;
}

export async function encryptWithSession(plaintext: string): Promise<string> {
  if (!sessionKey) throw new Error('Vault is locked');
  return encrypt(plaintext, sessionKey);
}

export async function decryptWithSession(payload: string): Promise<string> {
  if (!sessionKey) throw new Error('Vault is locked');
  return decrypt(payload, sessionKey);
}
