/**
 * DAM Media Decryption Client Library (Browser & Node compatible)
 * Decrypts AES-256-CTR encrypted media streams on the fly.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DamDecryptClient = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_KEY = 'hhghghdgfjgfgdahgd';

  /**
   * Derives a CryptoKey from a passphrase using SHA-256 for AES-CTR.
   */
  async function deriveKey(passphrase = DEFAULT_KEY) {
    const enc = new TextEncoder();
    const keyData = enc.encode(passphrase);
    const hash = await crypto.subtle.digest('SHA-256', keyData);
    return crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-CTR' },
      false,
      ['decrypt', 'encrypt']
    );
  }

  /**
   * Converts a hex string to Uint8Array.
   */
  function hexToUint8Array(hexString) {
    if (!hexString) return new Uint8Array(16);
    const matches = hexString.match(/.{1,2}/g);
    return new Uint8Array(matches ? matches.map((byte) => parseInt(byte, 16)) : []);
  }

  /**
   * Decrypts an encrypted ArrayBuffer or Uint8Array using AES-256-CTR with the given IV.
   */
  async function decryptBuffer(encryptedData, ivHexOrBytes, passphrase = DEFAULT_KEY) {
    const key = await deriveKey(passphrase);
    const counter =
      typeof ivHexOrBytes === 'string'
        ? hexToUint8Array(ivHexOrBytes)
        : ivHexOrBytes;

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-CTR',
        counter: counter,
        length: 128,
      },
      key,
      encryptedData
    );

    return decrypted;
  }

  /**
   * Fetches an encrypted media endpoint, streams and decrypts it, returning a Blob and Object URL.
   *
   * @param {string} url - The media URL (e.g. '/painting/image/2' or '/model/file/1')
   * @param {Object} options - Options
   * @param {string} options.passphrase - Secret key (defaults to 'hhghghdgfjgfgdahgd')
   * @param {Function} options.onProgress - Progress callback ({ loaded, total, percent })
   * @returns {Promise<{ blob: Blob, objectUrl: string, contentType: string, size: number }>}
   */
  async function fetchAndDecryptMedia(url, options = {}) {
    const passphrase = options.passphrase || DEFAULT_KEY;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const ivHex = response.headers.get('X-Encryption-IV') || '';
    const contentType = response.headers.get('X-Original-Content-Type') ||
      response.headers.get('Content-Type') || 'application/octet-stream';
    const totalSize = parseInt(response.headers.get('X-Total-Size') || '0', 10);

    const isEncrypted = response.headers.get('X-Encrypted') === 'true';

    // If streaming response body is available
    const reader = response.body ? response.body.getReader() : null;
    let receivedBytes = 0;
    const chunks = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;

        if (typeof options.onProgress === 'function') {
          options.onProgress({
            loaded: receivedBytes,
            total: totalSize || receivedBytes,
            percent: totalSize ? Math.round((receivedBytes / totalSize) * 100) : 100,
          });
        }
      }
    } else {
      const buffer = await response.arrayBuffer();
      chunks.push(new Uint8Array(buffer));
      receivedBytes = buffer.byteLength;
    }

    // Combine chunks
    const allBytes = new Uint8Array(receivedBytes);
    let position = 0;
    for (const chunk of chunks) {
      allBytes.set(chunk, position);
      position += chunk.length;
    }

    let finalData = allBytes.buffer;

    if (isEncrypted) {
      finalData = await decryptBuffer(allBytes, ivHex, passphrase);
    }

    const blob = new Blob([finalData], { type: contentType });
    const objectUrl = URL.createObjectURL(blob);

    return {
      blob,
      objectUrl,
      contentType,
      size: finalData.byteLength,
      iv: ivHex,
    };
  }

  return {
    deriveKey,
    hexToUint8Array,
    decryptBuffer,
    fetchAndDecryptMedia,
    DEFAULT_KEY,
  };
});
