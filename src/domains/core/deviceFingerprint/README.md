# deviceFingerprint — ブラウザフィンガープリント蓄積 / デバイス軸照合

## Overview

不正が疑われるユーザーをデバイス軸で突き合わせるための一次データの基盤(`@/domains/core/deviceFingerprint`)。`userLoginEvent`(IP = ネットワーク軸)の兄弟で、両者を組み合わせて調べる。

- 収集のロジック本体はドメインに依らない `src/lib/fingerprint/`(`collect.ts`・`hash.ts`・`useBehavioralCapture.ts`・`types.ts`)。本ドメインはその蓄積(`device_fingerprints`)と照合(成分別のスコアリング)を担う
- 脅威モデル: フィンガープリントはクライアントの申告値で偽装できる。Canvas 等に意図的なノイズを入れるブラウザ(Safari / Brave / Firefox RFP)や、ハードが均質でユーザー間のエントロピーが低い端末(iPhone)では、一致・不一致ともノイズが乗る
- 閉じられる機能: 門番の規則 `src/featureGate/rules/deviceFingerprint.ts`(既定は閉 = opt-in)。閉じると `/api/admin/device-fingerprint`・`/api/me/fingerprint`・掃除の cron・`/demo/fingerprint`・導出の `/api/deviceFingerprint` が 404 で、表も push から外れる
- 全ページ設置型の収集の口 `POST /api/me/fingerprint` は子の機能 `src/featureGate/rules/deviceFingerprintPageIngest.ts`(既定は開 = 親が開けば開)。指紋の確認(fingerprintChallenge)だけを使うなら、この子だけを閉じる(`pnpm ops features set deviceFingerprintPageIngest off`)。確認は口を使わず、提出が指紋を記録する。デモ画面 `/demo/fingerprint` は口に送るので口の機能に依る
- 開けた時点以降のアクセスから蓄積する(遡れない)
- チャレンジは別の機能 `fingerprintChallenge`(この機能に依存する)

### 収集する信号

`collectDeviceSignals()`（ブラウザ専用・各成分 fail-soft = 取れない成分は null）:

| 成分 | 内容 | 照合重み |
|---|---|---|
| canvas | Canvas 2D 描画のハッシュ（GPU/ドライバ/フォント描画差） | 3（強） |
| audio | OfflineAudioContext 波形ハッシュ（DSP 実装差） | 3（強） |
| webgl | UNMASKED renderer/vendor + 主要パラメータのハッシュ | 2（強） |
| fonts | テキスト幅測定で検出したインストール済みフォント | 2（強） |
| screen | 解像度 × 色深度 @ DPR（可読キー） | 1 |
| timezone | IANA タイムゾーン名 | 1 |
| languages | navigator.languages | 1 |
| platform | navigator.platform | 1 |
| hardware | concurrency / deviceMemory / maxTouchPoints | 1 |

- 弱成分だけの一致(同じ OS は大量にある)では候補に上がらない(Internals)

## Usage

### 開ける

```ts
// src/config/featureGate/switches.config.ts
export default { deviceFingerprint: true } satisfies FeatureSwitches;
```

- `pnpm ops features set deviceFingerprint on` でも書ける
- 全ページの収集を使わない(確認だけ): `export default { deviceFingerprint: true, fingerprintChallenge: true, deviceFingerprintPageIngest: false }`

### 記録の経路 A: 全ページに置く(薄く広く)

ログイン後のレイアウト等に 1 行置く。fire-and-forget で 1 日 1 回だけ収集・送信する。

```tsx
"use client";
import { useFingerprintReport } from "@/domains/core/deviceFingerprint/hooks/useFingerprintReport";

export function FingerprintReporter({ user }: { user: SessionUser | null }) {
  useFingerprintReport(user); // 収集の口の機能が閉のときは何も送らない(門番の useGate で判定)
  return null;
}
```

- 機能が閉の間はサーバーが 404 を返すだけ(フックは静かに無視する)

### 記録の経路 B: チャレンジの提出(濃く狭く)

`fingerprintChallenge` の回答の提出で `source: "challenge"` として自動で記録する。行動計測(`useBehavioralCapture`)はこちらでだけ取る → `fingerprintChallenge/README.md`

### 調べる(IP × デバイスの複合)

画面は downstream が持つ。調査のサービスの組み立て例:

```ts
// domains/<yourAdminDomain>/services/server/fraudInvestigation.ts
import { findUsersBySimilarFingerprint } from "@/domains/core/deviceFingerprint/services/server";
import { findUsersBySameIp } from "@/domains/userLoginEvent/services/server";

export async function investigate(userId: string, recentIp: string) {
  const [byDevice, byIp] = await Promise.all([
    findUsersBySimilarFingerprint(userId, { minScore: 6 }),
    findUsersBySameIp(recentIp, { excludeUserId: userId }),
  ]);
  // デバイスと IP の両方で一致するユーザーは複垢の可能性が相対的に高い（それでも断定はしない）
  const ipSet = new Set(byIp.map((r) => r.userId));
  return byDevice.map((d) => ({ ...d, alsoSameIp: ipSet.has(d.userId) }));
}
```

- admin 用の HTTP は `POST /api/admin/device-fingerprint/similar`(userId か compositeHash)と `/compare`(2 ユーザーの比較)を同梱済み。一覧・検索は汎用 `/api/deviceFingerprint`(domainEntry の access `ADMIN_ONLY`)

## API

照合の口(server-only):

```ts
import {
  findUsersBySimilarFingerprint,
  findUsersByExactFingerprint,
  compareUsersFingerprints,
} from "@/domains/core/deviceFingerprint/services/server";
```

- `findUsersBySimilarFingerprint(userId, options?)`: 指定ユーザーのフィンガープリント群と成分一致スコア(重み付き、満点 15)で近い他ユーザーを返す。既定 `minScore = 5`(強成分 1 + 弱成分 2 相当)

```ts
const rows = await findUsersBySimilarFingerprint(suspectUserId, { minScore: 6, limit: 50 });
// => [{ userId, bestScore, matchedFingerprints, lastSeenAt }, ...]
```

- `findUsersByExactFingerprint(compositeHash, options?)`: 合成ハッシュの完全一致(最も強い一致。ノイズを入れるブラウザでは出にくい)
- `compareUsersFingerprints(userIdA, userIdB, options?)`: 2 ユーザー間を総当たりで比べ、上位のペアの成分別の一致の内訳を返す(ドリルダウン)
- 収集の口: `POST /api/me/fingerprint`(`services/client/fingerprintClient.ts`。機能 `deviceFingerprintPageIngest`)

### 表

- `device_fingerprints`(Neon): 成分別のカラム(canvas_hash / audio_hash / … / hardware_key)+ `composite_hash` + `component_hashes`(jsonb)+ `raw_signals`(jsonb、サイズ上限超過で null)+ `ip`(inet)+ `seen_count` + `last_seen_at` + `retention_days`
- index: `(user_id, composite_hash)` UNIQUE / `composite_hash` / 強成分別 / `(user_id, last_seen_at)` / `created_at`

## Extension

- 処理の値の上書き: `src/config/domains/deviceFingerprint.config.ts`(持ち主 `config.ts`)。既定 `collection: { retentionDays: 365, maxRawSignalsBytes: 32768 }`
- `config.ts` に enabled は無い(使うかどうかは門番の規則の入切だけ)

## Internals

- 記録はどちらの経路も `(user_id, composite_hash)` UNIQUE で upsert。同じ端末の再訪は `seen_count++` / `last_seen_at` の更新に畳まれ、行は増え続けない
- 強成分(canvas / audio / webgl / fonts)は個別のカラムに index を張り、`similarity` の JOIN の必須条件にしている
- 保持: 行単位の `retention_days` が過ぎた行を増設点 expiryRules の項目 `plugs/expiryRules/deviceFingerprintPrune.ts`(個人情報 `pii: true`、cron `expiry-prune` が 1 日 1 回)が消す
- 法務: 日本では改正電気通信事業法の外部送信規律の整理対象になり得る。不正検知の目的は比較的通しやすい類型

## Related

- 収集ライブラリ: `src/lib/fingerprint/`(型と収集関数の一次の説明はコード内の JSDoc)
- IP 軸の兄弟: [`userLoginEvent/README.md`](../userLoginEvent/README.md)
- チャレンジ: [`fingerprintChallenge/README.md`](../fingerprintChallenge/README.md)
