const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-cbc';
const KEY = config.encryption.key ? Buffer.from(config.encryption.key, 'base64') : null;
const IV_LENGTH = 16;

function adaptKey(key) {
  if (key.length < 32) {
    const padding = Buffer.alloc(32 - key.length, 0); // Pad with zeros
    return Buffer.concat([key, padding]);
  } else if (key.length > 32) {
    return key.slice(0, 32); // Truncate to 32 bytes
  }
  return key; // Return as is if already 32 bytes
}

function encrypt(text) {
  if (!KEY) { 
    throw new Error('Encryption key not configured');
  }
  const adaptedKey = adaptKey(KEY);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, adaptedKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!KEY) {
    throw new Error('Encryption key not configured');
  }
  const adaptedKey = adaptKey(KEY);
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, adaptedKey, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function serializeData(data) {
  return JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString(); // Convert BigInt to string
    }
    return value;
  });
}

module.exports = {
  encrypt,
  decrypt,
  serializeData, // Export the new serialize function
};
