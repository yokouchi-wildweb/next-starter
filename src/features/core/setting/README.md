# Setting ドメイン

管理者が稼働中に画面から変える値を持つコアドメイン。

- **1 行 + jsonb 1 列**: `settings` 表の `id: "global"` の 1 行の `extended` に、保存したキーだけを持つ。既定値は書かない
- **1 キー = 1 ファイル**: `fields/` のキーと `sections/` のセクションから、一覧を生成する(`extensions/`、編集不可)
- **画面は route**: フォームは route の `_screen/` にある。core の setting は hook・型・保存処理だけ

## setting と config の境界

- 管理者が稼働中に画面から変える値 = setting(既定はコード)
- デプロイで決まる値・コードが構造として依存する値 = config(`src/config/`)
- 同じ値を両方に置かない。setting の既定値が config を読むのは可、逆は不可

## ディレクトリ構造

```
src/features/core/setting/
├── extensionPoints.ts        # 拡張点 fields・sections の宣言
├── fields/<キー>.ts          # 1 キーの定義
├── sections/<名前>.ts        # 1 セクションの定義
├── extensions/               # 生成された一覧(pnpm extensions:generate)
├── types/definition.ts       # キーとセクションの型
├── menu.ts                   # 管理メニューの項目を作る
├── utils/sectionForm.ts      # セクションの並びとフォームの組み立て
├── entities/                 # 表の定義と型(Setting・SettingValues)
├── hooks/                    # useSetting・useUpdateSetting・usePublicSetting・useAdminSetup
└── services/
    ├── client/               # settingClient・adminSetupClient
    └── server/
        ├── settingService.ts # 読み・保存の入口(proxy からも読まれる)
        ├── settingActor.ts   # 管理者向けの読み書き・公開の読み
        ├── access.ts         # キーごとの権限の解決
        ├── read.ts           # 保存値をキーごとに検証して読む
        └── save.ts           # 唯一の書き手
```

画面: `src/app/admin/(protected)/settings/[section]/_screen/`(`EditSettingSectionForm`)、`src/app/admin/setup/_screen/`(`AdminSetupForm`)。

## キーを足す

`fields/<キー>.ts` を置き、`pnpm extensions:generate` を実行する。ファイル名がキーの名前になる。fork は `fields/<キー>.<fork の名前>.ts`。DB の変更は要らない。

```ts
import { z } from "zod";

import type { SettingFieldDefinition } from "../types/definition";

export const field = {
  schema: z.coerce.number().int().min(1).max(500).default(100),
  public: false,
  ui: { section: "general", order: 10, field: { label: "一覧表示件数", formInput: "numberInput" } },
} satisfies SettingFieldDefinition;
```

- `schema`: 型・検証・既定値。`.default(` が無いと生成で失敗する
- `public`: `true` で公開の窓口に出す(既定 `false`)
- `allowRoles`: 書き込みと管理者向けの読みを許すロール
- `ui`: 設定画面の欄(`section`・`group`・`order`・`field`)。無いキーは設定画面に出ず、使う画面の側が管理者向けの窓口で保存する
- 値 import の先は `zod`・`@/config`・純関数・型だけ。React・`server-only`・DB・サービスを推移的に辿ると生成で失敗する(proxy と client の両方から読むため)
- 同じ名前のキー・無いセクションを指すキーは生成で失敗する

独自の入力部品の欄は、フォームの入力部品の登録の口(`formInput: "<登録名>"`)ができるまで作れない。

## セクションを足す

`sections/<名前>.ts`(fork は `sections/<名前>.<fork の名前>.ts`)を置き、`pnpm extensions:generate` を実行する。管理メニューと `/admin/settings/<key>` は一覧から作られる。

```ts
import { Sliders } from "lucide-react";

import type { SettingSectionDefinition } from "../types/definition";

export const section: SettingSectionDefinition = {
  key: "general",
  label: "基本設定",
  order: 10,
  icon: Sliders,
};
```

属性は `key`・`label`・`order`・`icon`・`allowRoles`・`description`・`groups`。キーは欄の側に `ui.section` で所属を書く。同じ `key` のセクションは生成で失敗する。

この組み立てで足りない画面は、route の `_components/` に Screen とフォームを複製して組み立てる。

## 親の Tier のキー・セクションを変える

上流のファイル(ドット名なし)は書き換えない。隣の `<名前>.override.ts` に `export const override` を置く。

- キー: `ui`・`public`・`default`・`allowRoles`(型と検証は変えられない)
- セクション: `label`・`order`・`icon`・`allowRoles`・`description`・`groups`

fork のファイルは、下の Tier が直接書き換える。

## 読む

```ts
import { settingService } from "@/features/core/setting/services/server/settingService";

const setting = await settingService.getGlobalSetting();
const { maintenanceEnabled } = await settingService.readSettingKeys(["maintenanceEnabled"]);
const inMaintenance = await settingService.isMaintenanceActive();
```

- 全キーの読みは `getGlobalSetting`、必要なキーだけの読みは `readSettingKeys`(proxy・health・maintenance loader はこちら)
- キーごとに検証する。保存値が今の定義に合わないキーだけ既定値を返し、サーバーログに警告する。保存値は書き換えない
- 行が無い・DB 未構成なら既定値。接続できないときは例外のまま(障害を隠さない)

| 読み手 | 使うもの | 返るキー |
|--------|----------|----------|
| サーバー内部 | `settingService` | 全部 |
| 管理画面 | `useSetting` / `getSettingForActor(user)` | そのロールに許されたキー |
| 誰でも | `usePublicSetting` / `getPublicSetting()` | `public: true` のキー |

公開するのは保存値だけ。計算した値(交換レート等)は持ち主のドメインの route と hook に置く。

## 保存する

```ts
const { trigger } = useUpdateSetting();
await trigger({ id: "global", data: { maintenanceEnabled: true } });

await settingService.updateFields({ maintenanceEnabled: true }); // サーバー内部(権限を見ない)
await saveSettingAsActor(user, { maintenanceEnabled: true }); // 主体のロールの権限を見る
```

- 書き手は `save.ts` だけ。送ったキーだけを検証して jsonb に重ね、同じ 1 本の文で一覧に無いキーを取り除く(残りが 0 なら `{}`)
- 一覧に無いキーを送ると 400、検証の失敗も 400
- 配列は連結せず置き換える(キー単位で重ねる)
- `create`・`upsert`・`remove` は 405。行を作るのは初回セットアップだけ
- 注意: 旧版へ戻した間に保存すると、旧版の知らないキーの値が消える

## 権限

キーの権限は次の順で決まる: キーの `allowRoles` → 所属セクションの `allowRoles` → どちらも無ければ管理カテゴリの全ロール。

- セクションの `allowRoles`: メニューの表示と画面を開けるロール
- 許されないキーは欄を出さず、管理者向けの読みでも返さない
- 許されないキーを 1 つでも送ると 403 で全部拒否する(一部だけ保存しない)
- フォームは開いているセクションのキーだけを送る

## API

| メソッド | パス | access | 説明 |
|----------|------|--------|------|
| GET | `/api/setting/public` | public | `public: true` のキーの値 |
| GET | `/api/setting/admin` | 管理カテゴリ | そのロールに許されたキーの値 |
| PATCH | `/api/setting/admin` | 管理カテゴリ | 許されたキーの保存(`{ data }`) |
| POST | `/api/setting/setup` | public | 初期セットアップ |

汎用 `/api/setting` は閉じている(`INTERNAL_ONLY`、管理データの export だけ管理者)。主体を渡せず、キーごとの権限が効かないため。

### 初期セットアップ (`POST /api/setting/setup`) のセキュリティモデル

- 未認証(`access: "public"`)だが **ワンショット**: `initializeAdminSetup` が冒頭で `checkAdminUserExists()` を確認し、管理者が 1 人でも存在すれば 409 で拒否する(fail-closed、画面側の redirect は UI 補助にすぎない)
- `role` はクライアント入力を無視して `admin` 固定(セットアップ UI にロール選択は存在しない)
- 設定の行を作るだけで、既定値は書かない
- レート制限 `adminSetup`(同一 IP 1 時間 10 回、`src/config/app/rate-limit.config.ts`)。レスポンスは `{ success: true }` のみで、作成したユーザー行は返さない
- 既知の受容リスク: 管理者が 1 人もいない間は、このルートを最初に叩いた人が管理者になる(デプロイ直後にセットアップを済ませる運用が前提)
- 既知の受容リスク: 存在チェックと作成が同一トランザクションでないため、初回セットアップ完了前のみ同時リクエストによる複数管理者作成の競合窓が理論上ある。セットアップ時点では実運用開始前のためリスク受容とし、advisory lock 等での厳密化は意図的に見送っている(判断根拠は `settingService.ts` の `initializeAdminSetup` コメント参照)

## 実列 admin_list_per_page から jsonb への移行

順番を変えない: 旧版の書き込みを止める → `pnpm task setting-copy-list-per-page`(`mismatched: 0` を確かめる)→ `pnpm db:push` → `pnpm db:push:check`(差分 0)。task より先に push すると列の値が失われる。task は冪等で、列が無ければ何もしない。

`adminListPerPage` の既定値はキーの定義の 1 か所で 100。

## テスト

`pnpm test:setting`(読み・保存・権限・フォーム)、`pnpm extensions:check`(生成物の一致)。
