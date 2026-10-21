# 汎用暗号化ユーティリティ

AES-256-GCM による対称暗号化を提供する汎用ライブラリ。
外部サービスのトークンや機密データの暗号化保存に使用する。

**既存の `src/utils/hash.ts` との違い**: hash.ts は不可逆（scrypt）。本ライブラリは可逆暗号化（encrypt → decrypt で元のデータを復元可能）。

## セットアップ

### 環境変数

```env
# 暗号化キー（64文字の hex 文字列 = 32バイト）
ENCRYPTION_KEY=your_64char_hex_key
```

### キーの生成

```ts
import { generateEncryptionKey } from "@/lib/crypto";

// ランダムな暗号化キーを生成（セットアップ時に1回だけ実行）
const key = generateEncryptionKey();
// → "a1b2c3d4..." (64文字の hex)
// これを ENCRYPTION_KEY 環境変数に設定する
```

## 使い方

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

## 暗号化フォーマット

```
v1:iv:authTag:ciphertext
```

- `v1`: バージョンプレフィックス（将来のアルゴリズム変更時に移行を可能にする）
- `iv`: 初期化ベクトル（12バイト、hex）
- `authTag`: 認証タグ（16バイト、hex）— データの改ざん検知
- `ciphertext`: 暗号化データ（hex）

## 公開API

```ts
import {
  encrypt,               // 平文 → 暗号化文字列
  decrypt,               // 暗号化文字列 → 平文
  generateEncryptionKey,  // ランダムな暗号化キーを生成
} from "@/lib/crypto";
```

## セキュリティ

- **AES-256-GCM**: 認証付き暗号化（機密性 + 完全性を保証）
- **ランダム IV**: 暗号化のたびに新しい IV を生成（同じ平文でも異なる暗号文になる）
- **改ざん検知**: AuthTag による完全性検証。暗号文が改ざんされていると復号時にエラー
- **バージョン管理**: フォーマットにバージョンプレフィックスを含むため、既存データを壊さずにアルゴリズム移行が可能

## 照合用トークン・短いコード（secretToken.ts）

暗号化とは別に、「生の値はクライアントに 1 回だけ渡し、DB にはハッシュだけ保存して照合する」用途の
ヘルパーを持つ（端末トークン・ワンタイムコード・招待トークン等）。復号はできない。

```ts
import {
  generateSecretToken, // ランダムトークン（既定 32 バイト、base64url）
  hashSecretToken,     // SHA-256 hex。DB にはこちらだけ保存する
  generateShortCode,   // 人が入力する短いコード（Crockford Base32、既定 8 文字）
  normalizeShortCode,  // 入力の正規化（空白・ハイフン除去、大文字化、I/L→1・O→0）。不正文字は null
  formatShortCode,     // 表示用の区切り（"ABCD2345" → "ABCD-2345"）
} from "@/lib/crypto";
```

- SHA-256 は十分なエントロピーのあるランダム値の照合用。パスワードは `src/utils/hash.ts`（scrypt）を使う
- 短いコードは 8 文字で 40 bit しかない。有効期限とレート制限を必ず併用する

## 使用箇所

- `src/features/core/userXProfile/` — X OAuth トークンの暗号化保存
- `src/features/core/pairedDevice/` — 端末トークン・ペアリングコード（secretToken.ts）
- 今後追加される外部サービスのトークン保存にも使用可能
