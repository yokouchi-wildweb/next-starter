# deviceFingerprint — ブラウザフィンガープリント蓄積 / デバイス軸照合

不正が疑われるユーザーを **デバイス軸** で突き合わせるための一次データ基盤。
`userLoginEvent`（IP = ネットワーク軸）の兄弟で、両者を組み合わせて調査する。

収集ロジック本体はドメイン非依存の `src/lib/fingerprint/` にあり、本ドメインは
その **蓄積（device_fingerprints）と照合（成分別スコアリング）** を担う。

> **重要（脅威モデル）**: フィンガープリントは **クライアント申告値であり偽装可能**。
> Canvas 等に意図的ノイズを入れるブラウザ（Safari / Brave / Firefox RFP）や、
> ハードが均質でユーザー間エントロピーが低い端末（iPhone）では一致・不一致とも
> ノイズが乗る。結果は **「参考証拠」であって断定材料ではない**。処分判断は
> IP 照合・行動計測・監査ログなど複数の証拠と合わせて人間が行うこと。

---

## オプトイン（デフォルト無効）

`src/config/app/fingerprint.config.ts` の `collection.enabled` が全ページ収集の
ゲート。**デフォルト false**。有効化した時点以降のアクセスから蓄積される（遡及不可）。

```ts
export const FINGERPRINT_CONFIG = {
  collection: { enabled: false, retentionDays: 365, maxRawSignalsBytes: 32768 },
  // challenge: { ... }  // fingerprintChallenge 側のゲート（独立）
};
```

---

## 基本構成

```
src/lib/fingerprint/                       # 収集ライブラリ（ドメイン非依存）
├── collect.ts                             # collectDeviceSignals / collectFingerprintPayload
├── hash.ts                                # SHA-256（+ 非 secure context 用 FNV フォールバック）
├── useBehavioralCapture.ts                # 行動計測フック（フォーム用・ヘッドレス）
└── types.ts                               # DeviceSignals / FingerprintPayload / BehaviorPayload

src/features/core/deviceFingerprint/
├── constants/                             # source / 成分キー・重み / retention
├── entities/                              # drizzle（成分別カラム + composite_hash）/ model / schema
├── services/
│   ├── server/
│   │   ├── recordFingerprint.ts           # upsert ingest（(user_id, composite_hash) 単位）
│   │   ├── similarity.ts                  # 成分別スコアリングのクロスユーザー照合
│   │   ├── pruning.ts                     # 期限切れ削除（cron）
│   │   └── drizzleBase.ts
│   └── client/fingerprintClient.ts        # POST /api/me/fingerprint
├── hooks/useFingerprintReport.ts          # 全ページ設置型の収集フック（1 日 1 回）
└── index.ts                               # client-safe バレル
```

---

## 収集する信号

`collectDeviceSignals()`（ブラウザ専用・各成分 fail-soft = 取れない成分は null）:

| 成分 | 内容 | 照合重み |
|---|---|---|
| canvas | Canvas 2D 描画のハッシュ（GPU/ドライバ/フォント描画差） | 3（強） |
| audio | OfflineAudioContext 波形ハッシュ（DSP 実装差） | 3（強） |
| webgl | UNMASKED renderer/vendor + 主要パラメータのハッシュ | 2 |
| fonts | テキスト幅測定で検出したインストール済みフォント | 2 |
| screen | 解像度 × 色深度 @ DPR（可読キー） | 1 |
| timezone | IANA タイムゾーン名 | 1 |
| languages | navigator.languages | 1 |
| platform | navigator.platform | 1 |
| hardware | concurrency / deviceMemory / maxTouchPoints | 1 |

強成分（canvas/audio/webgl/fonts）は個別カラムに index を張り、`similarity` の
JOIN 必須条件にしている。**弱成分だけの一致（同一 OS が大量に存在する）では
候補に上がらない。**

---

## 記録経路

### A. 全ページ設置型（薄く広く）

ログイン後レイアウト等に 1 行置く。fire-and-forget で 1 日 1 回だけ収集・送信する。

```tsx
"use client";
import { useFingerprintReport } from "@/features/core/deviceFingerprint/hooks/useFingerprintReport";

export function FingerprintReporter({ user }: { user: SessionUser | null }) {
  useFingerprintReport(user); // config 無効時はサーバーが 404 を返し静かに無視
  return null;
}
```

`collection.enabled` が false の間はサーバー側が 404 を返すだけなので、
**フック設置自体は config と独立して常置できる**（有効化は config フラグのみ）。

### B. チャレンジ提出時（濃く狭く）

`fingerprintChallenge` の回答提出時に `source: "challenge"` で自動記録される。
行動計測（`useBehavioralCapture`）はこちらでのみ取得する。→ `fingerprintChallenge/README.md`

いずれも `(user_id, composite_hash)` UNIQUE で **upsert**。同一端末の再訪は
`seen_count++ / last_seen_at` 更新に畳まれ、行は無限に増えない。

---

## 照合 API（server-only）

```ts
import {
  findUsersBySimilarFingerprint,
  findUsersByExactFingerprint,
  compareUsersFingerprints,
} from "@/features/core/deviceFingerprint/services/server";
```

### findUsersBySimilarFingerprint(userId, options?)

指定ユーザーのフィンガープリント群と **成分一致スコア**（重み付き、満点 15）で
近い他ユーザーを返す。既定 `minScore = 5`（強成分 1 + 弱成分 2 相当）。

```ts
const rows = await findUsersBySimilarFingerprint(suspectUserId, { minScore: 6, limit: 50 });
// => [{ userId, bestScore, matchedFingerprints, lastSeenAt }, ...]
```

### findUsersByExactFingerprint(compositeHash, options?)

合成ハッシュ完全一致（最も強い一致。ノイズ注入ブラウザでは出にくい）。

### compareUsersFingerprints(userIdA, userIdB, options?)

2 ユーザー間を総当たり比較し、上位ペアの **成分別一致内訳** を返す（ドリルダウン）。

---

## admin 調査レシピ（IP × デバイスの複合）

画面は downstream 所有（core は UI を持たない）。以下は調査サービスの組み立て例:

```ts
// features/<yourAdminDomain>/services/server/fraudInvestigation.ts
import { findUsersBySimilarFingerprint } from "@/features/core/deviceFingerprint/services/server";
import { findUsersBySameIp } from "@/features/core/userLoginEvent/services/server";

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

admin 用 HTTP は `POST /api/admin/device-fingerprint/similar`（userId or compositeHash）
と `/compare`（2 ユーザー比較）を同梱済み。一覧・検索は汎用 `/api/device-fingerprint`
（serviceRegistry `ADMIN_ONLY`）。

---

## DB テーブル

`device_fingerprints`（Neon）: 成分別カラム（canvas_hash / audio_hash / … / hardware_key）
+ `composite_hash` + `component_hashes`(jsonb) + `raw_signals`(jsonb, サイズ上限超過で null)
+ `ip`(inet) + `seen_count` + `last_seen_at` + `retention_days`。

index: `(user_id, composite_hash)` UNIQUE / `composite_hash` / 強成分別 / `(user_id, last_seen_at)` / `created_at`。

---

## retention と cron

IP 同様に個人へ紐づく識別情報のため無期限保持にせず、行単位 `retention_days` +
日次 cron `device-fingerprint-prune`（`15 4 * * *`）で自動削除する
（`userLoginEvent` / `audit_logs` と同じバッチ + SKIP LOCKED パターン）。

---

## プライバシー / 法務メモ

- 日本では改正電気通信事業法の外部送信規律の整理対象になり得る。不正検知目的は
  比較的通しやすい類型だが、収集する信号はプライバシーポリシーに記載すること。
- 収集は認証済み文脈のみ（匿名収集はしない）。デモユーザーは記録しない。

## 関連

- 収集ライブラリ: `src/lib/fingerprint/`（型と収集関数の一次ドキュメントはコード内 JSDoc）
- IP 軸の兄弟: [`userLoginEvent/README.md`](../userLoginEvent/README.md)
- チャレンジ: [`fingerprintChallenge/README.md`](../fingerprintChallenge/README.md)
