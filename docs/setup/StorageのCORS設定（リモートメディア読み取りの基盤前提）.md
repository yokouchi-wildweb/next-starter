# Storage の CORS 設定（リモートメディア読み取りの基盤前提）

別ドメイン（Firebase Storage 等）の **バイト列をブラウザで読み取る** 機能すべての **共通基盤前提** です。
特定機能（動画の継ぎ目なし再生など）の前提ではなく、**バケット単位・一度きり・機能非依存** の初期セットアップとして扱ってください。

> このドキュメントが CORS 設定の **一次情報** です。各ライブラリの README やスクリプト説明は、ここへ逆リンクするだけにしています。

---

## 1. なぜ必要か（一言で）

ブラウザが **別オリジン（別ドメイン）のファイルの「中身（バイト列）」を読む** とき、その通信は CORS の対象になります。
`<img src>` や `<video src>` で **表示するだけ** なら CORS は不要ですが、`fetch()` で中身を読んだり、
canvas に取り込んで画像として書き出したりすると、バケット側に CORS 許可が無い限りブラウザがブロックします。

配信自体は Firebase から直接（CDN のまま）行われるので、**CORS を設定しても性能劣化はありません**。中継は発生しません。

---

## 2. いつ CORS が要るか（判定ルール）

**別ドメインの Storage バイトを「読む」なら必須。「表示するだけ」なら不要。**

| 操作 | CORS | 例 |
| --- | --- | --- |
| MSE（`appendBuffer`）でのメディア連結再生 | **必須** | `src/lib/seamlessVideo` の URL 再生 |
| `fetch()` でのバイト読み取り全般 | **必須** | 動画/音声/任意ファイルを取得して加工 |
| `<video crossOrigin>` / `<img crossOrigin>` → canvas で書き出し | **必須** | サムネ生成・フレーム抽出（`toBlob`/`toDataURL`/`getImageData`） |
| Web Audio（`decodeAudioData`） | **必須** | 音声のギャップレス連結・解析 |
| `<video src>` / `<img src>` で表示するだけ | 不要 | 通常の再生・画像表示 |
| アップロード前の File/Blob を直接読む | 不要 | fetch しないため対象外 |

判断に迷ったら: **「別オリジンの URL を fetch するか / canvas に取り込んで書き出すか」** を見れば判定できます。

---

## 3. 前提（権限・環境変数）

`scripts/storage/setup-cors.ts` を実行するために必要なもの:

- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: 対象バケット名（`xxxx.appspot.com` 形式）
- `MY_SERVICE_ACCOUNT_KEY`: Firebase Admin 用サービスアカウント JSON（`storage.buckets.update` 権限が必要）

> サービスアカウント鍵の取得手順は [Neon Firebase など各種バックエンドサービスの設定方法](Neon_Firebaseなど各種バックエンドサービスの設定方法.md) の「サーバー側 SDK 用サービスアカウントの取得」を参照。

---

## 4. 設定手順（一度きり）

```bash
# origin "*"（検証用）。まず疎通確認したいときはこれ
pnpm storage:setup-cors

# origin を実ドメインに限定（本番推奨）
pnpm storage:setup-cors https://your-app.com https://www.your-app.com
```

設定される内容（`scripts/storage/setup-cors.ts`）:

- `method`: `GET`, `HEAD`
- `responseHeader`: `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges`, `Range`
- `maxAgeSeconds`: `3600`

バケット単位の設定なので、**プロジェクト初期セットアップで一度実行すれば、以降このバケットを読む全機能で有効** です。
バケットを作り直した／別バケットに切り替えた場合は再実行してください。

---

## 5. トラブルシュート（症状から逆引き）

| 症状（ブラウザのエラー） | 主な原因 | 対処 |
| --- | --- | --- |
| `TypeError: Failed to fetch`（Chromium）<br>`NetworkError ...`（Firefox）<br>`Load failed`（Safari） | 別ドメインのバイトを fetch したが CORS 未設定<br>（※ ネットワーク断・URL 誤り・認証失敗でも同じ表示） | `pnpm storage:setup-cors` を実行 |
| `SecurityError: ... Tainted canvases may not be exported`（`toBlob`/`toDataURL`/`getImageData`） | 別ドメインのメディアを CORS 未許可で canvas に取り込み汚染された | ①取り込み元に `crossOrigin="anonymous"` を付与 ②`pnpm storage:setup-cors` を実行 |

### 開発時の自己診断（自動案内）

上記エラーは原因が分かりにくいため、**開発時（`NODE_ENV !== "production"`）に限り**、エラー発生地点で
「CORS 未設定の可能性」と対処コマンド・本ドキュメントへの導線を `console.warn` で自動案内する仕組みがあります。

- 実装: `src/lib/storageCors`（`fetchStorageBytes` / `canvasToBlobSafe` ほか）
- 別ドメインのバイト取得・canvas 書き出しを行う新機能は、これらのラッパー経由にしておくと自動で恩恵を受けられます。

---

## 6. 関連

- スクリプト: `scripts/storage/setup-cors.ts`（`scripts/README.md`「Storage (CORS)」）
- 採用ライブラリ例: `src/lib/seamlessVideo/README.md`（URL 再生時に CORS が前提）
- 自己診断: `src/lib/storageCors/README.md`
