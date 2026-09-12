# fingerprintChallenge — 不正疑いユーザーへの回答チャレンジ

不正が疑われるユーザーに **専用フォームを送って回答させ、その提出時に
デバイスフィンガープリント + 詳細な行動計測を強制的に採取する** ための基盤。

このドメインが持つのは **チャレンジのライフサイクル（発行 → 回答 → レビュー）と
データ契約だけ**。フォームの見た目・質問項目・画面は **downstream 所有** で、core は
UI を同梱しない（core_domain_ui_boundary）。この README の「フォーム実装レシピ」を
コピーして質問項目を差し替えれば、計測込みの回答フォームが最短で組める。

---

## オプトイン（デフォルト無効）

`src/config/app/fingerprint.config.ts` の `challenge.enabled` がゲート。**デフォルト
false**。`deviceFingerprint` の `collection.enabled` とは **独立**（責務分離）。

```ts
export const FINGERPRINT_CONFIG = {
  challenge: {
    enabled: false,
    answerableStatuses: ["active", "suspended"], // 本人向けルートを通すユーザーステータス
    defaultExpiresInDays: 7,
    maxBehaviorBytes: 32768,
    accessLog: { enabled: false, dedupeSeconds: 60, retentionDays: 90 }, // 閲覧計測（独立ゲート）
  },
};
```

### 利用制限中のユーザーも回答できる（answerableStatuses）

チャレンジの主対象は **処分保留（`suspended`）** のユーザー。通常の `/api/me/**` は
`active` のみ通すが、本人向けチャレンジルートは `createMeRoute` の `allowStatuses` に
`challenge.answerableStatuses`（既定 `["active","suspended"]`）を渡して通している。
`banned` / `security_locked` / `withdrawn` は列挙しない限り 403（fail-closed）。

回答ページ側も同じ語彙で開ける: `authGuard({ allowStatuses: ["active", "suspended"] })` を
持つレイアウト配下に置く（`(user)/(protected)` は active 限定なので、その外に出す）。

---

## ライフサイクル

```
[admin] 発行 issueChallenge ──► 生トークン返却（1 回だけ）
   │                              └► フォーム URL に埋めてユーザーへ案内
   ▼
[user] 回答 submitChallenge ──► デバイス信号 + 行動計測を強制添付・記録
   │                            status: pending → submitted
   ▼
[admin] reviewChallenge / cancelChallenge（submitted → reviewed / pending → canceled）
```

- **「期限切れ」は状態として持たない**。`pending` かつ `expires_at < now` を
  読み取り時に `"expired"` として導出する（cron 不要）。
- 生トークンは **発行レスポンスでのみ取得可能**。DB は SHA-256 のみ保存し、
  `token_hash` は `hiddenColumns` で全サービス返却から除外される。
- 回答取得・提出には **2 経路** ある（どちらも本人ログイン必須）:
  - **トークン経路**（メールリンク）: トークン一致 + セッションユーザー一致の二重検証。
    他人のトークンや存在しないトークンは区別せず 404（トークンの存在を漏らさない）。
  - **本人スコープ経路**（トークン無し）: `GET /pending` でログイン本人の未回答チャレンジを
    引き、その `id` で提出。`user_id` でのみ絞るため他人の行は決して返らない。
    メール紛失時や `/restricted` 着地ページの CTA から誘導する用途。
- 監査: `fingerprint.challenge.issued / submitted / reviewed / canceled` を手動記録
  （どちらの経路でも同じ action 名）。

---

## API

| 経路 | メソッド | 用途 |
|---|---|---|
| `/api/admin/fingerprint-challenges` | POST | 発行 → `{ challenge, token }` |
| `/api/admin/fingerprint-challenges/[id]` | PATCH | `{action:"review"\|"cancel", note?}` / `{action:"mark_notified", channels, notifiedAt?, note?}` |
| `/api/admin/fingerprint-challenges/[id]/access-events` | GET | 閲覧イベント（日時 + IP + UA）新しい順 `?page&limit` → `{results,total,page,limit}` |
| `/api/me/fingerprint-challenges/[token]` | GET | 本人向け取得（トークン経路） |
| `/api/me/fingerprint-challenges/[token]/submit` | POST | 回答提出（トークン経路） |
| `/api/me/fingerprint-challenges/pending` | GET | 本人の未回答・期限内の最新 → `{ challenge \| null }` |
| `/api/me/fingerprint-challenges/by-id/[id]/submit` | POST | 回答提出（本人スコープ経路、`pending` の id で） |

一覧・検索は汎用 `/api/fingerprint-challenge`（serviceRegistry `ADMIN_ONLY`）。

> `by-id/` を挟むのは Next.js の制約（同一階層に `[token]` と `[id]` を共存させられない）。
> `pending` は静的セグメントなので `[token]` より優先され、生トークンと衝突しない。

hooks / client:

- `useFingerprintChallenge(token)` — トークン経路の取得
- `useMyPendingFingerprintChallenge()` — 本人スコープ経路の取得（`data` は無ければ `null`）
- `useSubmitFingerprintChallenge().submit(target, answers, behavior?)` —
  `target` は `{ token }` | `{ id }`（文字列を渡すと token 扱い）
- admin: `useFingerprintChallengeAccessEvents(challengeId, {page,limit})` /
  `markChallengeNotified(id, {channels})`（`services/client/adminChallengeClient.ts`）

---

## エンゲージメント計測（通知 → 閲覧 → 提出のタイムライン）

管理者が「案内は届いたか・開いたか・何度開いたか・いつ提出したか」で追撃（リマインド・
期限延長・エスカレーション）を判断できるよう、**1 行で追えるタイムライン**を持つ。

| 列 | 書き手 | 意味 |
|---|---|---|
| `notified_at` / `notified_channels` | admin（`mark_notified`） | 案内を送った時刻（**初回のみ**）とチャネルの和集合。再通知は監査ログ `fingerprint.challenge.notified` に毎回残る |
| `first_viewed_at` / `last_viewed_at` / `view_count` | 本人向け取得ルート（自動） | 本人が開いた初回 / 最終 / 回数。**`accessLog.enabled` の時だけ**更新される |
| `submitted_at` | 本人（提出） | 従来どおり |

閲覧計測（`accessLog`）の仕様:

- 計装点は `getChallengeForUser`（トークン経路）と `getPendingChallengeForUser`（本人スコープ経路）。
  IP / UA は routeFactory が ALS に注入した監査コンテキストから取る（route の配線不要）。
- 1 UPDATE（`WHERE ... AND status='pending' AND (last_viewed_at IS NULL OR last_viewed_at < now - dedupeSeconds)`）
  + 更新できた時だけ 1 INSERT。追加 SELECT なし。**`pending` の間だけ**カウントし、提出後・取り下げ後の
  再閲覧は数えない（「未提出のまま N 回開いた」の語義を守るため）。
- **fail-soft**: 記録失敗は `console.error` のみで読み取りは通す。per-view の audit_logs は書かない（量）。
- `fingerprint_challenge_access_events`（IP + UA の詳細行）は `retentionDays` + 日次 cron
  `fingerprint-challenge-access-prune` で削除。親行のカウンタは残る。
- **本人向け DTO（`FingerprintChallengeForUser`）には閲覧カウンタも IP も出さない**（計測の存在を見せない）。
- 信号はクライアント由来（IP はプロキシ次第、UA は自己申告）なので **参考証拠**。ログイン履歴
  （userLoginEvent）と突き合わせ、「アカウントのログイン IP と別ネットワークから開いた」等の材料にする。

admin 側の運用例:

```ts
// 発行直後にメールを送ったらスタンプ（notified_at はこの 1 回目が残る）
await markChallengeNotified(challenge.id, { channels: ["email"] });
// リマインド送信（notified_at は変わらず、channels は和集合、監査ログに毎回残る）
await markChallengeNotified(challenge.id, { channels: ["email"], note: "リマインド 1 回目" });

// 詳細画面: 閲覧タイムライン
const { data } = useFingerprintChallengeAccessEvents(challenge.id, { page: 1, limit: 50 });
// data.results: [{ accessedAt, ip, userAgent, ... }] 新しい順
```

一覧列の「開封状況」は汎用 `/api/fingerprint-challenge` search の行にそのまま
`firstViewedAt / lastViewedAt / viewCount / notifiedAt` が載るので追加 API は不要。

---

## 行動計測（フォーム特有のシグナル）

`useBehavioralCapture()`（`src/lib/fingerprint/`）は **ヘッドレス**（UI なし）。
フォームのラッパーに `containerProps` を spread するだけで配下入力の行動を capture する。

採取する統計（**プライバシー不変条件はフック側で構造的に保証**）:

- キーストローク: 打鍵数・Backspace 数・**打鍵間隔の平均/標準偏差**（キーの内容は記録しない）
- ペースト: 回数・貼付け文字数（**内容は記録しない**）
- フォーカス: フィールド別滞在時間・遷移順
- ポインタ: 総移動距離・速度平均/分散・直線度（**生座標は保持しない**。bot は分散が極端に小さい）
- タブ非表示回数（他画面参照の推定材料）

---

## フォーム実装レシピ（downstream がコピーする完成形）

`FINGERPRINT_CONFIG.challenge.enabled = true` にした上で、回答ページを作る。
質問項目（`answers` の中身）は自由に差し替えてよい。

```tsx
// app/(user)/verify/[token]/_components/ChallengeForm.tsx
"use client";

import { useState } from "react";
import { useBehavioralCapture } from "@/lib/fingerprint";
import { useFingerprintChallenge } from "@/features/core/fingerprintChallenge/hooks/useFingerprintChallenge";
import { useSubmitFingerprintChallenge } from "@/features/core/fingerprintChallenge/hooks/useSubmitFingerprintChallenge";
import { Button } from "@/components/Form/Button";
import { Input } from "@/components/Form/Input";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

export function ChallengeForm({ token }: { token: string }) {
  const { data: challenge, isLoading } = useFingerprintChallenge(token);
  const { submit, isSubmitting } = useSubmitFingerprintChallenge();
  const behavior = useBehavioralCapture();
  const [fullName, setFullName] = useState("");
  const [done, setDone] = useState(false);

  if (isLoading) return <Para>読み込み中…</Para>;
  if (!challenge || challenge.status === "expired")
    return <Para>このフォームは無効か期限切れです。</Para>;
  if (challenge.status !== "pending" || done)
    return <Para>回答を受け付けました。ありがとうございました。</Para>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // answers は自由形式。prompt（challenge.prompt）を見て動的に質問を描画してもよい
    await submit(token, { fullName }, behavior.getPayload());
    setDone(true);
  };

  return (
    // containerProps を spread した要素の配下が計測対象になる
    <form onSubmit={onSubmit} {...behavior.containerProps}>
      <Stack space={4}>
        {/* data-behavior-field で計測上のフィールド名を明示できる（name / id でも可） */}
        <Input
          name="fullName"
          data-behavior-field="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="氏名"
        />
        {/* isSubmitting でローディング可視化（async_feedback 必須ルール）。
            submit() は内部でデバイス信号の収集も自動実行する */}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "送信中…" : "送信"}
        </Button>
      </Stack>
    </form>
  );
}
```

発行〜案内の運用例（admin 側）:

```ts
// 1. 発行（admin ルート経由）
const { token } = await axios.post("/api/admin/fingerprint-challenges", {
  userId: suspectUserId,
  prompt: { title: "本人確認のお願い", fields: ["fullName"] }, // 自由形式
}).then((r) => r.data);

// 2. フォーム URL を組み立ててユーザーへ案内（メール等）
const url = `${getAppBaseUrl()}/verify/${token}`;
// getAppBaseUrl は @/lib/url（businessConfig.url 直参照は禁止）
```

> ページguard: `/verify/[token]` は **`(user)/(protected)` の外** に置き、専用レイアウトで
> `authGuard({ allowStatuses: ["active", "suspended"], redirectTo: "/login", returnBack: true })`
> を掛ける。`(protected)` は active 限定のため、suspended ユーザーが回答に辿り着けない。

### トークン無しの回答ページ（本人スコープ経路）

メールを紛失したユーザーや `/restricted` に着地した suspended ユーザー向けに、
トークンを URL に含めない回答ページも作れる。同じ `ChallengeForm` を id 経路で動かす:

```tsx
// app/(user)/verify/_components/PendingChallengeForm.tsx
"use client";

import { useMyPendingFingerprintChallenge } from "@/features/core/fingerprintChallenge/hooks/useMyPendingFingerprintChallenge";
import { useSubmitFingerprintChallenge } from "@/features/core/fingerprintChallenge/hooks/useSubmitFingerprintChallenge";
// ...

export function PendingChallengeForm() {
  const { data: challenge, isLoading } = useMyPendingFingerprintChallenge();
  const { submit, isSubmitting } = useSubmitFingerprintChallenge();
  // challenge === null → 「現在お願いしている確認はありません」
  // 提出: await submit({ id: challenge.id }, { fullName }, behavior.getPayload());
}
```

`/restricted` 着地ページの CTA は `useMyPendingFingerprintChallenge()` で `data` が非 null の
ときだけ「本人確認フォームへ」を出す（`/restricted` は `(auth)` 配下 = 認証済みなら
ステータス問わず表示できるが、API 側は `answerableStatuses` で絞られる）。

---

## DB テーブル

`fingerprint_challenges`（Neon）: `token_hash`(hiddenColumns) / `status`(enum) /
`prompt`(jsonb 自由形式) / `answers`(jsonb) / `behavior`(jsonb) /
`fingerprint_id`(FK→device_fingerprints) / `issued_by` / `expires_at` /
`submitted_at` / `reviewed_by` / `review_note` /
`notified_at` / `notified_channels`(text[]) / `first_viewed_at` / `last_viewed_at` / `view_count`。

`fingerprint_challenge_access_events`: `challenge_id`(FK cascade) / `user_id`(FK cascade) /
`ip`(inet, null 可) / `user_agent` / `accessed_at` / `retention_days`。
index: `(challenge_id, accessed_at)` タイムライン、`accessed_at` prune 用。

FK 名は 63 文字制限のため明示短縮名（`fp_challenges_*_fk` / `fp_challenge_access_events_*_fk`）を付与済み。

## 関連

- デバイス信号の蓄積・照合: [`deviceFingerprint/README.md`](../deviceFingerprint/README.md)
- 収集ライブラリ: `src/lib/fingerprint/`
