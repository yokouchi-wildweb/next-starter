// src/featureGate/rules/demoDeviceFingerprint.ts
// デモ × 端末の指紋: 指紋のデモ画面(親 demoPages × 子 deviceFingerprint の小さな機能、D34 K3)。
// 住所は親の住所の下にあるが、子の機能は親に依存しないので、両方に依存するこの機能が住所を持つ。
// enabled は書かない(省略 = 自分は開、両方が開のとき開)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["demoPages", "deviceFingerprint"],
  pathPatterns: [
    "/demo/fingerprint",
  ],
};
