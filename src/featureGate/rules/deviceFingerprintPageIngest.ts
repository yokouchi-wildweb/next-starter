// src/featureGate/rules/deviceFingerprintPageIngest.ts
// 端末の指紋 × 全ページ設置型の収集の口(POST /api/me/fingerprint、送り手は useFingerprintReport)。親 deviceFingerprint の小さな機能。
// 指紋の確認(fingerprintChallenge)はこの口を使わない(照合はチャレンジの提出が記録する)ので、確認だけを使う fork はこの機能だけを閉じる
// (pnpm ops features set deviceFingerprintPageIngest off)。入切の既定は開(親が開いていれば開 = 分ける前と同じ開き方)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["deviceFingerprint"],
  pathPatterns: [
    "/api/me/fingerprint",
  ],
  defaultEnabled: true,
};
