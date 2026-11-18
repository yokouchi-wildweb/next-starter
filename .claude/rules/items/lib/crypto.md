---
paths:
  - "src/lib/crypto/**"
---
# lib/crypto
what: reversible AES-256-GCM encryption for stored secrets (encrypt, decrypt, generateEncryptionKey) and one-way match tokens and short codes (secretToken.ts) | entry @/lib/crypto
use: always
change: none → /order <direct parent> | the key = env ENCRYPTION_KEY (64 hex chars = 32 bytes)
rules:
using:
- pick_by_need: a secret read back later (external service tokens) → encrypt / decrypt | a value only matched → secret token + hash | a password → src/utils/hash.ts (scrypt), never this lib
- store_hash_only: a secret token's raw value goes to the client once; the DB stores only hashSecretToken
- short_code_guarded: a short code (8 chars = 40 bits) always comes with an expiry and a rate limit
- key_generated_once: generate ENCRYPTION_KEY once with generateEncryptionKey and set it in the env
editing:
- format_versioned: the stored form keeps its version prefix (`v1:iv:authTag:ciphertext`) | an algorithm change adds a new version without breaking stored data
- fresh_iv: every encryption uses a new random IV
read: setup, encrypt, tokens → Usage | functions, format → API | security properties → Internals | callers → Related
