# backends — 口(port)の実装の部品

## Overview

- 外部のサービスを使う口(メール・認証・配信など)の実装が共通に持つ形の型と部品。入口は 3 つ
  - `@/lib/backends`(client でも server でも読める): 型・組み込みの none・予約名・差し替え口の作り手
  - `@/lib/backends/node`: 契約テストの関数(読み手はテストと道具だけ)
  - `@/lib/backends/points`: 増設点 `backendCapabilities` の項目の型だけ
- 実装 1 つ = 選ぶ点の項目 `<持ち主>/plugs/<点>/<名前>.ts` に、字面だけの `export const declaration`(`BackendDeclaration`)と本体 `export const adapter`(`isConfigured` を持つ)。項目の宣言は生成器と検査が構文木で読み、実行しない
- 選択表を書く・見るのは命令 `pnpm workflow backend-selection fill | set | show`(`scripts/workflow/backend-selection/README.md`)
- 実装は選ぶ点(plugs の点に `select`)の項目で、根の選択表 `backend-selection.json` が口ごとに 1 つを選ぶ。生成器が選んだ 1 項目の `adapter` だけを `<持ち主>/extensions/<点>.ts` に re-export し、食い違いは生成と検査が止める(宣言・止める所: `scripts/structure/extensions/README.md`「選ぶ点」)
- 使う時の決まりは札 .claude/rules/items/lib/backends.md にある

## Usage

### none(使わない口)

```ts
import { createNoneAdapter } from "@/lib/backends";

export const adapter = createNoneAdapter<MailAdapter>("mail");
adapter.isConfigured(); // { configured: false, missing: [] }
await adapter.send(input); // BackendNoneSelectedError を投げる
```

### 口の持ち主の差し替え口(fake を入れる)

```ts
import { createBackendOverride } from "@/lib/backends";

const slot = createBackendOverride<MailAdapter>(() => selectedAdapter);
export const getMailAdapter = slot.get;
/** テスト用。null で既定に戻す */
export const setMailAdapterOverride = slot.set;
```

### 起動時の知らせ(生成物が使う)

選ぶ点の持ち主は公開の入口から口の状態 `<点>BackendStatus`(型 `BackendStatus` = `{ port, selected, isConfigured }`、送れる adapter は出さない)を出す。
生成物 `src/wiring/startup.ts` の起動時の一覧に、選ぶ点ごとに 1 行(`pnpm generate extensions` が書く。項目のファイルは無い、D49):

```ts
// 持ち主の側(例 src/lib/mail/backendStatus.ts、公開の入口 @/lib/mail が出す)
export const mailBackendStatus: BackendStatus = { port: "mail", selected, isConfigured: () => adapter.isConfigured() };

// 生成物 src/wiring/startup.ts の行の load
async () => {
  const { createBackendStatusTask } = await import("@/lib/backends");
  const { mailBackendStatus } = await import("@/lib/mail");
  return createBackendStatusTask(mailBackendStatus);
};
// 起動ごとに 1 行: {"scope":"backends","port":"mail","selected":"resend","level":"warn","configured":false,"missing":["RESEND_API_KEY"]}
```

### 契約テスト

```ts
import { defineBackendContract } from "@/lib/backends/node";

export const mailContract = defineBackendContract<MailAdapter, { apiKey: string }>("mail", [
  { name: "未設定なら configured: false", run: (adapter) => { /* … */ } },
  { name: "本物に送れる", needsCredentials: true, run: async (adapter, { credentials }) => { /* … */ } },
]);

// 各実装・fake のテストから
const report = await mailContract.run(fakeMailAdapter);
// report.results = [{ name, status: "pass" | "fail" | "skipped", reason? }]
```

## API

- `BackendDeclaration` = `{ provides: CapabilityName[], requires: CapabilityName[], billing: BillingScale[], env: { required: string[], optional?: string[] }, requiresFeatures?: FeatureName[] }`(字面だけ。`env` は名前だけで、手引きと報告用。`requiresFeatures` = この実装を選んだときに開いていなければならない機能の名前(門番の規則の名前)、省略 = 無い。閉・知らない名前・開閉が読めなければ選択表の検査が止める)
- `FeatureName` = 機能の名前の字面の型(`string`)。lib/backends は門番もドメインも読まない(照らすのは `scripts/structure/extensions/select.mjs`)
- `CapabilityName` = `"<口>.<語>"`。語は口の持ち主の選ぶ点の宣言と増設点 `backendCapabilities` が持つ
- `BillingScale` = `{ kind: "none" | "fixed" | "mau" | "perRecipient" | "egress" | "usage", unit?, priceKey? }`。`"usage"` は `unit` が必須(message・request・gbMonth・sms 等)、`priceKey` は単価の表の行の鍵。`"none"` は配列の中で単独だけ
- `BackendAdapter` = `{ isConfigured(): IsConfiguredResult }`(同期、通信しない、SDK を初期化しない)。口ごとの操作は口の持ち主の型が広げる
- `BackendStatus` = `{ port, selected, isConfigured() }`: 口の状態。選ぶ点の持ち主が公開の入口から `<点>BackendStatus` として出す(起動時の知らせと道具が読む、送れる adapter は持たない、D49)
- `IsConfiguredResult` = `{ configured: true }` | `{ configured: false, missing: string[] }`(足りない env・設定の名前、値は持たない)
- `BackendCompat` = `{ from: "env", name, map, default }` | `{ from: "fixed", value }`(選ぶ点の宣言に書く、今の設定の読み方。口を足す移行の道具が読む)
- `BackendRequirements` = `CapabilityName[]`(業務コードが要る能力。ドメインが字面で宣言する)
- `BackendCapabilityItem` = `{ port, words }`(増設点 `backendCapabilities` の項目)
- `createNoneAdapter<A>(port, { side? })` → `A`: `isConfigured` は `{ configured: false, missing: [] }`、ほかのどの操作も呼べば `BackendNoneSelectedError`
- `BackendNoneSelectedError(port, side?)`: `BackendNotConfiguredError`(`@/lib/errors`)の子。`port` = 口、`implementation` = `"none"`、`missing` = `[]`、`side` 既定 `"server"`。API では routeFactory が 501 + `code: "backend_not_selected"` に写す(口の名前は応答に出ない)
- `NONE_IMPLEMENTATION`(`"none"`)・`FAKE_IMPLEMENTATION`(`"fake"`)・`RESERVED_IMPLEMENTATION_NAMES`(両方)・`UNSELECTABLE_IMPLEMENTATION_NAMES`(`"fake"`): 予約の実装の名前
- `backendPrices`(`BackendPriceRow[]`、`prices.ts`): 単価の表。行 = `{ priceKey, unit, currency, amount, source, checkedAt }`、鍵は `priceKey`(課金の目盛りの `priceKey` が指す)。上流だけが書き、fork は読むだけ。今は行が無い
- `createBackendStatusTask(status: BackendStatus, { write? })`(status = 持ち主の公開の入口の `<点>BackendStatus`) → `{ name: "backends.<口>", runtime: "nodejs", run }`(起動時の処理の項目の形、`@/lib/startup` は読まない): `run` は 1 行の JSON `{ scope: "backends", port, selected, level, configured, missing? | none? | error? }` を書く(既定 `console.info`)
  - 揃っている = info / 足りない = warn と `missing`(名前だけ)/ `"none"` を選んだ口 = info と `none: true`(`isConfigured` を呼ばない)/ `isConfigured` が投げた = warn と `error`(誤りの名前だけ)。`run` も書き手も投げない
- `createBackendOverride<A>(createDefault)` → `{ get(), set(adapter | null) }`: 差し替えていればそれ、無ければ既定(初回に作って使い回す)。`set(null)` で既定に戻す
- `defineBackendContract<A, C>(port, cases)` → `{ port, cases, run(adapter, { credentials? }) }`(`./node`): 件 = `{ name, needsCredentials?, run(adapter, { credentials }) }`。`run` は投げず `{ port, results }` を返す。資格の要る件は資格が無ければ `skipped`(`reason: "no credentials"`)、投げた件は `fail`(`reason` = 誤りの文)

## Extension

- 増設点 `backendCapabilities`(change add): 差す側の `<ドメイン か lib>/plugs/backendCapabilities/<名前>.ts` に `export const capabilities = { port: "<口>", words: ["<語>", …] }`(字面だけ、値の import をしない)
  - 上流の語は口の持ち主の項目、フォークの語は自分の lib の項目。上流が後で同じ語を足せばぶつかりで止まり、フォークが改名する
  - 一覧は生成物 `src/wiring/backends.ts`(`pnpm generate extensions`)。実行時に読む所は無い

## Internals

- none の adapter は Proxy: `isConfigured` 以外の鍵は呼べば投げる関数を返す。`then` と symbol の鍵は `undefined`(`await` やログ出力で暗黙に参照されても投げない)
- 起動時の知らせの項目は選ぶ点の持ち主の中の生成物(持ち主の生成物 `extensions/<点>` を相対で読む)。lib は wiring を読めず、ほかの持ち主の生成物を読めない(閉じた lib の tsconfig)ので、一覧でなく口ごとの項目にした
- 入口 `.` は `@/lib/errors` だけを読み、node の API を読まない(client の束に入ってよい)。契約テストは `./node` に分ける
