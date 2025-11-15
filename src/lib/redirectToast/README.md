# redirectToast の使い方

`redirectWithToast` を使うと、サーバー側でリダイレクトを実行するタイミングでトースト表示用の情報を保存できます。遷移先では `RedirectToastProvider` が Cookie から情報を読み取り、クライアント側のトーストを自動で表示します。

## セットアップ

アプリ全体のレイアウトなど、クライアントで必ず一度だけ評価される場所に `<RedirectToastProvider />` を自閉タグで配置してください。子要素でラップする必要はありません。

```tsx
// 例: src/app/layout.tsx
import { RedirectToastProvider } from "@/lib/redirectToast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <RedirectToastProvider />
        {children}
      </body>
    </html>
  );
}
```

## リダイレクト + トーストを発火する

サーバーアクションや `page.tsx` などサーバー環境で、`redirectWithToastSuccess(url, message)` のようなヘルパー関数を呼び出すだけです。トースト情報は Cookie に保存され、リダイレクト後に自動で表示されます。

```tsx
// 例: src/app/samples/actions.ts
"use server";

import { redirectWithToastSuccess } from "@/lib/redirectToast";

export const handleSubmit = async (formData: FormData) => {
  // ...サーバー処理...

  redirectWithToastSuccess("/samples", "サンプルを登録しました");
};
```

`redirectWithToastSuccess`, `redirectWithToastError`, `redirectWithToastWarning`, `redirectWithToastInfo`, `redirectWithToastDefault` のヘルパーを用意しています。画面のトーンに合わせて使い分けてください。必要に応じて `redirectWithToast({ type, message }, url)` のように直接ペイロードを渡すこともできます。
