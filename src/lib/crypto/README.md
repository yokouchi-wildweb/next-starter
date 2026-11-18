# 汎用暗号化ユーティリティ

## Overview

- AES-256-GCM による対称暗号化を提供する汎用ライブラリ。外部サービスのトークンや機密データの暗号化保存に使用する
- 暗号化とは別に、「生の値はクライアントに 1 回だけ渡し、DB にはハッシュだけ保存して照合する」用途のヘルパー(`secretToken.ts`)も持つ(端末トークン・ワンタイムコード・招待トークン等)。こちらは復号できない
- `src/utils/hash.ts` との違い: hash.ts は不可逆(scrypt)。本ライブラリの暗号化は可逆(encrypt → decrypt で元のデータを復元可能)
- 使う時・直す時の決まりは札 .claude/rules/items/lib/crypto.md にある。この README は使い方と仕組み

## Usage

### セットアップ

```env
# 暗号化キー（64文字の hex 文字列 = 32バイト）
ENCRYPTION_KEY=your_64char_hex_key
```

```ts
import { generateEncryptionKey } from "@/lib/crypto";

const key = generateEncryptionKey();
// → "a1b2c3d4..." (64文字の hex)。これを ENCRYPTION_KEY 環境変数に設定する
```

### 暗号化と復号

```ts
import { encrypt, decrypt } from "@/lib/crypto";

// 暗号化（環境変数の ENCRYPTION_KEY を使用）
const encrypted = encrypt("secret_token_value");
// → "v1:abcdef...:123456...:789abc..."

// 復号
const decrypted = decrypt(encrypted);
// → "secret_token_value"

// カスタムキーを使用（テスト・マルチテナント等）
const encrypted2 = encrypt("data", "custom_64char_hex_key...");
const decrypted2 = decrypt(encrypted2, "custom_64char_hex_key...");
```

### 照合用トークン・短いコード

```ts
import {
  generateSecretToken, // ランダムトークン（既定 32 バイト、base64url）
  hashSecretToken,     // SHA-256 hex。DB にはこちらを保存する
  generateShortCode,   // 人が入力する短いコード（Crockford Base32、既定 8 文字）
  normalizeShortCode,  // 入力の正規化（空白・ハイフン除去、大文字化、I/L→1・O→0）。不正文字は null
  formatShortCode,     // 表示用の区切り（"ABCD2345" → "ABCD-2345"）
} from "@/lib/crypto";
```

- SHA-256 は十分なエントロピーのあるランダム値の照合用

## API

- `encrypt(plain, key?)`: 平文 → 暗号化文字列
- `decrypt(encrypted, key?)`: 暗号化文字列 → 平文
- `generateEncryptionKey()`: ランダムな暗号化キー(64 文字の hex)
- 照合用トークン・短いコードの関数は Usage「照合用トークン・短いコード」

暗号化フォーマット:

```
v1:iv:authTag:ciphertext
```

- `v1`: バージョンプレフィックス(将来のアルゴリズム変更時に移行を可能にする)
- `iv`: 初期化ベクトル(12バイト、hex)
- `authTag`: 認証タグ(16バイト、hex)— データの改ざん検知
- `ciphertext`: 暗号化データ(hex)

## Internals

- AES-256-GCM: 認証付き暗号化(機密性 + 完全性を保証)
- ランダム IV: 暗号化のたびに新しい IV を生成(同じ平文でも異なる暗号文になる)
- 改ざん検知: AuthTag による完全性検証。暗号文が改ざんされていると復号時にエラー
- バージョン管理: フォーマットにバージョンプレフィックスを含むため、既存データを壊さずにアルゴリズム移行が可能

## Related

- `src/features/core/userXProfile/` — X OAuth トークンの暗号化保存
- `src/features/core/pairedDevice/` — 端末トークン・ペアリングコード(secretToken.ts)
- `src/utils/hash.ts` — パスワードの不可逆ハッシュ(scrypt)
