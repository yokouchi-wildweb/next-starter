# fingerprint - ブラウザフィンガープリント収集ライブラリ

デバイス信号の収集・正規化・ハッシュ化と、フォーム操作の行動計測を提供する **ドメイン非依存** ライブラリ。DB・HTTP は一切持たない。

- 蓄積・照合: [`features/core/deviceFingerprint`](../../features/core/deviceFingerprint/README.md)
- 回答チャレンジ: [`features/core/fingerprintChallenge`](../../features/core/fingerprintChallenge/README.md)

---

## 提供 API

### `collectFingerprintPayload()` — 収集の一括実行

```ts
import { collectFingerprintPayload } from "@/lib/fingerprint";

const payload = await collectFingerprintPayload();
// => { version, componentHashes, webglRenderer, rawSignals }
```

内部で `collectDeviceSignals()`（信号収集）→ `buildComponentHashes()`（検索軸の成分別ハッシュ導出）を実行する。ingest API へはこの payload をそのまま送る。

収集する信号（各成分は個別 try-catch の fail-soft。取れない環境では null）:

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

### `useBehavioralCapture()` — フォーム行動計測（ヘッドレス）

```tsx
"use client";
import { useBehavioralCapture } from "@/lib/fingerprint";

const behavior = useBehavioralCapture();

// フォームのラッパー要素に spread するだけ（capture フェーズで配下全 input を計測）
<div {...behavior.containerProps}>
  {/* ...フォーム... */}
</div>

// 送信時に統計 payload を回収
const payload = behavior.getPayload();
```

計測