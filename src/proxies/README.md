# src/proxies — リクエストの前処理（Next.js 16 proxy）

## Overview

`src/proxy.ts` がリクエストごとに文脈 `ctx` を 1 つ作り、`src/proxies/index.ts` の handler 列を順に実行する。各 handler は Response を返せば打ち切り（intercept）、何も返さなければ次へ進む。全部が素通しなら `NextResponse.next()` に decorator 列が副作用（cookie 等）を加える（打ち切ったときは decorator は走らない）。

```
handler:   maintenance → demoMode → featureGate → redirect → [枠: 項目をファイル名の順に]
decorator: attribution → inviteLink → [枠: 項目をファイル名の順に]
```

## Usage

### fork の項目を足す

- fork の handler・decorator: `src/proxies/<名前>.ts`(上流の項目と違う名前。同じ単位名は `pnpm workflow ownership check` の unit-clash)に置き、`pnpm generate extensions` で一覧をコミット

### 利用者を読む(ctx.user)

```ts
import type { ProxyHandler } from "./types";

export const handler: ProxyHandler = async (request, ctx) => {
  const user = await ctx.user(); // SessionUser | null
};
```

## API

### 部品の置き場

| 部品 | 場所 | 誰が書く |
|---|---|---|
| 骨組み（順序に意味がある上流の 4 + 2） | `src/proxies/index.ts`・各 `<名前>.ts` | 上流だけ（fork は index.ts を編集しない） |
| 枠の項目 | `src/proxies/<名前>.ts`（上流も fork も印なし）。フォルダ形 `<名前>/index.ts` も可 | 1 項目 1 つ `export const handler` か `export const decorator` |
| 拡張点の宣言 | `src/proxies/extensionPoints.ts`（handlers・decorators・redirects の 3 点。機能を閉じる規則は門番 `src/featureGate/extensionPoints.ts`） | 上流だけ |
| 転送の規則 | `src/proxies/redirects/<名前>.ts`（1 ファイル = 規則の 1 組、`export const redirects: RedirectRuleGroup`。上流の項目は 0。読み手は `redirect.ts`、同じ sourcePath の重複は読み込みで止まる） | fork |
| テーマの設定 | `src/proxies/<テーマ>/config.ts`（上流は値を持つテーマを持たない。デモモードの値は demo ドメインの設定。fork が足すテーマの上書きは `src/config/proxies/<テーマ>.config.ts`） | 上流(既定)・fork(上書き) |
| 生成一覧 | `src/proxies/extensions/handlers.ts`・`decorators.ts`・`redirects.ts` | `pnpm generate extensions`（手で編集しない。仕組み: `scripts/structure/extensions/README.md`） |
| 検査 | `pnpm check extensions`（build の冒頭）・`pnpm test scripts/structure/proxies/proxyFrame.test.mjs` | — |

### ctx.user()

- `ctx.user()` は**呼ばれたときだけ** 1 回解決し、同じリクエストの中では結果を使い回す（呼ぶ項目が無ければ DB を引かない）
- 解決器は `domains/core/auth` の `createProxyUser`（API の Factory・ページの守りと同じ `resolveSessionUser`、DB 同期）。`src/proxy.ts` だけが作る
- **利用可能な status（`USER_AVAILABLE_STATUSES`）の利用者だけ**非 null。停止中・休会中・未ログイン・DB 未構成は null（停止中の管理者・debugger はメンテナンス中に入れない）
- 項目（上流・fork）はセッションを自分で解かない: `getSessionUser`・`resolveSessionUser`・`parseSessionCookie`・`createProxyUser` などの値 import は lint `page-authz/session-api-callsite` が `src/proxies/**` で止める。token のクレームだけで判定する版は無い

## Extension

### 項目の決まり

- 項目は骨組みの**後ろ**で、ファイル名の順に走る（Tier 順は使わない）。項目どうしは互いに依存しない（前の項目の結果を読まない）。骨組みより前で走らせたい項目は作らない（要るなら上流へ依頼し、骨組みに吸収する）
- 名前に fork の印は付けない（旧い印は止めて移し方 = 共有の棚の印の移行の notice を案内する。上流と同じ単位名は `pnpm workflow ownership check` の unit-clash）。旧い印・`handler` と `decorator` の両方・どちらも無い直下の `.ts`・名前の形の違い・一覧のずれは `pnpm generate extensions` / `pnpm check extensions` が止める
- 印は字面で読む（`export const handler` / `export const decorator` / `export const rule` の形で書く。`export { x as handler }` は拾わない）。項目のファイルは生成器から import しない
- 判定の中身は責務のドメインのサービスを呼ぶ（項目のファイルに業務の判定を書き込まない）。項目の入切は各項目が config の値で持つ（多段での並べ替え・置き換えの口は無い）。項目はどのドメインの config も読んでよい。読んだ config から services・drizzle・server-only・node: に届くと門番の到達の検査（`pnpm test src/featureGate/checks/reachability.test.mjs`）が落とす(proxy は Next 16 では Node で動くが、毎リクエスト走る束を重くせず、DB・サービス・server-only に届かせないため)
- **転送された旧 URL（redirect が Response を返したリクエスト）では枠の項目は走らない**。骨組みが打ち切ったリクエストも同じ
- **受け口か config か**: fork が互いに独立した行を足していく一覧（転送の規則）は受け口、鍵で合わせて値を変える表は config（`src/config/README.md`）
- 項目も CLAUDE.md BACKENDS unconfigured の契約に従う（DB・Firebase が未構成でも落ちない。既存の判定 `isDatabaseConfigured` 等を使う）

## Internals

### 対象の住所(matcher)

`src/proxy.ts` の `export const config = { matcher }` で、proxy を走らせる住所を絞る。外した住所では proxy の関数そのものが呼ばれない(項目も decorator も走らず、DB も読まない)。

- 外すのは静的なファイルだけ: `/_next/static/`(ビルドの出力)・`/_next/image`(画像の最適化)・`/assets/`(public の素材。`utils/assets` の置き場)・`/favicon.ico`・`/robots.txt`・`/sitemap.xml`
- 拡張子つきの住所をまとめて外すことはしない。点を含むページや `/api` の住所まで門番とメンテナンスを素通りするため。public の直下に置いたほかのファイルは proxy を通る(`/assets/` の下に置けば外れる)
- matcher はビルド時に読むリテラルで、fork は変えない。外したい住所・通したい住所が要るなら上流へ依頼する
- 外した住所はメンテナンス中も見える(静的なファイルなので止める意味が無い)

### 失敗のとき

- `src/proxy.ts` の本体(項目・decorator)の throw は Next の onRequestError に届かないので、`proxy.ts` が受け止めてサーバーの失敗の記録(`@/wiring/serverErrors` の `report`、scope proxy。既定の 1 行 + fork の送り先、`src/wiring/serverErrors/README.md`)へ渡して待ち、同じ失敗を投げ直す(応答は今までどおり Next の 500)
- 項目は自分で失敗を握りつぶさない(握りつぶすと記録に残らない)

### メンテナンスの判定を読む住所

骨組みの `maintenance.ts` は、許可パス(設定ドメインの config の `maintenance.allowedPaths`・`allowedPrefixes`。既定で `/api`・`/_next`・`/login` など)では期間の判定(`settingService.isMaintenanceActive`)を読まずに通す。判定を読むのは `/maintenance`(期間の外で終了後の行き先へ送る)と許可外のパスだけ。判定が読むキー `maintenance` を設定ドメインの config の `codeValues` で持てば、判定でも DB を読まない(設定ドメインの README Extension「コードで持つキー」)。

### 機能を閉じる規則(Feature Gate)

規則・判定・検査は門番 `src/featureGate/` にある(詳細: [src/featureGate/README.md](../featureGate/README.md))。proxy の骨組みの項目 `featureGate.ts` は `gate.path(pathname)`(`@/featureGate`)を呼び、閉じていれば応答を作るだけ: `redirectTo` があればそこへ rewrite、無ければ API は 404、ページは `/404` へ rewrite。

## Related

- 門番: [src/featureGate/README.md](../featureGate/README.md)
- 受け口の仕組み: `scripts/structure/extensions/README.md`
- 設定の置き方: `src/config/README.md`
