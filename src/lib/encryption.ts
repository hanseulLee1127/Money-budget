import CryptoJS from 'crypto-js';

// 암호화 키 (환경 변수에서 가져옴)
const getEncryptionKey = (): string => {
  const key = process.env.ENCRYPTION_KEY || process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
  if (!key) {
    console.warn('Encryption key is not set. Using default key for development.');
    return 'default-development-key-change-in-production';
  }
  return key;
};

/**
 * 데이터를 AES로 암호화
 * @param data 암호화할 문자열
 * @returns 암호화된 문자열
 */
export function encryptData(data: string): string {
  try {
    const encrypted = CryptoJS.AES.encrypt(data, getEncryptionKey()).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * AES로 암호화된 데이터를 복호화
 * @param encryptedData 암호화된 문자열
 * @returns 복호화된 원본 문자열
 */
export function decryptData(encryptedData: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, getEncryptionKey());
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * 객체의 특정 필드들을 암호화
 * @param obj 암호화할 객체
 * @param fields 암호화할 필드 이름 배열
 * @returns 지정된 필드가 암호화된 새 객체
 */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const encrypted = { ...obj };
  for (const field of fields) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      encrypted[field] = encryptData(String(encrypted[field])) as T[keyof T];
    }
  }
  return encrypted;
}

/**
 * 객체의 특정 필드들을 복호화
 * @param obj 복호화할 객체
 * @param fields 복호화할 필드 이름 배열
 * @returns 지정된 필드가 복호화된 새 객체
 */
export function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const decrypted = { ...obj };
  for (const field of fields) {
    if (decrypted[field] !== undefined && decrypted[field] !== null) {
      decrypted[field] = decryptData(String(decrypted[field])) as T[keyof T];
    }
  }
  return decrypted;
}
