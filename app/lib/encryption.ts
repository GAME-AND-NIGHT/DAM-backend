import crypto from 'crypto';
import fs from 'fs';
import { Readable } from 'stream';

export const DEFAULT_KEY = process.env.ENCRYPTION_KEY || process.env.MEDIA_ENCRYPTION_KEY || 'hhghghdgfjgfgdahgd';
export const DEFAULT_CHUNK_SIZE = 64 * 1024; // 64 KB per chunk

/**
 * Derives a 32-byte (256-bit) encryption key from the provided secret passphrase.
 */
export function getDerivedKey(passphrase: string = DEFAULT_KEY): Buffer {
  return crypto.createHash('sha256').update(passphrase, 'utf8').digest();
}

/**
 * Generates a deterministic or pseudo-random 16-byte IV.
 * By using deterministic IV based on file identifier and key, clients can decrypt
 * any arbitrary chunk or range reliably.
 */
export function getResourceIV(resourceId: string, customSeed?: string): Buffer {
  const seed = customSeed || `${resourceId}_${DEFAULT_KEY}`;
  return crypto.createHash('md5').update(seed, 'utf8').digest();
}

/**
 * Increment a 16-byte IV by a given 16-byte block offset.
 * Required for seeking / random chunk encryption in AES-CTR mode.
 */
export function getOffsetIV(baseIV: Buffer, blockOffset: number): Buffer {
  if (blockOffset === 0) {
    return Buffer.from(baseIV);
  }
  const ivBigInt = BigInt('0x' + baseIV.toString('hex'));
  const offsetBigInt = BigInt(blockOffset);
  const max128 = BigInt('0x100000000000000000000000000000000');
  const newIvBigInt = (ivBigInt + offsetBigInt) % max128;
  const hex = newIvBigInt.toString(16).padStart(32, '0');
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a full buffer using AES-256-CTR.
 */
export function encryptBuffer(
  buffer: Buffer,
  iv: Buffer = getResourceIV('default'),
  passphrase: string = DEFAULT_KEY
): Buffer {
  const key = getDerivedKey(passphrase);
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
}

/**
 * Decrypts a full buffer using AES-256-CTR.
 */
export function decryptBuffer(
  encryptedBuffer: Buffer,
  iv: Buffer,
  passphrase: string = DEFAULT_KEY
): Buffer {
  const key = getDerivedKey(passphrase);
  const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

/**
 * Encrypts an arbitrary slice/chunk of a file with counter offset awareness.
 */
export function encryptChunk(
  fileBuffer: Buffer,
  start: number,
  end: number,
  baseIV: Buffer,
  passphrase: string = DEFAULT_KEY
): Buffer {
  const key = getDerivedKey(passphrase);
  const blockOffset = Math.floor(start / 16);
  const subBlockOffset = start % 16;
  const chunkIV = getOffsetIV(baseIV, blockOffset);

  // If start does not align to 16 bytes, we include the prefix byte to align counter
  const alignedStart = blockOffset * 16;
  const sliceToEncrypt = fileBuffer.subarray(alignedStart, end);

  const cipher = crypto.createCipheriv('aes-256-ctr', key, chunkIV);
  const encrypted = Buffer.concat([cipher.update(sliceToEncrypt), cipher.final()]);

  return encrypted.subarray(subBlockOffset);
}

/**
 * Creates an encrypted Readable stream for the specified file in segments.
 */
export function createEncryptedFileStream(
  filePath: string,
  iv: Buffer,
  options: {
    chunkSize?: number;
    passphrase?: string;
    start?: number;
    end?: number;
  } = {}
): { stream: Readable; iv: Buffer; totalSize: number } {
  const stat = fs.statSync(filePath);
  const totalSize = stat.size;
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const passphrase = options.passphrase || DEFAULT_KEY;
  const start = options.start ?? 0;
  const end = options.end ?? totalSize - 1;

  const key = getDerivedKey(passphrase);

  if (start === 0 && end === totalSize - 1) {
    // Stream whole file
    const fileReadStream = fs.createReadStream(filePath, {
      highWaterMark: chunkSize,
    });
    const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
    const encryptedStream = fileReadStream.pipe(cipher);
    return { stream: encryptedStream, iv, totalSize };
  }

  // Stream specific range / chunk
  const blockOffset = Math.floor(start / 16);
  const subBlockOffset = start % 16;
  const chunkIV = getOffsetIV(iv, blockOffset);
  const alignedStart = blockOffset * 16;

  const fileReadStream = fs.createReadStream(filePath, {
    start: alignedStart,
    end,
    highWaterMark: chunkSize,
  });

  const cipher = crypto.createCipheriv('aes-256-ctr', key, chunkIV);
  let isFirst = true;

  const customStream = new Readable({
    read() {},
  });

  const piped = fileReadStream.pipe(cipher);

  piped.on('data', (chunk: Buffer) => {
    if (isFirst && subBlockOffset > 0) {
      isFirst = false;
      const sliced = chunk.subarray(subBlockOffset);
      if (sliced.length > 0) {
        customStream.push(sliced);
      }
    } else {
      isFirst = false;
      customStream.push(chunk);
    }
  });

  piped.on('end', () => {
    customStream.push(null);
  });

  piped.on('error', (err) => {
    customStream.destroy(err);
  });

  return { stream: customStream, iv: chunkIV, totalSize };
}

/**
 * Converts a Node.js Readable stream to a Web standard ReadableStream (for Next.js Response).
 */
export function nodeStreamToWebStream(readable: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      readable.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      readable.on('end', () => {
        controller.close();
      });
      readable.on('error', (err) => {
        controller.error(err);
      });
    },
    cancel() {
      readable.destroy();
    },
  });
}
