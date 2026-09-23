/**
 * Example Node.js script: Fetch and decrypt media from the DAM backend.
 * Usage: node examples/client_decrypt_node.js [endpoint]
 * Example: node examples/client_decrypt_node.js http://localhost:3000/painting/image/2
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_URL = process.argv[2] || 'http://localhost:3000/painting/image/2';
const SECRET_KEY = 'hhghghdgfjgfgdahgd';

function fetchAndDecrypt(urlStr, outputPath) {
  const url = new URL(urlStr);
  const client = url.protocol === 'https:' ? https : http;

  console.log(`📡 Requesting: ${urlStr}...`);

  client.get(url, (res) => {
    if (res.statusCode !== 200) {
      console.error(`❌ HTTP Error: ${res.statusCode} ${res.statusMessage}`);
      res.resume();
      return;
    }

    const ivHex = res.headers['x-encryption-iv'];
    const isEncrypted = res.headers['x-encrypted'] === 'true';
    const originalType = res.headers['x-original-content-type'] || 'binary';
    const totalSize = res.headers['x-total-size'] || 'unknown';

    console.log(`🔒 Encryption: ${isEncrypted ? 'AES-256-CTR' : 'None'}`);
    console.log(`🔑 IV: ${ivHex}`);
    console.log(`📦 Original Type: ${originalType} | Expected Size: ${totalSize} bytes`);

    const key = crypto.createHash('sha256').update(SECRET_KEY, 'utf8').digest();
    const iv = Buffer.from(ivHex, 'hex');

    let outputStream;
    let outFileName = outputPath;
    if (!outFileName) {
      const ext = originalType.includes('jpeg') ? '.jpg' : originalType.includes('gltf') ? '.glb' : '.bin';
      outFileName = path.join(__dirname, `decrypted_output${ext}`);
    }

    outputStream = fs.createWriteStream(outFileName);

    let receivedBytes = 0;

    if (isEncrypted && ivHex) {
      const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);

      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
        process.stdout.write(`\r📥 Received & Decrypting: ${(receivedBytes / 1024).toFixed(1)} KB`);
      });

      res.pipe(decipher).pipe(outputStream);
    } else {
      res.pipe(outputStream);
    }

    outputStream.on('finish', () => {
      console.log(`\n✅ Saved decrypted file to: ${outFileName} (${receivedBytes} bytes)`);
    });
  }).on('error', (err) => {
    console.error('❌ Request error:', err.message);
  });
}

fetchAndDecrypt(DEFAULT_URL);
