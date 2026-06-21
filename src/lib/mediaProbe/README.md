# mediaProbe — サーバーサイド メディア解析（probe）

ストレージ上のメディア（動画・音声）をサーバー側で解析し、**ストリーム構成**を返す
ドメイン非依存の汎用 capability。主目的は「音声トラックの有無」の確実な判定。

クライアント側の検出は標準 API が無くブラウザ依存で安全性を保証できないため、
配信物の安全性に関わる検証はこの層（サーバー）で行う。

---

## 責務の境界（重要）

- **この層（tier1）は「事実」だけを返す**: `hasAudioTrack` / `hasVideoTrack` / コンテナ / 尺 / コーデック等。
- **用途別ルールは消費側（ドメイン）の責務**: 「背景動画は音声なし」「BGM は音声あり」等の
  ポリシー判定・拒否（409 等）・孤児削除は呼び出し側で行う。ここには持ち込まない。

これにより特定用途に縛られず、どのフォークでも再利用できる。

---

## 使い方（サーバー）

```ts
import { probeMedia, isSilentVideo } from "@/lib/mediaProbe";

// storagePath 推奨（内部で短命の署名付き URL を払い出す）。downloadUrl も可。
const result = await probeMedia({ storagePath: "uploads/xxx.mp4" });

if (!result.ok) {
  // result.error.code: "fetch_failed" | "unsupported_container" | "probe_failed" | "timeout"
  // → 消費側で 4xx/5xx へマップ
} else {
  result.hasAudioTrack; // ★ 主目的
  result.container;      // "mp4" | "webm" | "mp3" ...
  result.video;          // { codec, width, height, fps } | null
  result.audio;          // { codec, channels, sampleRate } | null
}
```

### ドメインの create ラッパーでの消費イメージ

```ts
const probe = await probeMedia({ downloadUrl });
if (!probe.ok) throw new DomainError(probe.error.message, { status: 422 });
// 背景動画: 無音動画のみ許可
if (!isSilentVideo(probe)) throw new DomainError("音声トラックを含む動画は使用できません。", { status: 409 });
```

### 内部 API（任意・admin 限定）

`POST /api/media/probe` body: `{ storagePath }` または `{ downloadUrl }`。
別ランタイム/クライアントからの事前検証用。失敗コードを HTTP ステータスへマップして返す。

---

## アーキテクチャ — エンジン差し替え

「中をどう覗くか」を `ProbeEngine` インターフェースで抽象化し、契約（`ProbeFacts`）を
変えずに実装を入れ替えられる。

```
probeMedia()                       … 消費側はこれだけ呼ぶ
  ├─ createMediaSource()           … 署名 URL + Range 取得（フル DL しない）
  └─ ProbeEngine.probe()
        └─ mediainfoEngine (WASM)  … 既定。npm 追加のみ・Vercel 同梱リスクなし・広コンテナ対応
```

### 既定エンジン（mediainfo.js / WASM）

- native バイナリ同梱が不要で、サーバーレス（Vercel）でも移植性が高い。
- `next.config.ts` の `serverExternalPackages` に `"mediainfo.js"` を登録済み
  （実行時に node_modules の WASM をロードするため）。

### WASM の解決とバンドル同梱（dev と本番の両対応）

`.wasm` の扱いは dev（Turbopack）と本番（Vercel / @vercel/nft）で要件が相反するため、
両方を満たすよう次の 2 段構えにしている。混乱しやすいので変更時は両方を必ず考慮すること。

1. **Turbopack 回避（dev）**: `mediainfoEngine.ts` は `req.resolve("...MediaInfoModule.wasm")`
   のような `.wasm` 文字列リテラルを持たない。リテラルがあると Turbopack が WASM ローダーを
   自動生成して `Module not found: 'a'` で落ちるため、`package.json` からディレクトリを辿り
   `.wasm` パスは実行時に `path.join` で組み立てる。
2. **バンドル同梱（本番）**: 上記により nft の静的検出が効かないので、`next.config.ts` の
   `outputFileTracingIncludes` で `MediaInfoModule.wasm` を明示同梱する。これが無いと本番で
   `ENOENT: ... MediaInfoModule.wasm` になる。

> probeMedia を **API ルート以外**（SSR ページ / Server Action 等）から呼ぶフォークは、
> `outputFileTracingIncludes` にそのルートのキーを追加すること（既定は `"/api/**"`）。

### エンジンの追加・差し替え

```ts
import { registerProbeEngine, setDefaultProbeEngine } from "@/lib/mediaProbe";

registerProbeEngine(myFfprobeEngine);   // 例: より詳細な情報が必要なフォーク
setDefaultProbeEngine("ffprobe");
```

将来 ffprobe バイナリ / 外部メディア処理サービスを `ProbeEngine` として追加可能
（ffprobe は Vercel への native バイナリ同梱検証が前提）。

---

## 取得方式

フルダウンロードしない。Firebase Storage の path を短命の署名付き URL に変換し、
エンジンが HTTP Range で「目次（moov 等）」付近のみ取得する。サイズはメタデータ
（不能時は `bytes=0-0` の Content-Range）から得る。

---

## 関連

- `src/lib/seamlessVideo/probe/`: **変換後 fmp4 フラグメント**の検証用 ISO BMFF パーサ。
  入力（変換前の任意アップロード）も目的（用途別検証）も異なる別物。混同しないこと。
- `src/lib/storage/`, `src/lib/firebase/server/storage.ts`: ストレージ参照の解決元。

## 対応範囲・上限

- コンテナ: mp4 / mov / webm / mkv / mp3 / wav / ogg / aac / flac 等（mediainfo が網羅）。
- タイムアウト: 既定 10s（`ProbeOptions.timeoutMs`）。
- 署名 URL 有効期限: 既定 120s（`ProbeOptions.signedUrlTtlSec`）。
- 尺の上限判定は返り値の `durationSec` を使って**消費側**で行う（ポリシー）。
