# screens — API

## Overview

screens の README の API を分けた文書(README が 20,000 字を超えるため)。page 層の契約と、Screen・範囲(guard.ts)・loader・セクションコンテナの書き方。全体の形は `README.md`、仕組みは `Internals.md`。

## API

### 契約（公開 API）と変更規則

| 契約 | 内容 | 根拠 |
|---|---|---|
| A. Screen の入口 | `_screen/<Name>Screen.tsx` のファイル名と named export `<Name>Screen`、受け取る props（`ScreenProps`） | page.tsx が下流所有になった瞬間、上流は変えられない |
| B. loader | `_screen/loader.ts` の `load<Name>Screen(props)` の名前・引数・返り値型・redirect / notFound 条件。入力型 `<Name>ScreenParams` / `<Name>ScreenSearchParams` と返り値型 `<Name>ScreenData` は loader が定義して export する | 下流の Screen が直接呼ぶ。型の所有者が契約の所有者 |
| C. hook | `features/<domain>/hooks/` の export | 下流のセクションコンテナが直接呼ぶ |
| D. セクションコンテナのトップレベル props | 例: `WalletBalance` の `slug / phoneVerifiedAt / currentPhoneNumber` | 下流の Screen が既定のセクションコンテナを描く |

契約外: 部品の props とファイル配置、Screen の中身、セクションコンテナの内部構造。

変更規則:
- **追加**（新 loader / 新 hook / 返り値や props のフィールド追加 / optional 引数の追加）は自由
- **改名**: 旧名を再 export として残す。削除は `.notices` で移行手順と対象ステップを通知し、通知後の次ステップ以降にのみ行う
- **非互換変更**（引数・返り値・必須 props）: 旧契約は残し、新名で追加する。旧を消す場合は改名と同じ手順
- **挙動変更**（loader の redirect 先・notFound 条件）: `.notices` に明記
- loader の固定の行き先（redirect 先・既定の戻り先）は loader の中の名前付きの定数に置き、export しない。fork が変える口（config・引数）は持たない: 別の行き先が要る fork は同じ guard.ts の `createLoader` で自分の loader を書き、差し替え Screen から呼ぶ（需要が来たら値の設定 1 か所で受ける）
- **セクションコンテナの子構成変更**（部品の追加・削除・並び替え）: 契約外だが、複製した fork が追随判断できるよう informational な `.notices` に含める
- loader の仕様（ルート・返り値・redirect 条件・使う hook）はファイル先頭のコメントに書く。一覧 README は作らない

### 範囲（guard.ts）と loader の書き方

ページの認可は 2 か所に置く: **範囲**（layout の隣の `guard.ts`、配下の全ページに掛かる方針）と、**ページ**（loader の `access`）。どちらも同じ評価器で判定し、loader は両方を通ったときだけ取得する。仕組みと方針のキーは [`src/lib/pageGuard/README.md`](../pageGuard/README.md)。

#### 範囲（guard.ts）

```ts
// src/app/guard.ts(root。全ページを覆う)
import "server-only";
import { defineRootGuard } from "@/wiring/pageGuard";
export const { guard, createLoader, extend } = defineRootGuard({ access: "public" });

// src/app/(user)/(protected)/guard.ts(子。最寄りの親の extend で作る = 親子 AND、狭めるだけ)
import "server-only";
import { extend as extendRoot } from "@/app/guard";
export const { guard, createLoader, extend } = extendRoot({
  access: { roleCategories: ["admin", "user"] },
  redirectTo: "/login",
  forbiddenRedirectTo: "/login",
  returnBack: true,
  statusRedirects: { inactive: "/reactivate", suspended: "/restricted" },
});
```

- 置き場は範囲の layout.tsx の隣。export は `guard` / `createLoader` / `extend` の 3 つだけ（方針の値は外へ出さない）。方針は字面のオブジェクトで書く（ルート地図が読む。変数・スプレッドは生成失敗）
- layout は `await guard()` の 1 行だけでセッションに触れる（利用者は返らない。表示用の利用者は client の `useAuthSession`）。public でない guard.ts の隣の layout が `guard()` を呼ばない、または layout が旧ガード（`authGuard` 等）を呼ぶと地図の生成が失敗する
- 上流の guard.ts は編集しない。fork が範囲を狭めたいときは、その下に子の guard.ts を置いて親の `extend` で作る（広げることはできない）

#### loader

```ts
// src/app/(user)/(protected)/wallet/[slug]/_screen/loader.ts
import "server-only";
import { notFound } from "next/navigation";
import type { ScreenProps } from "@/lib/screens/types";
import { requireUserRecord } from "@/features/core/user/services/server/userService";
import { createLoader } from "@/app/(user)/(protected)/guard";

/** URL の形。Screen も同じ型を import して署名に使う */
export type WalletBalanceScreenParams = { slug: string };

/** 画面が必要とする最小のデータ。明示的に組み立てる(Pick は実行時に余分なフィールドを落とさない) */
export type WalletBalanceScreenData = { slug: string; label: string; phoneNumber: string | null };

/** 未知の slug は notFound。既定 Screen も下流 Screen も generateMetadata もこれを呼ぶ */
export const loadWalletBalanceScreen = createLoader({
  access: "authenticated",
  // cache のキー: props から取り出したプリミティブ(Next は page と generateMetadata に別の props を渡すため)
  key: async (props: ScreenProps<WalletBalanceScreenParams>): Promise<[string]> => [(await props.params).slug],
  load: async ({ user }, slug): Promise<WalletBalanceScreenData> => {
    const config = getCurrencyConfigBySlug(slug);
    if (!config) notFound();
    const record = await requireUserRecord(user, "/login");
    return { slug, label: config.label, phoneNumber: record.phoneNumber };
  },
});
```

- 作り方は**最寄りの guard.ts の `createLoader`** だけ（ページの dir から上へ最初の guard.ts。ルート地図が確かめる）。`access` は必須で `public` / `authenticated` / `{ roles, roleCategories }` / `none`（`custom` は無い）。範囲の方針とページの `access` を取得前に評価し、拒否なら `load` を呼ばない（未認証 → 範囲の `redirectTo`、権限不足 → `forbiddenRedirectTo`、行き先が無い・`none` → notFound）
- データの無い Screen にも access だけの loader を置く（`load: async (): Promise<void> => {}`）。地図の鎖は loader を通って範囲に届く
- `key(props)` は params / searchParams から cache のキーのプリミティブを取り出す（データは取らない）。返り値の型は `Promise<[...]>` で明示する。キーの要らない loader は `key` を省く（呼び出しは `loadXScreen(props)`）
- 主体は `load({ user, allows }, ...key)` の `user`（DB 同期の利用者、リクエスト内 1 回）。`access: "public"` では Cookie があり利用可能な status のときだけ非 null。利用できない status の利用者を案内するページ（`/restricted`・`/reactivate`）は `allowStatuses` にその status を書く。本人の列（email・電話番号等）が要るなら `requireUserRecord(user, redirectTo)`（`@/features/core/user/services/server/userService`）
- `allows(rule)` は別の access を同じ利用者で評価する（取得前の追加の判定。例: 管理画面の関連先ごとの list の access、設定のセクション単位のロール）
- セッション・ガード API（`getSessionUser`・`getTokenOnlySession` 等）は loader でも import しない（lint `page-authz/session-api-callsite`、全 Tier error）。ページ層でセッションを読むのは guard.ts の作り手だけ
- **DTO 型は loader が所有する**: 返り値型 `<Name>ScreenData`、入力型 `<Name>ScreenParams` / `<Name>ScreenSearchParams` は loader で定義して export し、Screen も部品も loader から `import type` する（`./loader` / `../_screen/loader`。client 部品から server-only モジュールを `import type` するのはコンパイル時に消えるので問題ない）。**loader は `_components/` や Screen から import しない**（型だけでも不可。契約の返り値型を契約外の部品が決める逆転になる）。`checkLoaderFile` が検査する
- 置き場は**そのルートの `_screen/loader.ts`**（ファイル名固定、1 ルート 1 loader）。Screen からは `./loader` で import する。どのドメインにも置かない（複数ドメインを組み合わせるページも、redirect だけのページも同じ）
- 入力は Next の page props（`params` / `searchParams` の Promise）。`searchParams` は未解釈のまま `key` で受けて検証する。optional catch-all は `ScreenProps<{ status?: string[] }>`
- `redirect` / `notFound` は loader の責務。結果型を返す方式は Screen が処理を忘れると fail-open になるため採らない。**Screen 側で loader を try/catch しない**
- 許容する副作用は画面遷移制御のみ。業務上の更新処理は入れない。データはドメインのサービス経由で取る（loader は DB を値 import しない: `@/lib/drizzle`・`drizzle-orm`・`entities/drizzle` の表。lint `page-authz` ）
- `import "server-only"` 必須（client component から import するとビルドで止まる）
- 所有権や存在の秘匿（他人のリクエストは 404）は主体を取った後の判定として `notFound()` で行う
- 新しいパスリテラルを増やさない。既存の定数・設定に寄せる
- 複数ルートで共通する判定はドメインの `utils/` に置き、各ルートの loader が呼ぶ。多数のルートが同じ取得を使う場合（管理画面、Internals.md「生成される管理画面ルート（pnpm generate domain）」）は取得本体をドメインに置き、各ルートの loader.ts が組を渡す 1 行にする

### Screen の書き方

```tsx
// src/app/(user)/(protected)/wallet/[slug]/_screen/WalletBalanceScreen.tsx
import { loadWalletBalanceScreen, type WalletBalanceScreenParams } from "./loader";

export async function WalletBalanceScreen(props: ScreenProps<WalletBalanceScreenParams>) {
  const data = await loadWalletBalanceScreen(props);
  return (
    <UserPage containerType="narrowStack">
      <Stack gap="lg">
        <UserPageTitle>{data.label}管理</UserPageTitle>
        <WalletBalance slug={data.slug} phoneVerifiedAt={data.phoneVerifiedAt} currentPhoneNumber={data.phoneNumber} />
      </Stack>
    </UserPage>
  );
}
```

```tsx
// src/app/(user)/(protected)/wallet/[slug]/page.tsx(出荷時)
export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
```

- Next は default export に page props をそのまま渡すので、re-export で `params` / `searchParams` が Screen に届く
- **Screen は Server Component**。`"use client"` は付けない（テストが弾く）。hook や状態が必要な部分は client のセクションコンテナか `_screen/` の client 部品に下ろし、Screen はそれを描くだけにする
- グループごとに形が違う: `mypage` 配下は layout が `UserPage` + `Stack` + `PageTransition` を巻くので Screen は fragment を返す。`wallet` は Screen が `UserPage` を持つ
- **Screen は同じルートの loader を import し、本体の最上位（最初の `return` より前）で `await` する**（データの無い Screen も access だけの loader を await する）。条件分岐・try・コールバックの中や JSX の中で呼ばない。`pnpm test src/lib/screens/screens.test.mjs` とルート地図（Internals.md「ルート地図（`src/app/route-map.jsonl`）」）が同じ解析で検査する。差し替え Screen（`_components/`）は `../_screen/loader` か自分の `./loader`（`_components/loader.ts`）を呼ぶ
- Screen はサーバーのデータを自分で取らない（services/server・DB の値 import は lint `page-authz/layout-no-server-data` が止める）。表示用の利用者は client の `useAuthSession`（root の `AuthSessionProvider`）
- 差し替えは「同じルート内」が基本条件（範囲の guard.ts と root の Provider を前提にする）
- `metadata` は Screen 側に書いて page.tsx から `export { XScreen as default, metadata } from "./_screen/XScreen"` と re-export してもよい（`generateMetadata` / `viewport` も同様）。`dynamic` 等のセグメント設定は Next が静的解析するため page.tsx 自体に書く

### セクションコンテナの条件（契約 D）

- Screen が import するのはコンテナ自体（`<Name>/index.tsx` または `<Name>.tsx`）。内側の `<Name>/<Part>` は部品なので Screen から読まない（`pnpm test src/lib/screens/screens.test.mjs` の `checkScreenImports` が検査）。判定 = `index.tsx` を持つディレクトリがコンテナで、import 先の途中にあれば違反。`index.tsx` を持たないディレクトリ（`Admin/` `Mobile/` `common/` などのグループ分け、`index.ts` だけの barrel）は名前空間として通す。上流の配置は平たい `components/<Name>` + 共有部品は `common/`（慣習）
  - fork が `components/Admin/<Name>` のようにグループ分けするのは自由
- 内部の部品 import は絶対パス（`@/features/core/wallet/components/WalletBalance/BalanceCard`）。`index.tsx` から部品を barrel export する。下流が `index.tsx` を複製しても import を触らずに動く
- `index.tsx` が `"use client"` のとき、barrel 経由の部品は client 境界になる（Server Component から使いたい部品は部品ファイルを直接 import する）
- `"use client"` のファイルからは関数（コンポーネント・hook）だけを export する。定数やオブジェクトを Screen・loader（server）から import すると client reference になり undefined で届く（型検査も lint も通る。例: スラッグ表が undefined で常に `notFound()`）。server と共有する値は `"use client"` の無い中立ファイルに置く
- client service の直叩きは hook に昇格する
- 初回描画に見えるデータを loader が取るときは、任意の `initial<Name>` props で受け取り hook の `fallbackData` に流す（must-read 「契約（公開 API）と変更規則」）。props が無ければ hook が取る
- `"use client"` の位置はセクションコンテナ以下（または `_screen/` の client 部品）。`server-only` な loader を呼ぶのは Screen だけ

---
