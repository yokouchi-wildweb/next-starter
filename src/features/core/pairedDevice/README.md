# pairedDevice — 登録端末（共有端末のペアリングと端末トークン認証）

店舗に置くタブレットやキオスクなどの共有端末を、**ユーザーアカウントとは別の認証主体**として登録し、
長期の端末トークン（httpOnly Cookie）で動かす。誰の個人ログインにも頼らずに、
「店舗 A のスタッフ用タブレット」「3 番テーブルの客用端末」として API を呼べるようになる。

- 端末がどの店舗・テーブルのものかは、サーバーが端末の `scope` から決める（クライアントが送る id は信用しない）
- 失効・scope の付け替えは DB を毎回引くので、次のリクエストから効く
- 端末の Cookie はユーザーセッションと別。端末で `/api/me/**` やユーザー向けのルートは通らない
- 監査ログには actor `device`（actorId = 端末 id）で残る
- core にはドメイン画面を置かない。ペアリング画面・管理画面は downstream が下記のパーツで組み立てる

## 有効化（オプトイン、既定は無効）

1. `src/config/app/paired-device.config.ts` の `enabled` を `true` にする
2. `pnpm db:push`（`paired_devices` / `device_pairings` が作られる。無効の間は作られない）
3. 端末の種類を `kinds/<名前>.<fork の名前>.ts` に置き `pnpm extensions:generate`（下記）

無効の間は feature-gate が `/api/paired-device/**` `/api/paired-devices/**` を 404 にし、
`getSessionDevice` は Cookie を読まずに常に null を返す。

## 端末の種類（kind）を登録する

`kind` と `scope` の語彙・形は downstream が決める。アップストリームは scope の中身を解釈せず、
`scopeSchema` で検証するだけ。登録されていない kind の端末は作れず、認証にも失敗する（fail-closed）。

```ts
// src/features/core/pairedDevice/kinds/tableTerminal.<fork の名前>.ts(1 種類 1 ファイル)
import { z } from "zod";
import { definePairedDeviceKind } from "@/features/core/pairedDevice/types/kind";

export const kind = definePairedDeviceKind({
  kind: "table_terminal", // paired_devices.kind の値
  label: "テーブル端末",
  scopeSchema: z.object({ storeId: z.string().uuid(), tableId: z.string().min(1) }),
  // 店長は自分の店舗の端末だけ管理できる（省略時は admin カテゴリのロールだけ）
  manageableScopes: async (user) =>
    (await storeStaffService.managedStoreIds(user.userId)).map((storeId) => ({ storeId })),
  // 店舗の回線からのアクセスだけ通す（任意）
  verify: ({ ip, scope }) => storeNetworkService.isStoreIp(scope.storeId, ip),
  // 客用端末は 30 日アクセスがなければ無効にする（任意。既定は config の値）
  idleRevokeDays: 30,
  // キーボードのない客用端末なので、端末から始めるペアリング（B）も許可する（既定は A だけ）
  pairingFlows: ["admin_issued", "device_initiated"],
});
```

`kind` の文字列は一覧の型に残り、`PairedDeviceKind`・`PairedDeviceScopeOf`（`types/kinds.ts`）が導かれる。

| 項目 | 意味 |
|---|---|
| `scopeSchema` | scope の形。登録・変更時と、端末の認証のたびに検証する（合わなくなった端末は認証に失敗する） |
| `manageableScopes(user)` | そのユーザーが管理（登録・変更・失効・ペアリング）できる範囲。`"all"` か、scope の部分オブジェクトの配列（JSONB の `@>` と同じ包含判定）。**一覧の絞り込みと 1 件ごとの権限判定の両方がこの 1 つから決まる**。admin カテゴリは常に `"all"` |
| `verify(ctx)` | 認証のたびに実行する追加検証。false か例外で認証失敗 |
| `pairingFlows` | 許可するペアリング方式。既定は `["admin_issued"]`。端末から始める方式（B）は、攻撃者が自分の端末に出したコードを管理者に承認させる誘導が成り立つので、使う kind だけ `"device_initiated"` を足す |
| `tokenMaxAgeDays` | 端末トークンの有効期間（既定 400 日。主要ブラウザの Cookie 上限。0 以下・400 超は無視される） |
| `idleRevokeDays` | 最後のサーバーへの要求（ページ表示を含む）からこの日数で無効にする（`null` = 無効化しない） |

登録すると `kinds` の指定に型が付き、ハンドラの `device.scope` も kind ごとの型になる（未登録の kind はコンパイルエラー）。

## 端末を主体にするルート・ページ

### API: `createDeviceRoute`

```ts
// src/app/api/terminal/lending/route.ts
import { createDeviceRoute } from "@/wiring/apiRoute";

export const POST = createDeviceRoute(
  {
    operation: "POST /api/terminal/lending",
    operationType: "write",
    kinds: ["table_terminal"],
    rateLimit: "apiGeneral", // 端末 id 単位（店内の端末は同じ IP なので IP 単位にしない）
  },
  async (req, { device }) => {
    // 店舗・テーブルは device.scope から取る。body の tableId は使わない
    return lendingService.request({ storeId: device.scope.storeId, tableId: device.scope.tableId });
  },
);
```

- Cookie なし・失効・期限切れ → 401、kind 違い → 403（いずれも `{ message, reason }`）
- 端末として通った応答では、エラーや 429 を含めて毎回 Cookie の期限を DB に合わせて書き直す（残りが短ければ延長もする）
- デモユーザーの書き込みスキップ（`skipForDemo`）は `orUser` のユーザーとして通ったときだけ効く（端末はデモ扱いしない）
- **端末またはスタッフ本人**のどちらでも通す API は `orUser` を付け、`ctx.principal` で分岐する

```ts
export const GET = createDeviceRoute(
  {
    operation: "GET /api/store/tables",
    operationType: "read",
    kinds: ["staff_tablet"],
    orUser: { roleCategories: ["admin"] }, // または "authenticated" / { roles: [...] }
  },
  async (req, ctx) => {
    const storeId =
      ctx.principal === "device" ? ctx.device.scope.storeId : await resolveStoreForUser(ctx.user.userId);
    return tableService.listByStore(storeId);
  },
);
```

`ctx.operator` は将来の「共有端末で操作者（スタッフ）を PIN で選ぶ」機能の予約枠で、現在は常に null。

### ページ: `deviceGuard` / `requireCurrentDevice`

```ts
// src/app/terminal/layout.tsx（layout で守る）
import { deviceGuard } from "@/features/core/pairedDevice/services/server/session";

export default async function TerminalLayout({ children }: { children: React.ReactNode }) {
  await deviceGuard({ kinds: ["table_terminal"], redirectTo: "/device-pair" });
  return children;
}

// src/app/terminal/_screen/loader.ts（loader で端末を取る）
const device = await requireCurrentDevice({
  kinds: ["table_terminal"],
  behavior: "redirect",
  redirectTo: "/device-pair", // layout と同じ値
});
```

- `redirectTo` を省くと 404（端末向けページの存在を明かさない）
- 端末向けページはユーザーの `(protected)` グループの外に置く（ユーザーのログインを要求しないため）
- Server Component からは Cookie を書けないので、ページ表示では期限を延ばさない（DB と Cookie の期限をずらさないため）。
  延長は Cookie を書ける API 応答（`createDeviceRoute` のルート・`GET /api/paired-device/session`）で行う。
  **API を呼ばない表示専用の端末には heartbeat を置く**:

  ```tsx
  // 端末ページのどこか（"use client" の part）。1 日 1 回程度で十分（期限は 400 日、残り 30 日で延長）
  useSessionDevice({ refreshInterval: 6 * 60 * 60 * 1000 });
  ```
- 任意の場所で端末を取りたいときは `getSessionDevice()`（無ければ null）

### ページ: 端末またはユーザー（`principalGuard` / `requireCurrentPrincipal`）

共有タブレットとスタッフ本人のスマホの両方から開くページ（店舗のスタッフ画面・POS 等）。
API の `createDeviceRoute`（`kinds` + `orUser`）と同じ語彙で、端末を先に判定し、端末でなければユーザーをルールで判定する。

この 2 つはセッションを自分で読む（「サービスはセッションを読まない」の例外）。業務の処理ではなく主体を解くこと自体が役目のページ側の守りで、`getSessionDevice` と同じ層にある。

```ts
// src/app/store/(protected)/layout.tsx
import { principalGuard } from "@/features/core/pairedDevice/services/server/session";

await principalGuard({
  kinds: ["staff_tablet"],
  orUser: { roles: ["staff"] },         // "authenticated" / { roles?, roleCategories?, allowStatuses? }
  redirectTo: "/store/login",          // 省略時は 404
});

// src/app/store/(protected)/tables/_screen/loader.ts
const principal = await requireCurrentPrincipal({
  kinds: ["staff_tablet"],
  orUser: { roles: ["staff"] },
  behavior: "redirect",
  redirectTo: "/store/login",          // layout と同じ値
});
const storeId =
  principal.principal === "device" ? principal.device.scope.storeId : await resolveStaffStore(principal.user.userId);
```

- 同じリクエストで layout と loader が同じルールで呼んでも、判定は 1 回にまとまる
- ユーザーのステータスは `allowStatuses`（省略時は利用可能なステータスだけ）で、ページの守り（guard.ts / createLoader）と同じ語彙
- 端末だけなら `deviceGuard`、ユーザーだけならページの守り（範囲の guard.ts と loader の createLoader）を使う

## scope が古くなった端末を止める（一括失効）

scope の中身（店舗・テーブル等）は downstream のデータなので、テーブルの削除や別店舗への移動があっても端末はそのまま認証し続ける。
`verify` で毎回 DB を引くと、短い間隔でポーリングする端末では負荷が増える。downstream の削除・移動の処理の中で止める:

```ts
import { listPairedDevicesByScope, revokePairedDevicesByScope } from "@/features/core/pairedDevice/services/server";

await db.transaction(async (tx) => {
  await tableService.remove(tableId, tx);
  // 同じトランザクションで、そのテーブルの端末を失効させる（削除がロールバックされれば失効も戻る）
  await revokePairedDevicesByScope(
    { kind: "table_terminal", scope: { tableId }, reason: "テーブルの削除" },
    { actor: "system", tx },
  );
});

// 確認画面で対象を見せる（ページングなし）
const targets = await listPairedDevicesByScope({ scope: { storeId } }, { actor: user });
```

- scope は部分一致（JSONB の `@>`）。キーを 1 つ以上持ち、値に `undefined` などを含まないこと（`{}` は 400。全件の失効はできない）
- `actor` がユーザーなら、対象の全端末を管理できなければ 403 で何も失効させない。`"system"` は判定を省く
- 1 台ずつ `paired_device.device.revoked`（metadata の `bulk: true`）を監査ログに残し、未使用のペアリングコードも取り消す
- 端末を別の場所に移すだけなら、失効ではなく `updatePairedDevice(id, { scope })` で付け替えてもよい（再ペアリング不要）

## ペアリング（端末を登録する 2 つの方式）

| 方式 | 流れ | 向いている場面 |
|---|---|---|
| A. 管理者がコードを発行 | 管理画面で端末を登録 → コードを発行 → 端末でコードを入力 | 端末にキーボードがある / 管理者が端末の前にいる |
| B. 端末から始める | 端末がコード / QR を表示 → 管理者が自分のスマホで読み取って承認 | キーボードのないキオスク（入力が要らない） |

- コードは 8 文字の Crockford Base32（`ABCD-2345` の形、I / L / O の入力ゆれは吸収）・10 分で失効・使い捨て
- 同じ端末に新しいコードを出すと、古い未使用コードは取り消される
- 失効済みの端末にもコードを出せる（ペアリングが成立すると失効が解除される = 再ペアリング）
- B では、コードを見ただけの第三者はトークンを受け取れない（開始した端末だけが持つ照合用 Cookie で受け取る）
- B は kind の `pairingFlows` に `"device_initiated"` を足した kind でだけ使える（承認時に判定。許可していなければ reason `flow_not_allowed`）
- 端末トークンを発行する直前（A の claim・B の完了）にも kind の `verify` を通す。通らなければ発行せず、コードも消費しない
- 稼働中（トークン有効）の端末への B の承認は、`replaceActive: true` を付けないと 409（reason `device_active`）で止まる（取り違えで今の端末を締め出さないため）
- 公開のペアリング POST はクロスサイトからの送信を拒否する（`Sec-Fetch-Site` / `Origin`）
- 総当たりはレート制限で防ぐ。店内の端末は同じ IP から来るので、IP 単位は緩い上限だけにして主な制限は別の単位でかける
  - コード入力 `pairedDeviceClaim`（IP 単位 100 回 / 10 分）、端末からの開始 `pairedDevicePairingStart`（IP 単位 20 回 / 10 分）
  - 承認の確認 `pairedDevicePairingPoll`（ペアリング単位 60 回 / 分）+ `pairedDevicePairingPollIp`（IP 単位 600 回 / 分）
  - 承認・承認情報 `pairedDeviceManage`（ユーザー単位 60 回 / 10 分）+ `pairedDeviceManageIp`（IP 単位 300 回 / 10 分）

管理画面を作る前の最初の 1 台や復旧には CLI を使う:

```bash
pnpm task paired-device-pair -- --kind staff_tablet --label "店舗A タブレット" --scope '{"storeId":"..."}'
pnpm task paired-device-pair -- --device <端末 id>   # 既存の端末に再発行
```

## 画面の組み立て（downstream）

hooks はすべて `@/features/core/pairedDevice/hooks`。失敗の理由は `errorReason`
（`not_found` / `expired` / `used` / `rate_limited` / `forbidden` / `invalid_scope` / `disabled`）で、文言は自由に決めてよい。

| 用途 | パーツ |
|---|---|
| この端末が登録済みか | `useSessionDevice()`（未登録は `data === null`） |
| A. コード入力 | `useClaimDevicePairing({ autoClaimCode })` + `OneTimeCodeInput`（`@/components/Form/Input/Manual`） |
| QR から開いたときのコード | `useDevicePairingCodeFromUrl(param = "code")`（Suspense の内側で使う） |
| B. 端末側の表示と承認待ち | `useStartDevicePairing()`（`phase` / `code` / `lastError` / `restart`）。一時的な失敗では止まらず確認を続ける |
| B. 承認画面 | `useDevicePairingRequest(code)` + `useApproveDevicePairing()` |
| この端末の登録解除 | `useUnpairThisDevice()` |
| 管理一覧・詳細 | `usePairedDevices(params)` / `usePairedDevice(id)` / `usePairedDeviceKinds()` |
| 管理操作 | `useCreatePairedDevice` / `useUpdatePairedDevice` / `useRevokePairedDevice` / `useIssuePairingCode` / `useCancelDevicePairing` |

### レシピ: 端末側のペアリング画面（A と B の両対応）

```tsx
// src/app/device-pair/_components/DevicePairing.tsx（"use client" の part）
"use client";

import { useState } from "react";

import { OneTimeCodeInput } from "@/components/Form/Input/Manual";
import { Button } from "@/components/Form/Button/Button";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import {
  useClaimDevicePairing,
  useDevicePairingCodeFromUrl,
  useSessionDevice,
  useStartDevicePairing,
} from "@/features/core/pairedDevice/hooks";

const REASON_MESSAGES = {
  not_found: "コードが違います",
  expired: "コードの期限が切れています。管理者に再発行してもらってください",
  used: "このコードは使用済みです",
  rate_limited: "試行回数が多すぎます。しばらく待ってからやり直してください",
} as const;

export function DevicePairing() {
  const { data: device } = useSessionDevice();
  const [code, setCode] = useState("");
  // 管理者が見せた QR（/device-pair?code=...）から開いたら自動で送る
  const claim = useClaimDevicePairing({ autoClaimCode: useDevicePairingCodeFromUrl() });

  if (device || claim.data) return <Para>この端末は登録済みです</Para>;

  return (
    <Stack space={4}>
      {/* 結果は claim.data / claim.errorReason で受け取るので、trigger の reject は握りつぶしてよい */}
      <OneTimeCodeInput
        value={code}
        onChange={setCode}
        onComplete={(value) => claim.trigger(value).catch(() => undefined)}
      />
      <Button onClick={() => claim.trigger(code).catch(() => undefined)} disabled={claim.isMutating}>
        {claim.isMutating ? "登録中…" : "登録する"}
      </Button>
      {claim.errorReason && claim.errorReason in REASON_MESSAGES && (
        <Para>{REASON_MESSAGES[claim.errorReason as keyof typeof REASON_MESSAGES]}</Para>
      )}
    </Stack>
  );
}

// B: キーボードのない端末はこちらだけを置く
export function DevicePairingByQr() {
  const pairing = useStartDevicePairing();
  if (pairing.phase === "completed") return <Para>登録しました</Para>;
  if (pairing.phase === "expired" || pairing.phase === "canceled" || pairing.phase === "error") {
    return <Button onClick={pairing.restart}>新しいコードを表示</Button>;
  }
  if (!pairing.code) return <Para>準備中…</Para>;
  // QR は好きなライブラリで描く（例: qrcode.react の <QRCodeSVG value={approveUrl} />）
  const approveUrl = `${location.origin}/device-approve?code=${pairing.code}`;
  return (
    <Stack space={2}>
      <Para>管理者のスマホで読み取ってください: {pairing.code}</Para>
      {/* QR: approveUrl */}
      {pairing.lastError ? <Para>接続を確認しています…</Para> : null}
    </Stack>
  );
}
```

Screen（`page.tsx` → `_screen` or `_components`）の置き方は src/lib/screens/README.md。
`useDevicePairingCodeFromUrl` は `useSearchParams` を使うので、この part は `<Suspense>` の内側に置く。

### レシピ: 承認画面（B。管理者が自分のスマホで開く）

```tsx
const code = useDevicePairingCodeFromUrl();
// User-Agent・IP・期限を見せて確かめてもらう。sameNetworkAsApprover が false なら
// 「目の前の端末に出ているコードか」を確認してもらう（参考情報。認可の条件ではない）
const { data: request, error } = useDevicePairingRequest(code);
const approve = useApproveDevicePairing();
// 既存の端末を割り当てる（稼働中の端末なら 409 device_active → 確認のうえ replaceActive: true で再送）
await approve.trigger({ code: code!, deviceId });
await approve.trigger({ code: code!, deviceId, replaceActive: true });
// その場で登録する
await approve.trigger({ code: code!, device: { label: "3番テーブル", kind: "table_terminal", scope: { storeId, tableId } } });
```

承認ページはログインが要る（`(user)/(protected)` などに置く）。承認できるのは `manageableScopes` の範囲の端末だけ。

### レシピ: 管理画面

```tsx
const { data } = usePairedDevices({ kind: "table_terminal", scope: { storeId } }, { refreshInterval: 30_000 });
// data.results[i].state: unpaired / active / expired / revoked、online: 最終アクセスが 10 分以内
const issue = useIssuePairingCode();
const { code, expiresAt } = await issue.trigger(deviceId); // この応答でしか受け取れない。端末に入力してもらう
```

管理 API はログインユーザーなら誰でも呼べ、範囲はサーバーが `manageableScopes` で絞る
（admin 以外のロールも使えるよう `/api/admin` 配下にはしていない）。

## API 一覧

端末側（`/api/paired-device/**`）

| メソッド・パス | 内容 |
|---|---|
| `GET /session` | この端末の情報（未登録は `{ device: null }`） |
| `DELETE /session` | この端末の登録を解除（トークンを消す。失効にはしない） |
| `POST /pairing/claim` `{ code }` | A: コードで登録（Cookie を受け取る） |
| `POST /pairing/start` | B: コードを発行（照合用 Cookie を受け取る） |
| `POST /pairing/status` | B: 承認されたか確認（承認済みなら Cookie を受け取る） |

管理側（`/api/paired-devices/**`、ログイン必須 + `manageableScopes`）

| メソッド・パス | 内容 |
|---|---|
| `GET /` `?kind&scope(JSON)&includeRevoked&page&limit` | 一覧 |
| `POST /` `{ label, kind, scope }` | 登録 |
| `GET /[id]` | 詳細と未使用のコード |
| `PATCH /[id]` `{ label?, scope? }` | 名前変更・scope の付け替え |
| `POST /[id]/revoke` `{ reason? }` | 失効 |
| `POST /[id]/pairing-code` | A: コード発行 |
| `POST /pairings/[pairingId]/cancel` | 未使用のコードを取り消し |
| `GET /pairing-requests?code=` | B: 承認画面用の情報 |
| `POST /pairing-requests/approve` `{ code, deviceId }` or `{ code, device }` | B: 承認 |
| `GET /kinds` | 管理できる端末の種類 |

server-only の API は `@/features/core/pairedDevice/services/server`（サービス）と
`.../services/server/session`（`getSessionDevice` / `deviceGuard` / `requireCurrentDevice` / Cookie）。
サービスの `actor` に `"system"` を渡すと権限判定を省く（CLI・cron 用。HTTP ルートからは必ずユーザーを渡す）。

## 実機での注意

- **iOS のホーム画面に追加したアプリは Safari と Cookie が別**。ペアリングは実際に使う形（ホーム画面のアプリ / ブラウザ）の中で行う
- キオスク用ブラウザ・アプリは Cookie を保持する設定にする（終了時に消す設定だと毎回ペアリングが要る）
- Cookie は `Secure` 付き。本番は HTTPS で配信する。開発の `localhost` は HTTP でも動くが、
  **LAN の IP（`http://192.168.x.x:3000`）でタブレットから開くと Cookie が保存されない**。実機の確認は HTTPS（トンネル等）で行う
- ブラウザは Cookie の寿命を約 400 日で打ち切る。端末の API か heartbeat（上記）を呼び続けている端末は延長されるので切れない
- 端末の Cookie を別の機材にコピーされると同じ端末として通る。気になる場合は `verify`（店舗 IP 等）を足す
- 端末からリアルタイム機能（realtimeRoom / Firestore）を使う認証は未対応
- 端末への応答は `Cache-Control: private, no-store`（Set-Cookie を含むので共有キャッシュに載せない）
- 端末のルートからお知らせ（notification）を送ると、送信者の種別は既存の慣習どおり admin として残る
  （system 以外は admin 扱い）。端末からの送信を区別したい場合は metadata に端末 id を入れる

## 監査ログ

| action | いつ |
|---|---|
| `paired_device.device.created` | 端末の登録 |
| `paired_device.device.renamed` / `scope_changed` | 名前変更・scope の付け替え |
| `paired_device.device.paired` | トークン発行（ペアリング成立） |
| `paired_device.device.revoked` / `unpaired` | 失効・端末自身による登録解除 |
| `paired_device.pairing.issued` / `approved` / `canceled` | コードの発行・承認・取り消し |

## データ

- `paired_devices`: label / kind / scope(JSONB) / token_hash（SHA-256、サービス境界から出さない）/ token_expires_at /
  paired_at / last_seen_at・last_seen_ip（`lastSeenThrottleSeconds` で間引いて更新）/ revoked_at
- `device_pairings`: flow / status / code_hash / pending_token_hash / expires_at。期限切れから 24 時間で
  cron `paired-device-pairings-prune` が削除する
- 照合用のランダムトークン・短いコードの生成は `@/lib/crypto`（secretToken.ts）
