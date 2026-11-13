// Vault encryption engine (scrypt KDF + AES-256-GCM).
// Backward-compatible with v1 GUILD_QUEST_VAULT_V1 vaults.

import crypto from 'node:crypto';
import fs from 'node:fs';

export const VAULT_MAGIC = 'GUILD_QUEST_VAULT_V1';

export function deriveKey(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
}

export function encryptVaultData(stateObj, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const plaintext = JSON.stringify(stateObj, null, 2);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    magic: VAULT_MAGIC,
    kdf: 'scrypt',
    cipher: 'aes-256-gcm',
    salt,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    updatedAt: new Date().toISOString(),
    ciphertext: encrypted.toString('base64'),
  };
}

export function decryptVaultData(envelope, password) {
  if (!envelope || envelope.magic !== VAULT_MAGIC) {
    throw new Error('Invalid or corrupted Quest Vault file format.');
  }
  const key = deriveKey(password, envelope.salt);
  const iv = Buffer.from(envelope.iv, 'hex');
  const authTag = Buffer.from(envelope.authTag, 'hex');
  const encrypted = Buffer.from(envelope.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

export function saveVaultToFile(vaultPath, stateObj, password) {
  const payload = encryptVaultData(stateObj, password);
  const tmpPath = `${vaultPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmpPath, vaultPath);
}

export function loadVaultFromFile(vaultPath, password) {
  const raw = fs.readFileSync(vaultPath, 'utf8');
  const envelope = JSON.parse(raw);
  return decryptVaultData(envelope, password);
}
