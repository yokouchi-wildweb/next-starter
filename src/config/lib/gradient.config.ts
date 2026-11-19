// src/config/lib/gradient.config.ts
// グラデーションの設定の上書き(@lib-config/gradient)。キーと既定: src/lib/gradient/config.ts
// 例: export default { customGradients: [{ key: "tier-s", label: "Sランク", group: "ランク", stops: ["oklch(0.85 0.18 95)", "oklch(0.7 0.2 40)"], text: true }] } satisfies GradientOverride;
// 足したら `pnpm generate styles` で src/styles/gradient.css を書き直してコミットする
import type { GradientOverride } from "@/lib/gradient/config";

export default {} satisfies GradientOverride;
