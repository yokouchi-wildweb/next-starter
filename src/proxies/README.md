# src/proxies — リクエストの前処理（Next.js 16 proxy）

`src/proxy.ts` がリクエストごとに文脈 `ctx` を 1 つ作り、`src/proxies/index.ts` の handler 列を順に実行する。各 handler は Response を返せば打ち切り（intercept）、何も返さなければ次へ進む。全部が素通しなら `NextResponse.next()` に decorator 列が副作用（cookie 等）を加える（打ち切ったときは decorator は走らない）。

## 骨組みと枠

```
handler:   maintenance → demoMode → featureGate → redirect → [枠: 項目をファイル名の順に]
decorator: attribution → inviteLink → [枠: 項目をファイル名の順に]
```

| 部品 | 場所 | 誰が書く |
|---|---|---|
| 骨組み（順序に意味がある上流の 4 + 2） | `src/proxies/index.ts`・各 `<名前>.ts` | 上流だけ（fork は index.ts を編集しない） |
| 枠の項目 | `src/proxies/<名前>.ts`（上流も fork も印なし）。フォルダ形 `<名前>/index.ts` も可 | 1 項目 1 つ `export const handler` か `export const decorator` |
| 拡張点の宣言 | `src/proxies/extensionPoints.ts`（handlers・decorators の 2 点。機能を閉じる規則は門番 `src/featureGate/extensionPoints.ts`） | 上流だけ |
| 生成一覧 | `src/proxies/extensions/handlers.ts`・`decorators.ts` | `pnpm generate extensions`（手で編集しない。仕組み: `scripts/structure/extensions/README.md`） |
| 検査 | `pnpm check extensions`（build の冒頭）・`pnpm test scripts/structure/proxies/proxyFrame.test.mjs` | — |

- 項目は骨組みの**後ろ**で、ファイル名の順に走る（Tier 順は使わない）。項目どうしは互いに依存しない（前の項目の結果を読まない）。骨組みより前で走らせたい項目は作らない（要るなら上流へ依頼し、骨組みに吸収する）
- 名前に fork の印は付けない（旧い印は止めて移し方 = 共有の棚の印の移行の notice を案内する。上流と同じ単位名は `pnpm workflow ownership check` の unit-clash）。旧い印・`handler` と `decorator` の両方・どちらも無い直下の `.ts`・名前の形の違い・一覧のずれは `pnpm generate extensions` / `pnpm check extensions` が止める
- 印は字面で読む（`export const handler` / `export const decorator` / `export const rule` の形で書く。`export { x as handler }` は拾わない）。項目のファイルは生成器から import しない
- 判定の中身は責務のドメインのサービスを呼ぶ（項目のファイルに業務の判定を書き込まない）。項目の入切は各項目が config の値で持つ（多段での並べ替え・置き換えの口は無い）
- **転送された旧 URL（redirect が Response を返したリクエスト）では枠の項目は走らない**。骨組みが打ち切ったリクエストも同じ
- 項目も UNCONFIGURED_BACKENDS の契約に従う（DB・Firebase が未構成でも落ちない。既存の判定 `isDatabaseConfigured` 等を使う）

## 利用者（ctx.user）

```ts
import type { ProxyHandler } from "./types";

export const handler: ProxyHandler = async (request, ctx) => {
  const user = await ctx.user(); // SessionUser | null
};
```

- `ctx.user()` は**呼ばれたときだけ** 1 回解決し、同じリクエストの中では結果を使い回す（呼ぶ項目が無ければ DB を引かない）
- 解決器は `features/core/auth` の `createProxyUser`（API の Factory・ページの守りと同じ `resolveSessionUser`、DB 同期）。`src/proxy.ts` だけが作る
- **利用可能な status（`USER_AVAILABLE_STATUSES`）の利用者だけ**非 null。停止中・休会中・未ログイン・DB 未構成は null（停止中の管理者・debugger はメンテナンス中に入れない）
- 項目（上流・fork）はセッションを自分で解かない: `getSessionUser`・`resolveSessionUser`・`parseSessionCookie`・`createProxyUser` などの値 import は lint `page-authz/session-api-callsite` が `src/proxies/**` で止める。token のクレームだけで判定する版は無い

## 機能を閉じる規則（Feature Gate）

規則・判定・検査は門番 `src/featureGate/` にある(詳細: [src/featureGate/README.md](../featureGate/README.md))。proxy の骨組みの項目 `featureGate.ts` は `gate.path(pathname)`(`@/featureGate`)を呼び、閉じていれば応答を作るだけ: `redirectTo` があればそこへ rewrite、無ければ API は 404、ページは `/404` へ rewrite。

### fork での使い方(proxy の項目)

- fork の handler・decorator: `src/proxies/<名前>.ts`(上流の項目と違う名前。同じ単位名は `pnpm workflow ownership check` の unit-clash)に置き、`pnpm generate extensions` で一覧をコミット
