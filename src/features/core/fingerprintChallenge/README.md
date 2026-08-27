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
  challenge: { enabled: false, defaultExpiresInDays: 7, maxBehaviorBytes: 32768 },
};
```

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
- 回答取得・提出は **本人ログイン + トークン一致の二重検証**。他人のトークンや
  存在しないトークンは区別せず 404（トークンの存在を漏らさない）。
- 監査: `fingerprint.challenge.issued / submitted / reviewed / canceled` を手動記録。

---

## API

| 経路 | メソッド | 用途 |
|---|---|---|
| `/api/admin/fingerprint-challenges` | POST | 発行 → `{ challenge, token }` |
| `/api/admin/fingerprint-challenges/[id]` | PATCH | `{action:"review"\|"cancel", note?}` |
| `/api/me/fingerprint-challenges/[token]` | GET | 本人向け取得（質問・状態・期限） |
| `/api/me/fingerprint-challenges/[token]/submit` | POST | 回答提出（fingerprint 必須添付） |

一覧・検索は汎用 `/api/fingerprint-challenge`（serviceRegistry `ADMIN_ONLY`）。

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

> ページguard: `/verify/[token]` を認証必須エリア（`(user)/(protected)` 配下）に置くと、
> 未ログインなら proxy → authGuard がログインへ誘導し、提出時の本人検証と噛み合う。

---

## DB テーブル

`fingerprint_challenges`（Neon）: `token_hash`(hiddenColumns) / `status`(enum) /
`prompt`(jsonb 自由形式) / `answers`(jsonb) / `behavior`(jsonb) /
`fingerprint_id`(FK→device_fingerprints) / `issued_by` / `expires_at` /
`submitted_at` / `reviewed_by` / `review_note`。

FK 名は 63 文字制限のため明示短縮名（`fp_challenges_*_fk`）を付与済み。

## 関連

- デバイス信号の蓄積・照合: [`deviceFingerprint/README.md`](../deviceFingerprint/README.md)
- 収集ライブラリ: `src/lib/fingerprint/`
