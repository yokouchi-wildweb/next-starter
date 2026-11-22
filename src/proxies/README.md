# src/proxies — リクエストの前処理（Next.js 16 proxy）

## Overview

`src/proxy.ts` がリクエストごとに文脈 `ctx` を 1 つ作り、`src/proxies/index.ts` の handler 列を順に実行する。各 handler は Response を返せば打ち切り（intercept）、何も返さなければ次へ進む。全部が素通しなら `NextResponse.next()` に decorator 列が副作用（cookie 等）を加える（打ち切ったときは decorator は走らない）。

proxy はドメインを値も型も読まない(D22・D30)。処理の項目は持ち主のドメインの plugs の点に置き、生成された一覧を門番(`gate.plugs`)で絞ってから使う(閉じたドメインの項目は走らない)。鎖の順は段の閉じた並び(宣言 `./extensionPoints.ts` の `stages`)で、項目は段を 1 つ選ぶ:

```
handler:   [段 maintenance] → [段 mode] → 骨組み featureGate(段 gate)→ 骨組み redirect(段 redirect)→ [段 main]
           上流の項目: setting の maintenance(段 maintenance)・demo の demoMode(段 mode)
decorator: 項目を <差す側>/<名前> の順に(上流: referral の inviteLink・userAcquisition の attribution。互いに依存しない)
```

## Usage

### 項目を足す(上流・fork とも自分のドメインに)

- handler: `<ドメイン>/plugs/proxyHandlers/<名前>.ts` に `export const handler: ProxyHandler` と `export const stage = "<段>"`(`maintenance` | `mode` | `main`。`gate`・`redirect` は骨組みだけ)
- decorator: `<ドメイン>/plugs/proxyDecorators/<名前>.ts` に `export const decorator: ProxyResponseDecorator`
- 転送の規則: `<ドメイン>/plugs/proxyRedirects/<名前>.ts` に `export const redirects: RedirectRuleGroup = [...]`(1 ファイル = 規則の 1 組。上流はサインアップの方式の規則 user の `plugs/proxyRedirects/signupMode.ts`)
- 置いたら `pnpm generate extensions` で一覧をコミット。fork は上流のドメインの中に足さず、自分のドメインに置く(項目のドメインが閉じれば項目も走らない)
- 古い置き場(`src/proxies/<名前>.ts` の handler / decorator・`src/proxies/redirects/`)は `pnpm generate extensions` が止める(段 3 の道具が動かす)

```ts
// src/domains/shop/plugs/proxyRedirects/campaign.ts(fork の例)
import type { RedirectRuleGroup } from "@/proxies/types";

export const redirects: RedirectRuleGroup = [
  { sourcePaths: ["/old-campaign"], destination: "/campaign", authedOnly: false },
];
```

### 利用者を読む(ctx.user)

```ts
import type { ProxyHandler } from "@/proxies/types";

export const stage = "main";
export const handler: ProxyHandler = async (request, ctx) => {
  const user = await ctx.user(); // ProxyUser | null(上流は auth の SessionUser)
};
```

## API

### 部品の置き場

| 部品 | 場所 | 誰が書く |
|---|---|---|
| 骨組み(門番の 404・転送) | `src/proxies/index.ts`・`featureGate.ts`・`redirect.ts` | 上流だけ(fork は編集しない) |
| 拡張点の宣言 | `src/proxies/extensionPoints.ts`(proxyUser・proxyHandlers・proxyDecorators・proxyRedirects の 4 点。機能を閉じる規則は門番 `src/featureGate/extensionPoints.ts`) | 上流だけ |
| 利用者の解き方 | 点 `proxyUser`(ちょうど 1 つ)の項目 `domains/core/auth/plugs/proxyUser/session.ts`(1 行スイッチ。既定 `session.default.ts`、fork は差替点 `authProxyUser` で `session.replace.ts` に替える) | 上流(既定)・fork(差し替え) |
| handler・decorator・転送の規則 | `<ドメイン>/plugs/proxyHandlers・proxyDecorators・proxyRedirects/<名前>.ts`(フォルダ形 `<名前>/index.ts` も可) | 各ドメイン(上流・fork) |
| 約束の型 | 型だけの入口 `src/proxies/points.ts`(D33、注文 37: 差す側の項目はここだけを型として読む。中身は `./types.ts` から出し直す。ProxyHandler・ProxyResponseDecorator・RedirectRule・ProxyUserPlug。利用者の型 ProxyUser・ProxyUserRole は点 proxyUser の項目の型から取り出す) | 上流だけ |
| 生成一覧 | `src/proxies/extensions/proxyUser.ts`・`proxyHandlers.ts`・`proxyDecorators.ts`・`proxyRedirects.ts` | `pnpm generate extensions`（手で編集しない。仕組み: `scripts/structure/extensions/README.md`） |
| 検査 | `pnpm check extensions`（build の冒頭）・`pnpm test scripts/structure/proxies/proxyFrame.test.mjs src/proxies/proxy.test.mts` | — |

### ctx.user()

- `ctx.user()` は**呼ばれたときだけ** 1 回解決し、同じリクエストの中では結果を使い回す（呼ぶ項目が無ければ DB を引かない）
- 解決器は点 `proxyUser` の項目(上流は `domains/core/auth` の `plugs/proxyUser/session.ts`、API の Factory・ページの守りと同じ `resolveSessionUser`、DB 同期)の `createUser`。`src/proxy.ts` だけが呼ぶ
- **利用可能な status（`USER_AVAILABLE_STATUSES`）の利用者だけ**非 null。停止中・休会中・未ログイン・DB 未構成は null（停止中の管理者・debugger はメンテナンス中に入れない）
- 項目（上流・fork）はセッションを自分で解かない: `getSessionUser`・`resolveSessionUser`・`parseSessionCookie`・`createProxyUser` などの値 import は lint `page-authz/session-api-callsite` が `src/proxies/**` と `<ドメイン>/plugs/proxyHandlers・proxyDecorators・proxyRedirects` で止める。token のクレームだけで判定する版は無い

## Extension

### 項目の決まり

- handler は選んだ段の中で `<差す側>/<名前>` の順に走る（Tier 順は使わない）。段は閉じた並び `maintenance → mode → gate → redirect → main` で、`gate`(門番の 404)・`redirect`(転送)は骨組みだけ。知らない段・骨組みの段・段の無い handler は `pnpm generate extensions` が止める(D30)。項目どうしは互いに依存しない（前の項目の結果を読まない）
- 名前に fork の印は付けない（旧い印は止めて移し方 = 共有の棚の印の移行の notice を案内する）。旧い印・名前の形の違い・export の無い項目・一覧のずれは `pnpm generate extensions` / `pnpm check extensions` が止める
- 印は字面で読む（`export const handler` / `export const decorator` / `export const stage = "<段>"` の形で書く。`export { x as handler }` は拾わない）。項目のファイルは生成器から import しない
- 判定の中身は責務のドメインのサービスを呼ぶ（項目のファイルに業務の判定を書き込まない）。項目の入切は各項目が config の値で持つ（多段での並べ替え・置き換えの口は無い）。項目はどのドメインの config も読んでよい。読んだ config から services・drizzle・server-only・node: に届くと門番の到達の検査（`pnpm test src/featureGate/checks/reachability.test.mjs`）が落とす(proxy は Next 16 では Node で動くが、毎リクエスト走る束を重くせず、DB・サービス・server-only に届かせないため)
- **転送された旧 URL（redirect が Response を返したリクエスト）では枠の項目は走らない**。骨組みが打ち切ったリクエストも同じ
- **点の項目か config か**: fork が互いに独立した行を足していく一覧（転送の規則）は点の項目、鍵で合わせて値を変える表は config（`src/config/README.md`）。同じ sourcePath が 2 つの規則にあると `redirect.ts` の読み込みで止まる(上流のサインアップの方式の規則 `/signup`・`/entry` も同じ表に入る)
- 項目も CLAUDE.md BACKENDS unconfigured の契約に従う（DB・Firebase が未構成でも落ちない。既存の判定 `isDatabaseConfigured` 等を使う）

## Internals

### 対象の住所(matcher)

`src/proxy.ts` の `export const config = { matcher }` で、proxy を走らせる住所を絞る。外した住所では proxy の関数そのものが呼ばれない(項目も decorator も走らず、DB も読まない)。

- 外すのは静的なファイルだけ: `/_next/static/`(ビルドの出力)・`/_next/image`(画像の最適化)・`/assets/`(public の素材。`utils/assets` の置き場)・`/favicon.ico`・`/robots.txt`・`/sitemap.xml`
- 拡張子つきの住所をまとめて外すことはしない。点を含むページや `/api` の住所まで門番とメンテナンスを素通りするため。public の直下に置いたほかのファイルは proxy を通る(`/assets/` の下に置けば外れる)
- matcher はビルド時に読むリテラルで、fork は変えない。外したい住所・通したい住所が要るなら上流へ依頼する
- 外した住所はメンテナンス中も見える(静的なファイルなので止める意味が無い)

### 失敗のとき

- `src/proxy.ts` の本体(項目・decorator)の throw は Next の onRequestError に届かないので、`proxy.ts` が受け止めてサーバーの失敗の記録(生成物 `@/wiring/serverErrorReport` の `report`、scope proxy。既定の 1 行 + fork の送り先、`src/lib/serverErrorReport/README.md`)へ渡して待ち、同じ失敗を投げ直す(応答は今までどおり Next の 500)
- 項目は自分で失敗を握りつぶさない(握りつぶすと記録に残らない)

### メンテナンスの判定を読む住所

setting の項目 `plugs/proxyHandlers/maintenance.ts`(段 maintenance)は、許可パス(設定ドメインの config の `maintenance.allowedPaths`・`allowedPrefixes`。既定で `/api`・`/_next`・`/login` など)では期間の判定(`settingService.isMaintenanceActive`)を読まずに通す。判定を読むのは `/maintenance`(期間の外で終了後の行き先へ送る)と許可外のパスだけ。判定が読むキー `maintenance` を設定ドメインの config の `codeValues` で持てば、判定でも DB を読まない(設定ドメインの README Extension「コードで持つキー」)。

### 機能を閉じる規則(Feature Gate)

規則・判定・検査は門番 `src/featureGate/` にある(詳細: [src/featureGate/README.md](../featureGate/README.md))。proxy の骨組みの項目 `featureGate.ts` は `gate.path(pathname)`(`@/featureGate`)を呼び、閉じていれば応答を作るだけ: `redirectTo` があればそこへ rewrite、無ければ API は 404、ページは `/404` へ rewrite。

## Related

- 門番: [src/featureGate/README.md](../featureGate/README.md)
- 受け口の仕組み: `scripts/structure/extensions/README.md`
- 設定の置き方: `src/config/README.md`
