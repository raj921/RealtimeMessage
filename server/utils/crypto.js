const crypto = require('crypto');

// Generate a secure encryption key (should be stored in environment variables in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || (() => {
  console.warn('WARNING: ENCRYPTION_KEY not set in environment variables. Using temporary key - this is NOT secure for production!');
  return crypto.randomBytes(32).toString('hex');
})();
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts text using AES-256-CBC
 * @param {string} text - The text to encrypt
 * @returns {string} Encrypted string in iv:encryptedText format
 */
const encryptMessage = (text) => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
};

/**
 * Decrypts text using AES-256-CBC
 * @param {string} text - Encrypted text in iv:encryptedText format
 * @returns {string} Decrypted string
 */
const decryptMessage = (text) => {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
};

/**
 * Hashes sensitive data (like tokens) for secure storage
 * @param {string} data - The data to hash
 * @returns {string} Hashed data
 */
const hashData = (data) => {
  return crypto
    .createHash('sha256')
    .update(data + process.env.HASH_SALT)
    .digest('hex');
};

module.exports = {
  encryptMessage,
  decryptMessage,
  hashData
};
