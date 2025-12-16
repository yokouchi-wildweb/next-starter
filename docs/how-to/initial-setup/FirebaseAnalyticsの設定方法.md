# Firebase Analytics の設定方法

Firebase Analytics を使ってページビューやカスタムイベントをトラッキングできます。

## クイックスタート

### 1. Firebase コンソールで Analytics を有効化

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを開く
2. 左メニュー「Analytics」→「Analytics を有効にする」
3. プロジェクト設定 > 全般 > マイアプリから **Measurement ID**（`G-XXXXXXXXXX`）を取得

### 2. 環境変数を設定

```bash
# .env.local
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3. 完了

これだけで設定完了です。ページビューは自動でトラッキングされます。

## カスタムイベントの送信

```tsx
import { trackEvent } from "@/lib/firebase/client/analytics";

trackEvent("button_click", { button_name: "signup" });
```

## フォーク先での利用

`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` を設定しなければ Analytics は自動的に無効化されます（エラーは発生しません）。

---

## 詳細ドキュメント

API リファレンス、推奨イベント、トラブルシューティングについては以下を参照してください。

**[src/lib/firebase/README.md](../../../src/lib/firebase/README.md)**
