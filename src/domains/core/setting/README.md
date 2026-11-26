# Setting ドメイン

## Overview

- 管理者が稼働中に画面から変える値を持つコアドメイン。デプロイで決まる値・コードが構造として依存する値は config(`src/config/`)
- 使う時・直す時の決まりは札 .claude/rules/items/domains/setting.md にある。この README は使い方と仕組み
- **1 行 + jsonb 1 列**: `settings` 表の `id: "global"` の 1 行の `extended` に、保存したキーだけを持つ
- **1 キー = 1 ファイル**: 点 `settingFields` のキーと `settingSections` のセクション(差す側の `<ドメイン>/plugs/settingFields/`・`plugs/settingSections/`)から、一覧を生成する(`extensions/`、編集不可)。キーとセクションの表は `definitions.ts`(門番で絞らない: 保存された値のキーの定義)
- **キーの置き場はリポごとに 1 つ**: 既定は管理画面 + DB。config の `codeValues` に書いたキーはコードの値(Extension「コードで持つキー」)
- **画面は route**: フォームは route の `_screen/` にある。core の setting は hook・型・保存処理だけ
- 画面: `src/app/admin/(protected)/settings/[section]/_screen/`(`EditSettingSectionForm`)、`src/app/admin/setup/_screen/`(`AdminSetupForm`)

## Usage

### 読む

```ts
import { settingService } from "@/domains/core/setting/services/server/settingService";

const setting = await settingService.getGlobalSetting();
const { maintenance } = await settingService.readSettingKeys(["maintenance"]); // { enabled, startAt, endAt }
const inMaintenance = await settingService.isMaintenanceActive();
```

- 全キーの読みは `getGlobalSetting`、必要なキーだけの読みは `readSettingKeys`
- コードで持つキー(Extension「コードで持つキー」)は、どの読みでもコードの値が返る。`readSettingKeys` は頼んだキーが全部コードで持つキーなら DB を読まない
- DB の読みはインスタンスごとに短い時間覚える(Internals「読みのメモ」)

| 読み手 | 使うもの | 返るキー |
|--------|----------|----------|
| サーバー内部 | `settingService` | 全部 |
| 管理画面 | `useSetting` / `getSettingForActor(user)` | そのロールに許されたキー |
| 誰でも | `usePublicSetting` / `getPublicSetting()` | `public: true` のキー |

### 保存する

```ts
const { trigger } = useUpdateSetting();
await trigger({ id: "global", data: { adminListPerPage: 50 } });

await settingService.updateFields({ adminListPerPage: 50 }); // サーバー内部(権限を見ない)
await saveSettingAsActor(user, { adminListPerPage: 50 }); // 主体のロールの権限を見る
```

- 一覧に無いキーを送ると 400、検証の失敗も 400
- コードで持つキーを送ると 409(保存しても読まれないため)
- 配列は連結せず置き換える(キー単位で重ねる)
- `create`・`upsert`・`delete` は 405。行を作るのは初回セットアップだけ
- 注意: 旧版へ戻した間に保存すると、旧版の知らないキーの値が消える

### 管理画面の編集フォームと初期セットアップ(公開 hook、client)

既定の `_screen` 部品(`/admin/settings/[section]` の `EditSettingSectionForm`、`/admin/setup` の `AdminSetupForm`)は次の hook を呼んで描くだけ。見た目を変える fork は自分の Screen の client 部品から同じ hook を呼ぶ(form と送信を写さない)。

| hook | 引数 | 戻り値 |
| --- | --- | --- |
| `useSettingSectionForm({ sectionKey, setting, redirectPath?, codeKeys? })` | `sectionKey: string`(節の key)/ `setting: Setting`(そのロールに許されたキーだけの今の値)/ `redirectPath?: string`(保存の後の遷移先、既定 `"/"`)/ `codeKeys?: readonly string[]`(コードで持つキー。loader の値) | `{ methods, section, fieldConfigs, submit, isMutating, editable }` |
| `useAdminSetup({ redirectTo? })` | `redirectTo?: string`(既定 `ADMIN_SETUP_REDIRECT_PATH` = `"/admin/login"`) | `{ trigger, submit, isMutating, error }` |

- `useSettingSectionForm`: 欄は節のキーの定義(`setting/fields` の `ui`)から作り(`buildSectionForm`)、`useForm`(zodResolver)まで持つ。部品は `methods` を `AppForm` に、`fieldConfigs` と `section.groups` を `FieldRenderer` に渡す。`submit` を `AppForm` の `onSubmit` に渡す: 更新中の toast → 保存 → 成功の toast → `redirectPath` へ遷移。コードで持つキーの欄は読み取り専用で説明つき、送らない。`editable` = 送るキーがあるか(無ければ保存のボタンを出さない)
- `useAdminSetup`: `submit(values)` = 送信 → 成功の toast → `redirectTo` へ遷移(初期設定の form の `customSubmit.handler` に渡す)。`trigger` は送信だけ
- 失敗(両方): error の toast を出して投げ直す(src/lib/unsavedGuard/README.md「Usage」)
- この組み立てで足りない画面は、route の `_components/` に Screen を作って組み立てる

### メンテナンス画面の自動遷移

`useMaintenanceAutoRedirect({ endTime, redirectTo }): void`(公開 hook、client)。`endTime` = 終了時刻(ISO8601、`maintenance.endAt` を /maintenance の loader が渡す。`null` = 遷移しない)、`redirectTo` = 終了時の遷移先。終了時刻に `router.replace(redirectTo)`、過ぎていれば即時、unmount で timer を解く。既定の `_screen/MaintenanceAutoRedirect` はこれを呼ぶだけ。

### メンテナンスで止まる物と確かめ方

キー `maintenance` の期間(`settingService.isMaintenanceActive()`)に止まる物。どれも同じ判定を読み、管理者・debugger(`canBypassMaintenance`、config の `maintenance.bypassRoles`)は通る。

| 経路 | 止め方 | 通す宣言 |
|---|---|---|
| 画面の移動 | proxy の項目(`plugs/proxyHandlers/maintenance.ts`)が `/maintenance` へ送る。`/api` などの許可パスは通す | config の `maintenance.allowedPaths` / `allowedPrefixes` |
| API の書き込み(`POST`・`PUT`・`PATCH`・`DELETE`) | API ルートの Factory が 503 + `code: "maintenance"`。`GET` は通る | ルートの `maintenance: "pass"`(`src/lib/routeFactory/README.md`「メンテナンス中の書き込みの停止」) |
| 定期タスク(Vercel Cron・`pnpm task --due`) | 本体を呼ばずに skipped(`reason: "maintenance"`)。名前指定の `pnpm task <name>` は走る | `task.ts` の `maintenance: "pass"`(`src/lib/cron/README.md` Internals「メンテナンス」) |

期間に入れてから、書き込みが本当に止まったかを確かめる:

1. 待つ: 設定の読みのメモ `readMemoMs`(既定 10 秒)+ 動いている要求の最長の時間(長い route は `maxDuration` まで)。ほかのインスタンスは最大でこの間、前の値を読む(Internals「読みのメモ」)。キーを `codeValues` で持つ場合は、その値の配備が行き渡った時が切り替わり
2. 状態: `GET /api/health` の `maintenance.active` が `true`(管理者でない閲覧で `bypassed: false`)
3. API: 管理者でない利用者(またはログアウト中)で書き込みの操作をすると 503 + `code: "maintenance"`(画面には「メンテナンス中」の文言が出る)
4. 定期タスク: ログ(`scope: "cron"` / `scope: "task-cli"`)の各タスクに `skipped: true, reason: "maintenance"` が出る
5. DB: `pnpm ops db inspect query "SQL"` で書き込みの多い表の最新の行(`max(created_at)` / `max(updated_at)` や件数)を時間をおいて 2 回読み、動いていない。動いているなら、`maintenance: "pass"` のルート・タスク(決済の完了の通知など、止めない経路)か管理者の操作かを確かめる

## API

### ルート

| メソッド | パス | access | 説明 |
|----------|------|--------|------|
| GET | `/api/setting/public` | public | `public: true` のキーの値 |
| GET | `/api/setting/admin` | 管理カテゴリ | そのロールに許されたキーの値 |
| PATCH | `/api/setting/admin` | 管理カテゴリ | 許されたキーの保存(`{ data }`) |
| POST | `/api/setting/setup` | public | 初期セットアップ |

汎用 `/api/setting` は閉じている(`INTERNAL_ONLY`、管理データの export だけ管理者)。主体を渡せず、キーごとの権限が効かないため。

### 権限

キーの権限は次の順で決まる: キーの `allowRoles` → 所属セクションの `allowRoles` → どちらも無ければ管理カテゴリの全ロール。

- セクションの `allowRoles`: メニューの表示と画面を開けるロール
- 許されないキーは欄を出さず、管理者向けの読みでも返さない
- 許されないキーを 1 つでも送ると 403 で全部拒否する(一部だけ保存しない)
- フォームは開いているセクションのキーだけを送る

### 初期セットアップ (`POST /api/setting/setup`) のセキュリティモデル

- 未認証(`access: "public"`)だが ワンショット: `initializeAdminSetup` が冒頭で `checkAdminUserExists()` を確認し、管理者が 1 人でも存在すれば 409 で拒否する(fail-closed、画面側の redirect は UI 補助にすぎない)
- `role` はクライアント入力を無視して `admin` 固定(セットアップ UI にロール選択は存在しない)
- 設定の行を作るだけで、既定値は書かない
- レート制限 `adminSetup`(同一 IP 1 時間 10 回、`src/domains/core/rateLimit/config.ts`)。レスポンスは `{ success: true }` のみで、作成したユーザー行は返さない
- 既知の受容リスク: 管理者が 1 人もいない間は、このルートを最初に叩いた人が管理者になる(デプロイ直後にセットアップを済ませる運用が前提)
- 既知の受容リスク: 存在チェックと作成が同一トランザクションでないため、初回セットアップ完了前のみ同時リクエストによる複数管理者作成の競合窓が理論上ある。セットアップ時点では実運用開始前のためリスク受容(`settingService.ts` の `initializeAdminSetup` のコメント)

## Extension

### キーを足す

自分のドメインの `plugs/settingFields/<キー>.ts` を置き、`pnpm generate extensions` を実行する。ファイル名がキーの名前になる(全体で一意。上流も fork も同じ形。名前に fork の印は付けない)。DB の変更は要らない。

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
- 値 import が React・`server-only`・DB・サービスを推移的に辿ると生成で失敗する
- 同じ名前のキー・無いセクションを指すキーは生成で失敗する
- 欄の説明文: `ui.field` に `helperText` を書くと、設定画面の枠がラベルの下に描く(組み込みの入力も、`frame: true` の登録部品も同じ)
- 独自の入力部品の欄: 部品を自分のドメインか lib の `plugs/formInputs/<名前>.ts` に登録し、欄の `ui.field` に `formInput: "<登録名>"` と書く(書き方: `src/lib/formSuite/README.md` Extension)。欄の定義は名前だけなので値 import の決まりに当たらない

### セクションを足す

自分のドメインの `plugs/settingSections/<名前>.ts`(上流も fork も同じ形)を置き、`pnpm generate extensions` を実行する。管理メニューと `/admin/settings/<key>` は一覧から作られる。

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

属性は `key`・`label`・`order`・`icon`・`allowRoles`・`description`・`groups`・`feature`。キーは欄の側に `ui.section` で所属を書く。同じ `key` のセクションは生成で失敗する。

- `feature`(省略可、規則名の配列も可): その機能が 1 つでも閉じている間、`/admin/settings/<key>` が門番で閉じる(管理メニューの行が消え、直接開くと 404、`/admin/settings` は次の開いた節へ)。生成器が節を字面で読み規則の住所に足す(`src/featureGate/API.md`「規則の書き方」)。規則名でない値は生成で失敗する
- 閉じた節のキーの値と `/api/setting` の読み書きは変わらない(隠すだけ)

### 部分を持つキー

片方だけ変えると意味が壊れる値(入切とその期間など)は、部分を持つ 1 つのキーにする(別々のキーにしない)。

- `schema` を `z.object({ ... }).default({})` にし、`ui.parts` に部分ごとの欄(`order`・`field`)を書く。設定画面は部分ごとに `<キー>.<部分>` の欄を並べる(`ui.field` と `ui.parts` はどちらか一方)
- 例: `plugs/settingFields/maintenance.ts`(`{ enabled, startAt, endAt }`)
- 保存済みの別々のキーを 1 つにまとめるときは、移す task を付け、notice で「取り込んだら先に回す」と案内する(例: `pnpm task setting:merge-maintenance-keys`、Internals)

### コードで持つキー

キーの置き場はリポごとに 1 つ。既定は管理画面 + DB で、config の `codeValues`(上書き: `src/config/domains/setting.config.ts`)に書いたキーはコードの値になる。ほかの切り替えは無い。

- 書いたキーはどの読みでもコードの値(DB を読まない)。proxy・`/api/health`・`/maintenance` の loader が読むキーをコードで持てば、判定で DB に触らない(眠る DB を起こさない)
- 管理画面はそのキーの欄だけ読み取り専用(説明つき)。同じ節のほかの欄は保存できる。節の欄が全部コードなら保存のボタンを出さない
- 保存は 409(`save.ts` の `assertNotCodeValues`)。DB に前の値が残っていても読まない
- 値はキーの定義(Zod)で検証する。定義に無いキー・合わない値は読み込みで止まる。部分を持つキーの書かない部分はキーの既定値、日時は ISO8601 の文字列で書ける
- fork が足したキーにも同じ書き方が効く

```ts
// src/config/domains/setting.config.ts
export default {
  codeValues: {
    maintenance: { enabled: true, startAt: "2026-12-01T02:00:00+09:00", endAt: "2026-12-01T04:00:00+09:00" },
  },
} satisfies SettingOverride;
```

### 親の Tier のキー・セクションを変える

上の Tier のファイルは書き換えず、隣の `<名前>.override.ts` に `export const override` を置く。fork のファイルは、下の Tier が直接書き換える。

- キー: `ui`・`public`・`default`・`allowRoles`(型と検証は変えられない)
- セクション: `label`・`order`・`icon`・`allowRoles`・`description`・`groups`
- 権限の検査: 上書きを重ねた後のキーの実効の権限(キーの `allowRoles` → 所属セクションの `allowRoles` → どちらも無ければ管理カテゴリ全員)が、重ねる前の中に収まること。外のロール・空の配列・`allowRoles: undefined` で絞りを外す・絞りの無いセクションへ `ui` で移す、のどれも `pnpm check extensions` が止める。セクションの上書きの `allowRoles` も同じ。`groups` は画面の中の並びだけで権限に入らない。検査: `scripts/structure/extensions/derive/settingRoles.mjs`

## Internals

- 読み: キーごとに検証する。保存値が今の定義に合わないキーだけ既定値を返し、サーバーログに警告する。保存値は書き換えない
- 行が無い・DB 未構成なら既定値。接続できないときは例外のまま(障害を隠さない)
- 保存: `save.ts` が送ったキーだけを検証して jsonb に重ね、同じ 1 本の文で一覧に無いキーを取り除く(残りが 0 なら `{}`)
- `adminListPerPage` の既定値はキーの定義の 1 か所で 100
- コードで持つキー: `services/server/codeValues.ts` が読み込み時に 1 回 `utils/codeValues.ts` の `resolveCodeValues` で検証する。`settingService` の読みがその値を重ね、`save.ts` の `assertNotCodeValues` が保存を止め、設定画面の loader が `codeKeys` を渡す
- メンテナンスの期間の判定は `utils/maintenanceWindow.ts` の `isMaintenanceWindowActive`(読み先が DB でもコードでも同じ)

### 読みのメモ

- `settingService` の DB の読み(`global` の 1 行)を、インスタンスのメモリに config の `readMemoMs`(既定 10 秒、0 = 毎回読む)の間覚える(`services/server/readMemo.ts`)。同時の読みは 1 本にまとめ、失敗は覚えない
- 保存(`updateFields`・初回セットアップ)はそのインスタンスのメモを捨てる。ほかのインスタンスは最大で `readMemoMs` だけ古い値を読む(管理画面でメンテナンスを入れても、ほかのインスタンスでは最大その長さ遅れる)。Vercel では proxy と API が別のインスタンスで動くことがある
- API の書き込みの停止と定期タスクの飛ばしも同じ判定を読むので、同じだけ遅れる(Usage「メンテナンスで止まる物と確かめ方」)
- メモは問い合わせの回数を減らすだけで、DB を眠らせはしない。DB を眠らせたい読み(proxy の判定など)はキーを `codeValues` で持つ
- cacheComponents 専用の API(`use cache`・`cacheTag`)は使わない

### 3 キーのメンテナンスから 1 つのキーへの移行

`pnpm task setting:merge-maintenance-keys`: 保存値の `maintenanceEnabled`・`maintenanceStartAt`・`maintenanceEndAt` を `maintenance` にまとめ、古いキーを消し、残りが 0 か確かめる(`remaining: 0`)。`maintenance` が既にある行は古いキーを消すだけ。冪等。

### 実列 admin_list_per_page から jsonb への移行

旧版の書き込みを止める → `pnpm task setting:copy-list-per-page`(写せなかった行 `missing` が残れば打ち直せる失敗 = exit 1 で止まる。`kept` = 保存済みの値を残した行)→ `pnpm db:push` → `pnpm db:push:check`(差分 0)。task より先に push すると列の値が失われる。task は冪等で、列が無ければ何もしない。

## Verification

- `pnpm test src/domains/core/setting/services/server/settingStorage.test.ts src/domains/core/setting/scripts/migrations/copy-list-per-page.test.ts`(読み・保存・権限・フォーム)
- `pnpm test src/domains/core/setting/hooks/`(メンテナンスの自動遷移・フォームの hook。`adminFormHooks.test.tsx`)
- `pnpm test src/domains/core/setting/utils/codeValues.test.ts`(コードで持つキーの検証・保存の拒否・期間の判定・読みのメモ)
- `pnpm test src/domains/core/setting/scripts/migrations/merge-maintenance-keys.test.ts`(移す task の SQL)
- `pnpm check extensions`(生成物の一致)
