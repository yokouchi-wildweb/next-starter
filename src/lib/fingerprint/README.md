# fingerprint - ブラウザフィンガープリント収集ライブラリ

## Overview

- デバイス信号の収集・正規化・ハッシュ化と、フォーム操作の行動計測を提供するドメイン非依存のライブラリ
- 使う時・直す時の決まりは札 .claude/rules/items/lib/fingerprint.md にある。この README は使い方と仕組み
- 閉じた lib。入口は 3 つ: `@/lib/fingerprint`(client 用。`"use client"` の `useBehavioralCapture` を含むので server からは読まない)・`@/lib/fingerprint/hash`(server でハッシュが要るとき)・`@/lib/fingerprint/types`(型だけ)
- 収集はブラウザの API を使う。SSR の文脈では全成分 null の骨格が返る

## API

### `collectFingerprintPayload()` — 収集の一括実行

```ts
import { collectFingerprintPayload } from "@/lib/fingerprint";

const payload = await collectFingerprintPayload();
// => { version, componentHashes, webglRenderer, rawSignals }
```

内部で `collectDeviceSignals()`（信号収集）→ `buildComponentHashes()`（検索軸の成分別ハッシュ導出）を実行する。

収集する信号（取れない環境では null）:

| 成分 | 内容 |
|---|---|
| canvas | Canvas 2D 描画結果のハッシュ（GPU/ドライバ/フォントレンダリング個体差） |
| webgl | UNMASKED_VENDOR / RENDERER + 主要パラメータ・拡張のハッシュ |
| audio | OfflineAudioContext 出力波形のハッシュ（DSP 実装差） |
| fonts | テキスト幅測定によるインストール済みフォント検出 |
| screen / timezone / languages / platform | 環境情報の可読キー |
| hardware | hardwareConcurrency / deviceMemory / maxTouchPoints |
| uaData | UA Client Hints（getHighEntropyValues、Chromium のみ） |
| codecs / math | コーデック対応表・Math 関数の丸め癖 |

その他の出す物: `collectDeviceSignals()` / `buildComponentHashes()`(上の 2 段を個別に)・`hashString` / `hashValue` / `stableStringify` / `fnv1a32Hex`(ハッシュ)・版 `FINGERPRINT_SIGNALS_VERSION` / `BEHAVIOR_PAYLOAD_VERSION` と型 `DeviceSignals` / `FingerprintPayload` / `BehaviorPayload` など

### `useBehavioralCapture()` — フォーム行動計測（ヘッドレス）

```tsx
"use client";
import { useBehavioralCapture } from "@/lib/fingerprint";

const behavior = useBehavioralCapture();

// フォームのラッパー要素に spread する（capture フェーズで配下全 input を計測）
<div {...behavior.containerProps}>
  {/* ...フォーム... */}
</div>

// 送信時に統計 payload を回収
const payload = behavior.getPayload();

// 計測をやり直す
behavior.reset();
```

## Related

- 蓄積・照合: [`features/core/deviceFingerprint`](../../features/core/deviceFingerprint/README.md)
- 回答チャレンジ: [`features/core/fingerprintChallenge`](../../features/core/fingerprintChallenge/README.md)
