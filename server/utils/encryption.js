const crypto = require('crypto');
require('dotenv').config();

// Get encryption key from environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-characters-long';
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts a string using AES-256-CBC
 * @param {string} text - The text to encrypt
 * @returns {string} - The encrypted string in hex:iv format
 */
function encrypt(text) {
  if (!text) return text;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), // Ensure key is 32 bytes
      iv
    );
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts a string that was encrypted with the encrypt function
 * @param {string} encryptedText - The encrypted text in hex:iv format
 * @returns {string} - The decrypted string
 */
function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;
  
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) {
      console.error('Invalid encrypted text format');
      return encryptedText; // Return as is if not in expected format
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), // Ensure key is 32 bytes
      iv
    );
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    // In production, you might want to throw the error instead
    return encryptedText; // Return original if decryption fails
  }
}

/**
 * Hashes data using SHA-256
 * @param {string} data - The data to hash
 * @returns {string} - The hashed string
 */
function hash(data) {
  return crypto
    .createHash('sha256')
    .update(data + ENCRYPTION_KEY) // Add salt
    .digest('hex');
}

module.exports = {
  encrypt,
  decrypt,
  hash
};
