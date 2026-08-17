import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EncryptedPayload {
  salt: string;
  iv: string;
  ciphertext: string;
  hmac: string;
}

@Injectable()
export class CryptService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly keyLength = 32;
  private readonly saltLength = 16;
  private readonly ivLength = 16;
  private readonly iterations = 100000;
  private readonly hmacAlgorithm = 'sha256';

  encrypt(plainText: string, passphrase?: string): string {
    const salt = crypto.randomBytes(this.saltLength);
    const iv = crypto.randomBytes(this.ivLength);
    const key = this.deriveKey(passphrase, salt);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const hmac = crypto.createHmac(this.hmacAlgorithm, key);
    hmac.update(salt);
    hmac.update(iv);
    hmac.update(ciphertext);
    const hmacDigest = hmac.digest();
    return [
      salt.toString('base64'),
      iv.toString('base64'),
      ciphertext.toString('base64'),
      hmacDigest.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string, passphrase?: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted payload format');
    }
    const [saltB64, ivB64, ciphertextB64, hmacB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const expectedHmac = Buffer.from(hmacB64, 'base64');
    const key = this.deriveKey(passphrase, salt);
    const hmac = crypto.createHmac(this.hmacAlgorithm, key);
    hmac.update(salt);
    hmac.update(iv);
    hmac.update(ciphertext);
    const computedHmac = hmac.digest();
    if (!this.timingSafeEqual(expectedHmac, computedHmac)) {
      throw new Error('Invalid HMAC - data may have been tampered with');
    }
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      iv,
    );
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  private deriveKey(passphrase: string | undefined, salt: Buffer): Buffer {
    const actualPassphrase = passphrase || 'seed-default-crypt-key';
    return crypto.pbkdf2Sync(
      actualPassphrase,
      salt,
      this.iterations,
      this.keyLength,
      'sha256',
    );
  }

  private timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }
}
