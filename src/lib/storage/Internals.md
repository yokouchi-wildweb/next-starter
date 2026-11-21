# `src/lib/storage` Internals

## Overview

- `src/lib/storage` の仕組み。使い方と約束は [README.md](./README.md)、関数の形は [API.md](./API.md)

## Internals

### 描き直し: `stripImageMetadata(body, contentType)`（`server/imageStrip.ts`、server-only）

- sharp で描き直す。sharp（ネイティブ）は初回の呼び出しで読み込む（`@/lib/storage/server` を使うだけのルートの起動を重くしない）
- EXIF（位置情報を含む）・XMP・IPTC・ICC を残さない(メタデータを書く API `withMetadata` / `keepExif` / `keepIccProfile` などを使わない)
- **ICC**: sRGB に変換してから落とす（sharp の既定）。P3 などの広色域は、P3 画面での鮮やかさが少し落ちる。標準プロファイルへの置き換え（P3 保持）は持たない
- 出力は入力と同じ形式（jpeg → jpeg … avif → avif）
- **縮め直し**: 用途に `image`（画像の縮小の指定）があれば、静止画の長い辺が `maxDimension` を超えるとき縦横比を保って縮める（向きを直した後の寸法で。拡大はしない。拒否はしない: ブラウザで縮められずに届いた物の最後の守り）。`image.quality` があれば jpeg / webp / avif の画質に使う（省略 = `imageStrip.quality`）。アニメーション（GIF / WebP の複数フレーム）は縮めない。commit・`putFromServer`・`copy` の 3 か所とも同じ（`stripImageMetadata(body, type, options, image)`）。発行の `maxBytes` の検査は原本の大きさで行う（縮め直しは上限を緩めない）
- **向き**
  - 静止画: EXIF の向きどおりに回転してから向きのタグを捨てる
  - アニメーション: 向き 2〜4（反転・180 度）だけ補正する。5〜8（90 / 270 度回転を含む）は、sharp が複数ページの回転に対応しないため、**回転せずに向きの情報を捨てる**（表示が横倒しになりうる）
  - 3・4 はフレームごとに補正して並べ直す（全体にかけるとフレームの順番が逆になるため。ループ・コマ間隔は元の値を付け直す）
- **アニメーション**: GIF / WebP はフレーム・ループ回数・コマ間隔・透過を保つ。APNG と動く AVIF は 1 枚目だけになる（静止画として保存）
- **上限**: ヘッダーだけを読んで画素数を先に判定する。1 フレームの画素数（幅 × 高さ）が `maxFramePixels`、全フレームの合計が `maxTotalPixels` を超えたら `ImageStripError("too_large")`
- 失敗: 実際の形式が申告と違う → `"type_mismatch"` / 読めない・処理できない → `"unprocessable"`。commit では行を deleted にして 422（[storageObject README](../../features/core/storageObject/README.md)）
- 値は `src/lib/storage/config.ts` の `imageStrip`(上書き `src/config/lib/storage.config.ts`)（fork が調整してよい）

| キー | 既定 |
|---|---|
| `maxFramePixels` | 1 億画素 |
| `maxTotalPixels` | 1 億画素 |
| `quality.jpeg` / `quality.webp` / `quality.avif` | 90 / 90 / 60（png / gif は sharp の既定） |

- 時間とメモリ: commit は描き直しの分だけ重くなる（画素数次第）。Vercel（2GB / 2vCPU）での試験では、4,600 万画素の WebP（200 フレーム）で 8.4 秒・最大 RSS 約 618MB

### 非公開の動画・音声: `usePrivateMediaRecovery(src, mediaRef)`

固定 URL は 302 で短期署名 URL（動画・音声は `readTtlSec.video` / `audio`）へ飛ぶ。ブラウザは 302 先の署名 URL を使い回して Range 取得するため、期限後のシークで読み込みに失敗することがある。

- 失敗すると、位置・再生中かどうか・速度を覚え、固定 URL に非永続の再取得 query（`_r`）を付けて読み直し、同じ位置へ戻す
- 自動復帰は 1 回の失敗に 1 回だけ。復帰直後にまた失敗したら `status: "failed"` で止まる
  - 呼び出し側はエラーと「再開」操作を出し、`resume()` を呼ぶ
- **許可を失った場合（logout・退室・削除で 401/404）は、自動では再試行しない**
  - HTTP の状態は見ない（ブラウザで 302 を追わずに状態を知るには fetch が要り、client HTTP は axios だけという規約に例外を作らないため）
  - 自動復帰 1 回の後は `failed` で止まる。再開しても許可が無ければ、また `failed` に戻る
- **先回りの読み直し**: 読み込み開始（`loadstart`）から `readTtlSec(video|audio) − 30 秒`（`PROACTIVE_RELOAD_MARGIN_SEC`）を過ぎた要素で再生・シークが起きたら、失敗を待たずに同じ手順で読み直す
  - Chrome は期限後のシークで約 27 秒待ってからエラーを出すため、待たせずに済むようにする
  - 失敗ではないので自動復帰の回数は使わない。ブラウザの判別はしない
  - 署名は読み込み開始より後に発行されるので、開始時刻から数えると早めに倒れる
- src が固定 URL でなければ何もしない（旧 URL・公開 URL はそのまま）
- 配線済み: `AppVideo`（src/components/Media/AppVideo。`VideoPreview`（lib/mediaInputSuite）と `DetailModal` の動画はこれを描く）。props の追加は無い
- 独自のプレーヤーに配線するとき: `recovery.videoProps` を要素に広げ（`<video ref={mediaRef} {...recovery.videoProps} />`）、`status === "failed"` でエラーと `resume()` の操作を出す
  - `videoProps` = `src` + `handleError` / `handleLoadedMetadata` / `handleCanPlay` / `handleLoadStart` を同名のイベントに、`handlePlaybackIntent` を `onPlay` と `onSeeking` に配線した物（同じ src の間は同じ参照）
  - 個別の `handle*` は、包んで使うとき（`handleError` の真偽でエラー表示を決めるなど）だけ
- `<source>` 子要素だと読み込み失敗の error が `<source>` 側に出て、media 要素の onError に届かない

### 未設定のとき

- `resolveStorageSrc` は例外を投げない（公開 base が無ければ pub の ref に null）
- ポートの構築、各モジュールの import は env が空でも落ちない(保存先と公開 base は設定の関数を使うたびに呼ぶ。import では呼ばない)（sharp も初回の描き直しまで読み込まない）
- 操作した時点で、次のエラーがすぐに出る
  - pub / priv の env 不足は `StorageNotConfiguredError`
  - Firebase Admin の未設定は `FirebaseNotConfiguredError`

### Firebase Storage のルール（全拒否）

- リポ直下の `storage.rules` と `firebase.json` を upstream が同梱する。業務のポリシーは一切持たない（判定はアプリのサーバーだけ）
- 配備: `firebase deploy --only storage --project <project-id>`。既存のプロジェクトでは、アプリの配備 → 新しい経路の確認 → ルールの配備 → 旧 URL の確認、の順（docs/setup/Neon_Firebaseなど各種バックエンドサービスの設定方法.md §6.1）
- 旧 URL（ダウンロードトークン付き URL・公開 URL）はルールを通らないので、配備後も読める
