# analyticsConsent

## Overview

ブラウザのアクセス解析(ページビュー・カスタムイベント)を送ってよいかを決める門(`@/lib/analyticsConsent`、client)。計測サービスには依存しない。

- 送ってよい = 設定の `enabled` が true、かつ同意の条件を満たす
- 同意の条件 = `consent: "notRequired"`、または同意の状態が `"granted"`
- 既定は `enabled: false` / `consent: "required"`(何も送らない。計測はオプトイン)
- どの計測サービスに送るかは env で決まる(今は Firebase Analytics = `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`。`src/lib/firebase/README.md`「Firebase Analytics」)
- 管理画面の DAU などサーバー側の集計(`domains/core/analytics`)はこの門の対象外
- 今この門を通るのは Firebase Analytics だけ。`src/lib/googleTag` / `src/lib/clarity` は env の設定だけで動き、この門を見ない

## Usage

### 同意バナー / CMP をつなぐ(fork)

状態はこのタブのメモリにだけある。選択の保存はバナー / CMP が持ち、ページの読み込み時(保存済みの選択)と、選択が変わったときに `setAnalyticsConsent` を呼ぶ。

```tsx
"use client";
// 例: fork の同意バナー。全ページに出すなら自分のドメインの plugs/rootProviders/<名前>.tsx(根の枠の点 rootProviders、段 project)の Provider で children の隣に描く
import { useEffect } from "react";
import { setAnalyticsConsent, useAnalyticsConsent } from "@/lib/analyticsConsent";
import { useLocalStorage } from "@/lib/browserStorage";

export function AnalyticsConsentBanner() {
  const [stored, setStored] = useLocalStorage("analytics-consent", "");
  const { consent } = useAnalyticsConsent();

  // 保存済みの選択を読み込み時に渡す
  useEffect(() => {
    if (stored === "granted" || stored === "denied") setAnalyticsConsent(stored);
  }, [stored]);

  if (consent !== "unknown") return null;
  // 文言・見た目は fork の自由。「同意する」= granted、「拒否」= denied を保存して渡す
  return (/* ...setStored("granted") / setStored("denied") を呼ぶボタン... */ null);
}
```

- 同意の取得を求めない運用は、バナーを置かずに `consent: "notRequired"`

## API

- `setAnalyticsConsent("granted" | "denied" | "unknown")` — 同意の状態を渡す。値が変わったときだけ購読者に知らせる
- `getAnalyticsConsent()` — 今の同意の状態(初期値 `"unknown"` = 未回答、送らない側)
- `subscribeAnalyticsConsent(listener)` — 変化の購読。戻り値で解除
- `isAnalyticsAllowed()` — 今送ってよいか
- `decideAnalyticsAllowed(config, consent)` — 判定の純関数(テスト用)
- `useAnalyticsConsent()` — `{ consent, allowed }` を購読するフック(バナーの出し分けなど)

## Extension

- 設定: 既定 `src/lib/analyticsConsent/config.ts`、fork の上書き `src/config/lib/analyticsConsent.config.ts`(= `@lib-config/analyticsConsent`)。鍵 `enabled`・`consent`

## Internals

- 同意が後から `granted` になると、`<FirebaseAnalytics />` はその時点のページのページビューを 1 回送る
- `denied` に変わると、初期化済みの計測サービスの収集を止める(Firebase: `setAnalyticsCollectionEnabled(false)`)。再び `granted` で戻る
- 多くの計測サービスはタグを読み込んだ時点で送る(初期化を許可まで遅らせる理由)

## Verification

- `pnpm test src/lib/analyticsConsent`(判定の組み合わせ・購読・上書きの値)
- Firebase Analytics が許可まで初期化しないこと: `src/lib/firebase/client/analytics.test.ts`

## Related

- Firebase Analytics: `src/lib/firebase/README.md`
