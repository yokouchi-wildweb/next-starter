# seamlessVideo

事前に統一プロファイルへ変換された **fragmented MP4(fmp4)** フラグメントを、ブラウザの **MSE(MediaSource Extensions)** で 1 本の映像として **継ぎ目なく連結再生** する汎用ライブラリ。

複数の演出動画を「順不同で繋いで 1 本に見せる」ユースケース(抽選で順序が実行時に決まる等)を想定。

## スコープ

- **やること**: 適正なフォーマットの fmp4 を受け取り、継ぎ目なく連結再生する / フォーマットをクライアント側で検証する。
- **やらないこと**: 動画の **変換(トランスコード)**。ffmpeg 等のサーバー変換はこのライブラリの責務外(下記「入力フォーマット規約」を満たす成果物を別途用意する前提)。

## なぜ変換を含まないか

トランスコードはネイティブバイナリ(ffmpeg)・CPU/メモリ・実行時間を要し、通常の Web アプリのリクエスト処理に収まらない。変換は外部の動画サービス(Mux / Cloudflare Stream 等)か専用の変換ワーカーに委譲し、本ライブラリは「変換済み fmp4 を繋ぐ」再生基盤に徹する。

## 使い方

### コンポーネント(最小)

```tsx
import { SeamlessVideoPlayer } from "@/lib/seamlessVideo";

<SeamlessVideoPlayer sources={[url1, url2, url3]} autoPlay muted />;
```

`sources` は再生したい順の配列。`string`(URL) / `Blob` / `ArrayBuffer` / `Uint8Array` を受け付ける。
※ 参照変化で再読み込みするため、呼び出し側で `sources` を memo 化すること。

### フック(動的追加・進捗制御が必要な場合)

```tsx
const { videoRef, load, append, status, progress } = useSeamlessVideo();
// <video ref={videoRef} controls />
await load([a, b]);   // プレイリスト一括
await append(c);       // 実行時に末尾追加
```

### コア(フレームワーク非依存)

```ts
const src = new SeamlessSource(videoEl, { onFragmentAppended });
await src.load([a, b, c]);
```

### フォーマット検証(汎用・アップロード前/再生前チェック)

```ts
import { validateFragments } from "@/lib/seamlessVideo";

const report = await validateFragments([
  { name: "clip1.mp4", data: file1 },
  { name: "clip2.mp4", data: file2 },
]);
if (!report.ok) console.log(report.errors, report.fragments);
```

`report.ok` が true なら継ぎ目なし連結が成立する見込み。`errors` / `fragments[].issues` に破綻要因が入る。

## 入力フォーマット規約(= 「適正なフォーマット」の定義)

この条件を満たす fmp4 を渡せば連結再生が成立する。変換側(外部/別ワーカー)はこの規約に従って出力する。

| 項目 | 要件 |
| --- | --- |
| コンテナ | fragmented MP4(fmp4)。各フラグメントは単体完結(ftyp+moov+moof+mdat) |
| 映像コーデック | H.264(avc1) |
| 解像度 / fps / timescale | 全フラグメントで完全統一(init が互換になり継ぎ目が消える) |
| GOP | closed GOP、各フラグメント先頭が IDR(独立デコード可能 = 任意順連結の前提) |
| B-frame | v1 は `-bf 0`(なし)を推奨(境界のガタつき要因を排除) |
| 音声 | v1 は **なし**(音声 gapless 連結は別問題。BGM 等は別レイヤーで重ねる前提) |

### 推奨 ffmpeg コマンド(参考 / このライブラリは実行しない)

変換成果物を作る側が一度流す手順の叩き台。値(解像度・fps)は要件に合わせて差し替える。

```sh
ffmpeg -i input.mp4 \
  -an \
  -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -r 30 -vsync cfr \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -g 30 -keyint_min 30 -sc_threshold 0 -bf 0 \
  -movflags +frag_keyframe+empty_moov+default_base_moof \
  output.fmp4.mp4
```

- `-an`: 音声なし / `-bf 0`: B-frame なし / `-g 30 -keyint_min 30 -sc_threshold 0`: GOP 固定(先頭 IDR)
- `force_original_aspect_ratio + pad`: アスペクト比のガタつきを防ぐ(引き伸ばしでなく余白埋め)
- `+frag_keyframe+empty_moov`: fmp4 化

## 仕組み(連結の要点)

- `SourceBuffer.mode = "sequence"` で、各フラグメント内部のタイムスタンプ(各々 0 始まり)を直前メディア末尾へ自動連結する。これが任意順連結の核。
- 各フラグメントが自分の init を含むため、同一コーデックなら順次 append でき、コーデックが変わる場合のみ `changeType` で切り替える。
- iPhone Safari は通常の `MediaSource` 非対応。本ライブラリは `ManagedMediaSource`(iOS 17.1+)を透過的に使用する。

## 音声付き連結(方式 B: SeamlessReel)

各フラグメント固有の音声を「映像=MSE 連結 / 音声=Web Audio ギャップレス連結」で同時再生し、両者を同期させる。
ガチャ抽選演出のように「数種類の音声付きフラグメントを実行時の順序で連続再生する」用途を想定。

### 資産モデル

各フラグメントを **映像と音声の別ファイル**で用意する。

- 映像: 映像のみ fmp4(上記「入力フォーマット規約」に準拠)
- 音声: **.wav 推奨**(priming 無しで完全ギャップレス) / .m4a/.aac/.mp3 も可
- 同一フラグメントの映像尺と音声尺は揃える(ズレは映像尺をマスターに補正、検証で警告)

### 使い方

```ts
import { useSeamlessReel } from "@/lib/seamlessVideo";

const { videoRef, load, play, pause, status, audioEnabled } = useSeamlessReel();
// <video ref={videoRef} controls playsInline />  ← 音は Web Audio から出るため常時ミュートされる

await load([
  { video: v1, audio: a1 },
  { video: v2, audio: a2 },
]);
await play(); // 必ずユーザー操作(クリック)内から呼ぶ(AudioContext の制約)
```

検証は `validateReel(inputs)`(映像 fmp4 + 音声デコード可否 + 映像/音声尺整合)。
レポートは `formatReelValidationReport(report)` / 映像のみは `formatValidationReport(report)` で人間可読な文字列配列へ整形できる(UI 表示・ログ用。装飾は呼び出し側)。

### unlock(): 非同期 play() でも音を出す(AudioContext の事前起動)

`play()` を「タップ → サーバー往復(await) → 再生」のように**ユーザー操作の同期外**で呼ぶと、AudioContext を
resume できず音が出ない(モバイルの自動再生制約)。これを避けるため、AudioContext は**フックインスタンス内で
1 つだけ生成して load を跨いで生存**させ、`unlock()` を公開している。

```ts
const { unlock, load, play } = useSeamlessReel();
// 開始タップ(確実なユーザー操作)の同期内で 1 回だけ:
await unlock();                              // ctx を生成&resume(再生はしない・冪等)
// 以降は任意のタイミング(await 後=gesture 外でも):
await load(fragments, { progressive: true });
await play();                                // gesture 外でも音が鳴る
```

- `unlock()` は load より前に呼べ、冪等(複数回呼んでも安全)。
- context は `load()` ごとに作り直さず生存(映像側 MSE/SourceBuffer は従来どおり毎 load 再生成)。
- `reset()` / コンポーネント unmount で context を `close`(リークなし)。
- 既存利用(load → ▶ タップで play)は load 内 unlock が gesture 内で resume するため**従来どおり**動作。

### 読み込み最適化(各プロジェクトで本番UIを作りやすくするための土台)

- **並列ダウンロード**: 取得は内部で並列化済み(append は順序維持)。直列待ちにならない。
- **progressive 読み込み**: `load(fragments, { progressive: true })` で**先頭フラグメントが用意でき次第 `playable`(=`status:"ready"`)**になり、残りは裏で読み込み+逐次デコード/スケジュール。読み込み待ちの体感をほぼ即時にできる。
- **差し替え可能 fetcher**: `useSeamlessReel({ fetcher })` / 各 options の `fetcher?: (url) => Promise<ArrayBuffer>` で、URL ソースの取得に認証ヘッダ・独自キャッシュ・CDN 署名・プリフェッチ等を差し込める(Blob/ArrayBuffer ソースには非適用)。
- **状態の取得(独自UI構築用)**: フック返り値に `playable` / `complete` / `loaded {video,audio,total}` / `bufferedSec` / `currentFragment` を提供。スピナー/プログレス/トランジション等を各プロジェクトが自由に実装できる。UI コンポーネントは固定提供せず、**「エンジン + 状態の豊富なフック」を土台**にする方針。

```ts
const { videoRef, load, play, status, playable, complete, loaded, bufferedSec, currentFragment } =
  useSeamlessReel({ fetcher: myFetcher });

await load(fragments, { progressive: true }); // 先頭準備で ready(=playable)
// playable になったら再生可能。complete で全読み込み完了。
```

### 拡張ポイント(再生制御・音量・BGM・動的シーケンス・先読み)

すべてオプトイン。`useSeamlessReel` / `SeamlessReel` から利用する。

- **ライフサイクル**: `onPlay` / `onPause` / `onEnded`(loop 時は ended を出さず先頭へ)。例: ガチャ演出終了 → 結果表示は `onEnded` で。
- **ループ**: `useSeamlessReel({ loop: true })`。
- **再生レート(早送り)**: `setRate(rate, { mute? })`。フラグメント音声マスターを `rate` 倍速化し、映像はソフト同期で追従する。範囲は **0.25〜4x にクランプ**(範囲外は丸め)。`setRate(1)` で完全に等速へ復帰(同期も通常状態へ戻る)。`AudioBufferSource.playbackRate` 方式のため**音程(ピッチ)は rate に比例して上がる**(等ピッチ化はしない)。`{ mute: true }` で同時に無音化可。音声無効(映像のみ)時は映像 `playbackRate` を直接変更。例: 押しっぱなしで `setRate(3)` → 離して `setRate(1)`。
- **ミュート**: `setMuted(muted)`。`volume` を保持したまま出力のみ 0(復音で元の音量へ)。早送り中のピッチ上昇音を消す用途。`setRate` の `mute` オプションと同じ仕組み。
- **音量 / フェード**: `setVolume(v)` / `fade(target, sec)`(フラグメント音声のマスター)。
- **連続 BGM(別レイヤー)**: `setBgm(url, { loop, volume })` → `play()` 時に自動再生。`setBgmVolume` / `fadeBgm` でダッキング・フェード可。フラグメント音声とは独立。
- **動的シーケンス**: `load(fragments, { open: true })` でストリームを開いたままにし、`appendFragment(fragment)` で実行時に継ぎ足し、`endReel()` で確定。抽選を再生中に決めるような用途向け。
- **章ジャンプ**: `seekToFragment(index)`(音声尺ベース)。
- **ワンショットSE**: `playSe(url, { atFragment?, volume? })`。tier リビール等の瞬間にフラグメント境界同期で効果音を 1 回再生(BGM とは別経路、デコードキャッシュあり)。
- **先読み**: `prefetchFragments(urls, fetcher?)` / `prefetchManifest(manifest, fetcher?)` で再生前にキャッシュを温める。**取得バッファは保持せずブラウザ HTTP キャッシュ依存**(容量は LRU でブラウザ管理＝本ライブラリ側で肥大しない)。

### 長時間 open ストリームのメモリ対策(quota / 退避)

- `appendBuffer` の `QuotaExceededError` は常時捕捉し、再生済み区間を `remove` して 1 度だけ再試行(堅牢化、常時有効)。
- `useSeamlessReel({ bufferBehindSec })` を設定すると、再生位置より前を一定秒だけ残して**映像(`SourceBuffer.remove`)・音声(再生済みバッファ破棄)を自動退避**。`open:true` で 1 本を長く継ぎ足すラッシュ用途のメモリ肥大を防ぐ。

### 読み込み失敗時の回復契約(progressive)

- `onFragmentError?: (index, error) => "skip" | "abort"`(既定 `"abort"`）。
  - `"skip"`: そのフラグメントを**映像・音声まとめて欠落**として読み飛ばし継続(A/V 整合を保持)。
  - `"abort"`: 以降の読み込みを停止。**まだ再生可能でなければ `load()` は reject**(呼び出し側で「結果へ抜ける」等のフォールバックへ)。
  - フラグメントは映像+音声を揃えてから確定する原子的読み込みのため、片方だけ欠けた中途半端な状態にならない。
  - ※ 非 progressive の `load()` は全件揃い前提(1 本でも失敗で reject)。skip は progressive 専用。

### 仕組み

- 音声は再スケジュールでプチノイズが出やすいので「音声をマスター」とし、映像側の `playbackRate` を微調整して寄せる(ソフト同期ループ、既定 200ms 間隔)。大きくズレた時のみ音声を映像位置へスナップ。
- 再生/一時停止/シーク/バッファリングは video 要素のイベントを正とし、音声を追従させる。
- 音は Web Audio から出すため video 要素は常にミュート(映像に音が含まれていても二重再生しない)。

### 制約・注意

- **2 つのクロック(映像/音声)を扱うため A/V 同期は近似**。ガチャ演出のように厳密なリップシンクが不要な用途を想定。
- **早送り(`setRate`)はバッファ済み区間に対して継ぎ目維持**。progressive 読み込み中に取得が追いつかない高倍率を指定すると映像バッファが枯渇し得る(機能のバグではなくデータ供給律速)。読み込み完了後の早送りは安全。レート変更時に音声を現在位置から再スケジュールするため、瞬間的に約 50ms のリスケジュールを挟む(押下/離しの 2 回程度では問題にならない)。
- AudioContext はユーザー操作起点でしか開始できない(`play()` は必ずクリック等の中から呼ぶ)。
- 全フラグメントに音声がある場合のみ音声連結が有効(一部欠落時は映像のみ再生)。
- iPhone は ManagedMediaSource(映像)＋ Web Audio(音声)で動作。iOS 17.1+ 前提、実機確認推奨。

## 永続化・共有(URL 再生)と CORS

リールを URL ベースで保存・共有し、別端末で再生するための仕組み。

- `buildReelManifest(fragments, createdAtISO)` でマニフェスト(各フラグメントの公開 URL + 順序)を作成
- `reelManifestClient.save(manifest, key?)` で保存(サーバー側は `server/reelManifestStore`)。`key` 省略時は最新スロット、指定で任意キー名前空間(複数リール定義を URL で持てる)。`saveLatest(manifest)` は後方互換
- 再生側は保存済みマニフェストを `manifestToFragments(manifest)` に通して `useSeamlessReel().load(...)` へ
- アップロードは `clientUploader`(ブラウザ→Firebase 直、サイズ制限なし)を使う

### ⚠ 重要: 別ドメイン URL の再生にはバケットの CORS 設定が必要

URL ソースの再生は MSE(`appendBuffer`)/ Web Audio(`decodeAudioData`)がバイト列を `fetch()` で読むため、
別ドメイン(Firebase Storage 等)のバケットに CORS 設定が無いと再生時に `Failed to fetch` になる。
これは seamlessVideo 固有ではなく **「別ドメインの Storage バイトを読む全機能の共通基盤前提」** で、
設定は `pnpm storage:setup-cors` で一度きり。**判定ルール・前提(権限/env)・手順・トラブルシュートは一次情報を参照**:

➡ [Storage の CORS 設定（リモートメディア読み取りの基盤前提）](../../../docs/how-to/initial-setup/StorageのCORS設定（リモートメディア読み取りの基盤前提）.md)

seamlessVideo 固有の補足:

- アップロード前の File/Blob を直接 `load()` に渡す場合は fetch しないため CORS 不要。
- URL 取得は `core/fragmentBytes.ts` が `@/lib/storageCors` の `fetchStorageBytes` 経由で行うため、
  開発時は CORS 未設定で失敗すると自動で設定コマンドを案内する。

## 既知の制限(v1)

- **先頭キーフレーム判定は同期サンプルフラグ(trun/tfhd)ベースの近似**。NAL レベルで IDR 種別までは厳密判定しない(判定不能時は警告)。
- MSE 非対応環境のフォールバック(通常再生への切替)は本ライブラリの責務外。`isMseSupported()` で判定して呼び出し側でハンドリングする。
- 音声は WAV 推奨。圧縮音声(AAC 等)は encoder delay により継ぎ目で僅かな差異が出る場合がある。
