"""
Example Python script: Fetch and decrypt encrypted stream from DAM backend.
Requirements: pip install requests cryptography
Usage: python client_decrypt_python.py [url]
"""

import sys
import hashlib
import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/painting/image/2"
SECRET_KEY = "hhghghdgfjgfgdahgd"

def main():
    print(f"📡 Requesting: {URL}...")
    response = requests.get(URL, stream=True)

    if response.status_code != 200:
        print(f"❌ Error {response.status_code}: {response.text}")
        return

    iv_hex = response.headers.get("X-Encryption-IV")
    is_encrypted = response.headers.get("X-Encrypted") == "true"
    content_type = response.headers.get("X-Original-Content-Type", "")

    print(f"🔒 Encrypted: {is_encrypted}")
    print(f"🔑 IV: {iv_hex}")

    # Derive 32-byte key
    key = hashlib.sha256(SECRET_KEY.encode("utf-8")).digest()
    iv = bytes.fromhex(iv_hex) if iv_hex else b"\x00" * 16

    cipher = Cipher(algorithms.AES(key), modes.CTR(iv), backend=default_backend())
    decryptor = cipher.decryptor()

    ext = ".jpg" if "jpeg" in content_type else (".glb" if "gltf" in content_type else ".bin")
    out_name = f"decrypted_media{ext}"

    total_bytes = 0
    with open(out_name, "wb") as f:
        for chunk in response.iter_content(chunk_size=65536):
            if chunk:
                if is_encrypted:
                    decrypted_chunk = decryptor.update(chunk)
                    f.write(decrypted_chunk)
                else:
                    f.write(chunk)
                total_bytes += len(chunk)
                print(f"\r📥 Received: {total_bytes // 1024} KB", end="")

    print(f"\n✅ Decrypted successfully and saved to: {out_name} ({total_bytes} bytes)")

if __name__ == "__main__":
    main()
