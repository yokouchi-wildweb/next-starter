# analyticsConsent

ブラウザのアクセス解析（ページビュー・カスタムイベント）を**送ってよいか**を決める門。計測サービスには依存しない。

- 送ってよい = 設定の `enabled`（既定 `src/lib/analyticsConsent/config.ts`、fork は上書き `src/config/lib/analyticsConsent.config.ts` = `@lib-config/analyticsConsent`）が true、かつ同意の条件を満たす
- 同意の条件 = `consent: "notRequired"`、または同意の状態が `"granted"`
- 既定は `enabled: false` / `consent: "required"`（何も送らない。計測はオプトイン）
- どの計測サービスに送るかは env で決まる（今は Firebase Analytics = `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`。`src/lib/firebase/README.md`「Firebase Analytics」）
- 管理画面の DAU などサーバー側の集計（`features/core/analytics`）はこの門の対象外

## API（`@/lib/analyticsConsent`、client）

- `setAnalyticsConsent("granted" | "denied" | "unknown")` — 同意の状態を渡す。値が変わったときだけ購読者に知らせる
- `getAnalyticsConsent()` — 今の同意の状態（初期値 `"unknown"` = 未回答、送らない側）
- `subscribeAnalyticsConsent(listener)` — 変化の購読。戻り値で解除
- `isAnalyticsAllowed()` — 今送ってよいか。計測サービスの実装は送る前・初期化の前に必ずこれを見る
- `decideAnalyticsAllowed(config, consent)` — 判定の純関数（テスト用）
- `useAnalyticsConsent()` — `{ consent, allowed }` を購読するフック（バナーの出し分けなど）

## 同意バナー / CMP をつなぐ（fork）

状態はこのタブのメモリにだけある。**選択の保存はバナー / CMP の持ち物**で、ページの読み込み時（保存済みの選択）と、選択が変わったときに `setAnalyticsConsent` を呼ぶ。

```tsx
"use client";
// 例: fork の同意バナー。全ページに出すなら src/app/_providers/ForkProviders.replace.tsx（fork の口。スイッチ ForkProviders.tsx をそちらへ向ける）で children の隣に描く
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

- 同意が後から `granted` になると、`<FirebaseAnalytics />` はその時点のページのページビューを 1 回送る
- `denied` に変わると、初期化済みの計測サービスの収集を止める（Firebase: `setAnalyticsCollectionEnabled(false)`）。再び `granted` で戻る
- 同意の取得を求めない運用なら、バナーを置かずに `consent: "notRequired"` にする（fork の判断で明示的に選ぶ）

## 計測サービスの実装を足すとき

- 初期化（タグの読み込み）を `isAnalyticsAllowed()` が true になるまで遅らせる。読み込んだ時点で送るサービスが多い
- 送る関数（page_view・イベント）でも毎回 `isAnalyticsAllowed()` を見る
- `subscribeAnalyticsConsent` で取り消しを受け、収集を止める
- 今この門を通るのは Firebase Analytics だけ。`src/lib/googleTag` / `src/lib/clarity` は env の設定だけで動く（どう揃えるかは未決）

## テスト

`pnpm test src/lib/analyticsConsent`（判定の組み合わせ・購読・上書きの値）。Firebase Analytics が許可まで初期化しないことは `src/lib/firebase/client/analytics.test.ts`
