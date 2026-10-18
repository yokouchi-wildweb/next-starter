# StarterHome — 上流デモ用トップページと差し替え手順

`src/app/(user)/page.tsx`（`/`）の中身。上流 next-starter の「スターターの顔」として、
同梱機能の一覧と `/demo` への導線だけを 1 画面に収めた軽量な Server Component です。

## 構造

```
src/app/(user)/
├── page.tsx                      # 1 行のスイッチ。上流は今後このファイルを編集しない
└── _components/
    └── StarterHome/              # 上流所有。下流は編集も削除もしない
        ├── index.ts
        ├── StarterHome.tsx       # 構成（FullScreen 背景 + UserPage fill + Hero + Capabilities + footer）
        ├── Hero.tsx
        ├── Capabilities.tsx / capabilities.ts
        └── Backdrop.tsx          # CSS だけの背景（グラデーション + ドットグリッド）
```

- **縦スクロールなし**: `<UserPage fill>` でヘッダー下〜フッター上の残り高さちょうどに収めています。内容が収まらない小さな画面では内側の Flex だけがスクロールします（縦中央寄せは `justify-center` ではなく `my-auto`。溢れたときに上端が切れないため）。
- **背景は全画面**: `<FullScreen layer="background">` でビューポート全体に敷き、`UserPage` 側に `content-layer` を付けて前面に出しています。コンテナ幅に閉じ込めると境界が見えて平板になるため。
- `/demo` の gate（`APP_FEATURES.demo.samplePages`）が OFF のときは「デモを見る」ボタンを出しません。
- デモの一覧データは `src/app/(user)/demo/_data/demoPages.ts` が単一ソースです（`/demo` 一覧がカテゴリ別に描画）。デモを追加したらそこだけ更新してください。

## 下流プロジェクトでトップページを差し替える

ほぼ全ての下流がトップページを自前のものに置き換えます。上流の改修と衝突しないよう、次の手順で行ってください。

1. `src/app/(user)/_components/Home/`（名前は任意）に自前のトップページコンポーネントを作る
2. `src/app/(user)/page.tsx` の import 先を差し替える

```tsx
// src/app/(user)/page.tsx
export { Home as default } from "./_components/Home";
```

`metadata` や `dynamic` などページ設定が必要な場合も page.tsx に書いて構いません。
上流は page.tsx をこれ以上編集しないので、下流側の変更が merge で衝突することはありません。

### やってはいけないこと

- **`StarterHome/` を削除しない。** 上流がこのディレクトリを改修したとき、下流で削除済みだと modify/delete の merge コンフリクトになります。page.tsx から参照されなくなればバンドルには含まれないので、放置して問題ありません。
- **`StarterHome/` を編集して自前ページにしない。** 同じ理由で上流改修と衝突します。必ず別ディレクトリに作ってください。

## 上流（next-starter）側のルール

- `src/app/(user)/page.tsx` は編集しない。トップページの変更は `StarterHome/` 配下で完結させる。
- page.tsx に書きたくなる設定（`metadata` 等）が必要になったら、Next.js の仕様上 page.tsx でしか宣言できないものに限り、下流への影響を `.notices` で通知した上で行う。
